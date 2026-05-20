/**
 * Utility functions for Maze ERP
 */

/**
 * Formats a number as Indian Rupee (INR) currency string.
 * @param {number|string} amount 
 * @returns {string}
 */
export const formatCurrency = (amount) => {
    const num = Number(amount) || 0;
    return new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency: 'INR',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    }).format(num);
};

/**
 * Formats a date string to a readable format.
 * @param {string|Date} date 
 * @param {boolean} includeTime 
 * @returns {string}
 */
export const formatDate = (date, includeTime = false) => {
    if (!date) return '—';
    const d = new Date(date);
    if (isNaN(d.getTime())) return '—';
    
    const options = {
        day: '2-digit',
        month: 'short',
        year: 'numeric'
    };
    
    if (includeTime) {
        options.hour = '2-digit',
        options.minute = '2-digit'
    }
    
    return d.toLocaleDateString('en-IN', options);
};

/**
 * Formats a date string to a short version (e.g. 12 Mar)
 * @param {string|Date} date 
 * @returns {string}
 */
export const formatDateShort = (date) => {
    if (!date) return '—';
    const d = new Date(date);
    if (isNaN(d.getTime())) return '—';
    return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
};

/**
 * Validates product data before save.
 * @param {Object} product 
 * @returns {string|null} Error message or null if valid
 */
export const validateProduct = (product) => {
    const errors = [];
    if (!product.name || !product.name.trim()) errors.push('Product name is required');
    if (Number(product.selling_price) < 0) errors.push('Selling price cannot be negative');
    if (Number(product.cost_price) < 0) errors.push('Cost price cannot be negative');
    return errors;
};

/**
 * Validates customer data before save.
 * @param {Object} customer 
 * @returns {string|null} Error message or null if valid
 */
export const validateCustomer = (customer) => {
    if (!customer.name || !customer.name.trim()) return 'Customer name is required';
    if (customer.phone && !/^\+?[\d\s-]{10,}$/.test(customer.phone)) return 'Invalid phone number format';
    return null;
};

/**
 * Converts a number to Indian Rupee amount in words.
 * @param {number} amount 
 * @returns {string}
 */
export const amountToWords = (amount) => {
    const a = Number(amount) || 0;
    if (a === 0) return 'Zero Rupees only';

    const single = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine'];
    const double = ['Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
    const tens = ['', 'Ten', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

    const formatTowsDigits = (n) => {
        if (n === 0) return '';
        if (n < 10) return single[n];
        if (n < 20) return double[n - 10];
        const t = Math.floor(n / 10);
        const s = n % 10;
        return tens[t] + (s > 0 ? ' ' + single[s] : '');
    };

    const res = [];
    let n = Math.floor(a);
    const paise = Math.round((a - n) * 100);

    if (n >= 10000000) {
        const crore = Math.floor(n / 10000000);
        res.push(formatTowsDigits(crore) + ' Crore');
        n %= 10000000;
    }
    if (n >= 100000) {
        const lakh = Math.floor(n / 100000);
        res.push(formatTowsDigits(lakh) + ' Lakh');
        n %= 100000;
    }
    if (n >= 1000) {
        const thousand = Math.floor(n / 1000);
        res.push(formatTowsDigits(thousand) + ' Thousand');
        n %= 1000;
    }
    if (n >= 100) {
        const hundred = Math.floor(n / 100);
        res.push(formatTowsDigits(hundred) + ' Hundred');
        n %= 100;
    }
    if (n > 0) {
        res.push(formatTowsDigits(n));
    }

    let finalStr = res.join(' ') + ' Rupees';
    if (paise > 0) {
        finalStr += ' and ' + formatTowsDigits(paise) + ' Paise';
    }
    return finalStr + ' only';
};

/**
 * Calculates a tax summary grouped by HSN/SAC code.
 * @param {Array} items 
 * @returns {Array} List of { hsn, taxable_amount, igst_rate, igst_amount, total_tax }
 */
export const calculateTaxSummary = (items) => {
    const summaryMap = {};

    (items || []).forEach(item => {
        const hsn = item.hsn_sac || item.product_hsn || '—';
        const qty = Number(item.quantity || 0);
        const price = Number(item.price || 0);
        const discRate = Number(item.item_discount_rate || 0);
        const gstRate = Number(item.item_gst_rate || 0);

        const baseAmount = price * qty;
        const discountAmount = baseAmount * (discRate / 100);
        const taxableAmount = baseAmount - discountAmount;
        const gstAmount = taxableAmount * (gstRate / 100);

        if (!summaryMap[hsn]) {
            summaryMap[hsn] = {
                hsn: hsn,
                taxable_amount: 0,
                igst_rate: gstRate, // Assuming single rate per HSN for now
                igst_amount: 0,
                total_tax: 0
            };
        }

        summaryMap[hsn].taxable_amount += taxableAmount;
        summaryMap[hsn].igst_amount += gstAmount;
        summaryMap[hsn].total_tax += gstAmount;
    });

    return Object.values(summaryMap);
};

