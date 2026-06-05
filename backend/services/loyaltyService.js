const db = require('../db');

/**
 * Checks and expires any pending points for a customer
 * @param {number} customerId 
 */
function checkAndExpirePoints(customerId) {
  // Find all active EARN transactions for the customer where points_remaining > 0 and expiry_date < current date
  const expiredTx = db.all(`
    SELECT * FROM loyalty_transactions 
    WHERE customer_id = ? 
      AND points_remaining > 0 
      AND expiry_date IS NOT NULL 
      AND expiry_date < date('now', 'localtime')
    ORDER BY created_at ASC
  `, [customerId]);

  for (const tx of expiredTx) {
    const expiredPoints = tx.points_remaining;
    
    // Set points_remaining to 0 for the expired transaction
    db.run(`
      UPDATE loyalty_transactions 
      SET points_remaining = 0 
      WHERE id = ?
    `, [tx.id]);

    // Retrieve current customer points
    const customer = db.get('SELECT loyalty_points FROM customers WHERE id = ?', [customerId]);
    if (!customer) continue;
    
    const newPoints = Math.max(0, customer.loyalty_points - expiredPoints);
    
    // Update customer points
    db.run('UPDATE customers SET loyalty_points = ? WHERE id = ?', [newPoints, customerId]);

    // Insert an EXPIRE transaction
    db.run(`
      INSERT INTO loyalty_transactions (customer_id, invoice_id, type, points, balance_after, note, points_remaining, expiry_date)
      VALUES (?, ?, ?, ?, ?, ?, ?, NULL)
    `, [
      customerId,
      tx.invoice_id,
      'EXPIRE',
      -expiredPoints,
      newPoints,
      `Points expired from purchase on ${tx.created_at} (Tx #${tx.id})`,
      0
    ]);
  }
}

/**
 * Awards points to a customer on purchase
 * @param {number} customerId 
 * @param {number} invoiceId 
 * @param {number} finalTotal 
 * @param {object} settings 
 * @returns {number} Points earned
 */
function earnPoints(customerId, invoiceId, finalTotal, settings) {
  if (settings.enable_loyalty_points !== 'true') return 0;
  
  const perRupee = parseFloat(settings.loyalty_points_per_rupee || '1');
  const earned = Math.floor(finalTotal * perRupee);
  if (earned <= 0) return 0;

  // Check expiry setting
  const expirySetting = settings.loyalty_points_expiry || 'none';
  let expiryDate = null;
  if (expirySetting !== 'none') {
    const days = parseInt(expirySetting, 10) || 0;
    if (days > 0) {
      // Calculate expiry date (YYYY-MM-DD)
      const date = new Date();
      date.setDate(date.getDate() + days);
      expiryDate = date.toISOString().slice(0, 10);
    }
  }

  // Update customer loyalty points
  db.run('UPDATE customers SET loyalty_points = loyalty_points + ? WHERE id = ?', [earned, customerId]);
  
  const customer = db.get('SELECT loyalty_points FROM customers WHERE id = ?', [customerId]);
  const balanceAfter = customer ? customer.loyalty_points : earned;

  // Insert EARN transaction
  db.run(`
    INSERT INTO loyalty_transactions (customer_id, invoice_id, type, points, balance_after, note, points_remaining, expiry_date)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `, [
    customerId,
    invoiceId,
    'EARN',
    earned,
    balanceAfter,
    `Earned on Invoice #${invoiceId}`,
    earned,
    expiryDate
  ]);

  return earned;
}

/**
 * Deducts points for redemption using FIFO
 * @param {number} customerId 
 * @param {number} invoiceId 
 * @param {number} pointsToRedeem 
 * @param {object} settings 
 * @returns {number} Points redeemed
 */
function redeemPoints(customerId, invoiceId, pointsToRedeem, settings) {
  if (settings.enable_loyalty_points !== 'true') return 0;
  if (pointsToRedeem <= 0) return 0;

  // Sweep expired points first
  checkAndExpirePoints(customerId);

  const customer = db.get('SELECT loyalty_points FROM customers WHERE id = ?', [customerId]);
  if (!customer) return 0;

  // Clamp redemption to available points
  const redeemAmount = Math.min(customer.loyalty_points, pointsToRedeem);
  if (redeemAmount <= 0) return 0;

  // Deduct from EARN transactions in FIFO order
  const activeTx = db.all(`
    SELECT * FROM loyalty_transactions
    WHERE customer_id = ?
      AND points_remaining > 0
      AND (expiry_date IS NULL OR expiry_date >= date('now', 'localtime'))
    ORDER BY created_at ASC
  `, [customerId]);

  let remaining = redeemAmount;
  for (const tx of activeTx) {
    if (remaining <= 0) break;
    const deduct = Math.min(tx.points_remaining, remaining);
    
    db.run(`
      UPDATE loyalty_transactions 
      SET points_remaining = points_remaining - ? 
      WHERE id = ?
    `, [deduct, tx.id]);
    
    remaining -= deduct;
  }

  // Update customer loyalty points
  db.run('UPDATE customers SET loyalty_points = loyalty_points - ? WHERE id = ?', [redeemAmount, customerId]);

  const updatedCustomer = db.get('SELECT loyalty_points FROM customers WHERE id = ?', [customerId]);
  const balanceAfter = updatedCustomer ? updatedCustomer.loyalty_points : 0;

  // Insert REDEEM transaction
  db.run(`
    INSERT INTO loyalty_transactions (customer_id, invoice_id, type, points, balance_after, note, points_remaining, expiry_date)
    VALUES (?, ?, ?, ?, ?, ?, ?, NULL)
  `, [
    customerId,
    invoiceId,
    'REDEEM',
    -redeemAmount,
    balanceAfter,
    `Redeemed on Invoice #${invoiceId}`,
    0
  ]);

  return redeemAmount;
}

/**
 * Reverses points earned on a specific invoice (proportionally or fully)
 * @param {number} customerId 
 * @param {number} invoiceId 
 * @param {number} pointsToReverse 
 * @param {string} note 
 * @returns {number} Points reversed
 */
function reverseEarnedPoints(customerId, invoiceId, pointsToReverse, note) {
  if (pointsToReverse <= 0) return 0;

  // First sweep expired points
  checkAndExpirePoints(customerId);

  const customer = db.get('SELECT loyalty_points FROM customers WHERE id = ?', [customerId]);
  if (!customer) return 0;

  const actualReverse = Math.min(customer.loyalty_points, pointsToReverse);
  if (actualReverse <= 0) return 0;

  // Deduct points_remaining of the original EARN transaction for this invoice first
  const invoiceEarnTx = db.get(`
    SELECT * FROM loyalty_transactions 
    WHERE customer_id = ? AND invoice_id = ? AND type = 'EARN' AND points_remaining > 0
    LIMIT 1
  `, [customerId, invoiceId]);

  let remaining = actualReverse;
  if (invoiceEarnTx) {
    const deduct = Math.min(invoiceEarnTx.points_remaining, remaining);
    db.run(`
      UPDATE loyalty_transactions 
      SET points_remaining = points_remaining - ? 
      WHERE id = ?
    `, [deduct, invoiceEarnTx.id]);
    remaining -= deduct;
  }

  // If there are still points to reverse (i.e. the customer already spent them, but we reverse anyway),
  // we deduct points_remaining from other active EARN transactions to maintain balance consistency.
  if (remaining > 0) {
    const activeTx = db.all(`
      SELECT * FROM loyalty_transactions
      WHERE customer_id = ?
        AND points_remaining > 0
        AND (expiry_date IS NULL OR expiry_date >= date('now', 'localtime'))
      ORDER BY created_at ASC
    `, [customerId]);

    for (const tx of activeTx) {
      if (remaining <= 0) break;
      const deduct = Math.min(tx.points_remaining, remaining);
      db.run(`
        UPDATE loyalty_transactions 
        SET points_remaining = points_remaining - ? 
        WHERE id = ?
      `, [deduct, tx.id]);
      remaining -= deduct;
    }
  }

  // Update customer loyalty points safely (avoid direct MAX keyword in UPDATE)
  const newPoints = Math.max(0, customer.loyalty_points - actualReverse);
  db.run('UPDATE customers SET loyalty_points = ? WHERE id = ?', [newPoints, customerId]);

  const updatedCustomer = db.get('SELECT loyalty_points FROM customers WHERE id = ?', [customerId]);
  const balanceAfter = updatedCustomer ? updatedCustomer.loyalty_points : 0;

  // Insert REVERSAL transaction
  db.run(`
    INSERT INTO loyalty_transactions (customer_id, invoice_id, type, points, balance_after, note, points_remaining, expiry_date)
    VALUES (?, ?, ?, ?, ?, ?, ?, NULL)
  `, [
    customerId,
    invoiceId,
    'REVERSAL',
    -actualReverse,
    balanceAfter,
    note || `Reversed for Invoice #${invoiceId}`,
    0
  ]);

  return actualReverse;
}

module.exports = {
  checkAndExpirePoints,
  earnPoints,
  redeemPoints,
  reverseEarnedPoints
};
