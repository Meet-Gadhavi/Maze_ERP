const db = require('../db');

const API_KEY = 'sk-k5fhJ3AfyQ4VJdsVaWzW78qQgVye8KwWjLIqrxYe1gfYvVA37bVmlHjRyCPYh10e';
const BASE_URL = 'https://opencode.ai/zen/v1';

/**
 * Formats a phone number to standard 12-digit format (e.g. 919876543210).
 */
function formatPhone(phone) {
    if (!phone) return '';
    const cleaned = phone.replace(/\D/g, '');
    if (cleaned.length === 10) {
        return '91' + cleaned;
    }
    return cleaned;
}

/**
 * Fetches the outstanding balance, invoices, payments history for a customer to build ERP context.
 */
function getCustomerContext(customerId) {
    if (!customerId) return 'Customer Context: Unregistered Lead.';

    const customer = db.get("SELECT * FROM customers WHERE id = ?", [customerId]);
    if (!customer) return 'Customer Context: Not found.';

    const invoices = db.all("SELECT * FROM invoices WHERE customer_id = ? ORDER BY date DESC", [customerId]);
    let invoicesText = '';
    let totalDue = 0;

    invoices.forEach(inv => {
        const items = db.all("SELECT * FROM invoice_items WHERE invoice_id = ?", [inv.id]);
        const payments = db.all("SELECT * FROM invoice_payments WHERE invoice_id = ?", [inv.id]);
        const itemsList = items.map(i => `${i.product_name} (${i.quantity} ${i.unit} @ ₹${i.price})`).join(', ');
        const totalPaid = payments.reduce((sum, p) => sum + Number(p.amount), 0);
        const due = Math.max(0, Number(inv.total) - totalPaid);
        totalDue += due;
        invoicesText += `- Invoice INV-${String(inv.id).padStart(4, '0')}: Date: ${inv.date || 'unknown'}, Total: ₹${inv.total}, Paid: ₹${totalPaid}, Due: ₹${due}, Delivery: ${inv.delivery_status || 'unknown'}. Items: ${itemsList}\n`;
    });

    return `
Customer ERP Context:
Name: ${customer.name}
Phone: ${customer.phone || 'None'}
Email: ${customer.email || 'None'}
Address: ${customer.address || 'None'}
Wallet/P-Credit Balance: ₹${customer.p_credit_balance || 0}
Credit Limit: ₹${customer.credit_limit || 0}
Total Outstanding Due: ₹${totalDue}

Invoice History:
${invoicesText || 'No invoice history found.'}
`;
}

/**
 * Fetches top products from the catalog to build pricing and stock context.
 */
function getProductsContext() {
    const products = db.all("SELECT name, selling_price, stock_quantity, unit, product_code FROM products LIMIT 50");
    const productsText = products.map(p => `- ${p.name}: Price: ₹${p.selling_price}, Stock: ${p.stock_quantity} ${p.unit} (Code: ${p.product_code || 'None'})`).join('\n');
    return `Available Products in ERP Catalog:\n${productsText || 'No products available.'}`;
}

/**
 * Fetches recent message history for the customer.
 */
function getChatHistory(customerId, phone, email) {
    let recentLogs = [];
    if (customerId) {
        recentLogs = db.all(
            `SELECT * FROM customer_communication_logs 
             WHERE customer_id = ? 
             ORDER BY date DESC LIMIT 6`,
            [customerId]
        );
    } else {
        const queryParams = [];
        let querySql = `SELECT * FROM customer_communication_logs WHERE 1=0`;
        if (phone) {
            querySql += ` OR notes LIKE ?`;
            queryParams.push(`%${phone}%`);
        }
        if (email) {
            querySql += ` OR notes LIKE ?`;
            queryParams.push(`%${email}%`);
        }
        recentLogs = db.all(`${querySql} ORDER BY date DESC LIMIT 6`, queryParams);
    }

    recentLogs.reverse(); // Chronological order
    return recentLogs.map(l => {
        const direction = l.notes.startsWith('Received') ? 'Customer' : 'AI Assistant';
        // Strip prefixes for clean prompt logs
        const cleanNotes = l.notes
            .replace(/^Received (WhatsApp|Email):\s*/i, '')
            .replace(/^AI Auto-Reply:\s*/i, '');
        return `${direction}: ${cleanNotes}`;
    }).join('\n');
}

/**
 * Calls OpenCode Zen API for completions with fallback.
 */
async function callLlm(systemPrompt, userMessage) {
    const models = ['deepseek-v4-flash-free', 'nemotron-3-super-free'];
    let errorMsg = '';

    for (const model of models) {
        try {
            console.log(`[AI Reply] Calling ${model}...`);
            const res = await fetch(`${BASE_URL}/chat/completions`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${API_KEY}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    model: model,
                    messages: [
                        { role: 'system', content: systemPrompt },
                        { role: 'user', content: userMessage }
                    ],
                    temperature: 0.2
                })
            });

            if (res.ok) {
                const data = await res.json();
                const content = data.choices?.[0]?.message?.content;
                if (content) {
                    console.log(`[AI Reply] Completion successful with ${model}`);
                    return content;
                }
            } else {
                const text = await res.text();
                console.warn(`[AI Reply] Model ${model} failed with status ${res.status}:`, text);
                errorMsg = `Status ${res.status}: ${text}`;
            }
        } catch (e) {
            console.error(`[AI Reply] Fetch error for ${model}:`, e);
            errorMsg = e.message;
        }
    }

    throw new Error(`AI generation failed across all models. Last error: ${errorMsg}`);
}

const aiReplyService = {
    async processIncomingMessage({ customerId, text, channel, phone, email }) {
        try {
            await db.ready;
            
            // Check plan status
            const licensePlanRow = db.get("SELECT value FROM settings WHERE key = 'license_plan'");
            const licensePlan = licensePlanRow ? licensePlanRow.value : 'Free';
            if (licensePlan !== 'Professional') {
                console.log(`[AI Reply] Bypassing AI Auto-Reply. Current Plan: ${licensePlan} (Requires Professional)`);
                return "Thank you for reaching out. We have received your query and our team will get back to you shortly.";
            }
            
            // Build Context
            const customerContext = getCustomerContext(customerId);
            const productsContext = getProductsContext();
            const historyContext = getChatHistory(customerId, phone, email);

            const systemPrompt = `
You are Quantro ERP's AI Assistant. You handle customer communication via ${channel}.
Your goal is to assist customers using live data from the ERP database and process order queries.

CURRENT TIME: ${new Date().toLocaleString()}

${customerContext}

${productsContext}

Recent Conversation History:
${historyContext || 'No previous conversation history.'}

INSTRUCTIONS:
1. Identify the intent of the customer's query:
   - "Order/Sales query": Customer wants to buy/order products (e.g., "I want 1 HP Victus").
   - "Normal/Support query": Customer is asking about invoices, payments, outstanding balance, or general info.
   
2. For Normal/Support query:
   - Use the ERP context to provide direct, precise answers (e.g., "Your outstanding due is ₹500", "You paid ₹45 on invoice INV-0002, so you have ₹55 left").
   - Keep replies professional, friendly, and concise.

3. For Order/Sales query:
   - Check if the customer is already registered (represented by the presence of customer details in customerContext).
   - If Customer is NOT found (i.e., this is an unregistered lead placeholder):
     - Check the conversation history to see if the user has already provided their details (Name, Phone, Email, Address).
     - If details are missing, ask for them politely. We need: Name, Phone, Email, Address. Ask for only the missing details.
     - Once all details (Name, Phone, Email, Address) have been gathered (either in this message or across the history), output the structured JSON tag:
       <CREATE_CUSTOMER>{"name": "...", "phone": "...", "email": "...", "address": "..."}</CREATE_CUSTOMER>
       And also output the order tag:
       <CREATE_ORDER>{"items": [{"name": "...", "quantity": ...}], "notes": "..."}</CREATE_ORDER>
       And say: "Order accepted! Our team is processing it."
   - If Customer IS found (i.e. already registered in ERP):
     - Output the structured JSON tag:
       <CREATE_ORDER>{"items": [{"name": "...", "quantity": ...}], "notes": "..."}</CREATE_ORDER>
       And say: "Order accepted! Our team is processing it."

Always keep your replies natural. The XML tags like <CREATE_CUSTOMER> and <CREATE_ORDER> are stripped from the message before it is sent to the customer, so write your reply as if the action is complete or you are asking for info, and append the tags at the end.
`;

            const llmOutput = await callLlm(systemPrompt, text);
            console.log('[AI Reply] Raw Output:', llmOutput);

            let activeCustomerId = customerId;

            // Parse Customer Creation
            const createCustomerMatch = llmOutput.match(/<CREATE_CUSTOMER>([\s\S]*?)<\/CREATE_CUSTOMER>/);
            if (createCustomerMatch) {
                try {
                    const custData = JSON.parse(createCustomerMatch[1].trim());
                    const name = custData.name || 'AI Customer';
                    const custPhone = custData.phone || phone || '';
                    const custEmail = custData.email || email || '';
                    const address = custData.address || '';

                    if (activeCustomerId) {
                        // Update existing lead placeholder
                        db.run(
                            "UPDATE customers SET name = ?, phone = ?, email = ?, address = ? WHERE id = ?",
                            [name, custPhone, custEmail, address, activeCustomerId]
                        );
                        console.log(`[AI Reply] Updated Lead Placeholder to customer: ${name} (ID: ${activeCustomerId})`);
                    } else {
                        // Insert new customer
                        const res = db.run(
                            "INSERT INTO customers (name, phone, email, address) VALUES (?, ?, ?, ?)",
                            [name, custPhone, custEmail, address]
                        );
                        activeCustomerId = res.lastInsertRowid;
                        console.log(`[AI Reply] Created new customer: ${name} (ID: ${activeCustomerId})`);
                    }
                } catch (e) {
                    console.error('[AI Reply] Failed to parse/create customer:', e);
                }
            }

            // Parse Order Creation
            const createOrderMatch = llmOutput.match(/<CREATE_ORDER>([\s\S]*?)<\/CREATE_ORDER>/);
            if (createOrderMatch) {
                try {
                    const orderData = JSON.parse(createOrderMatch[1].trim());
                    let total = 0;
                    const itemsWithPrice = [];

                    for (const item of orderData.items) {
                        let prod = db.get("SELECT * FROM products WHERE LOWER(name) = ? OR LOWER(product_code) = ?", [item.name.toLowerCase(), item.name.toLowerCase()]);
                        if (!prod) {
                            prod = db.get("SELECT * FROM products WHERE name LIKE ? LIMIT 1", [`%${item.name}%`]);
                        }
                        const price = prod ? prod.selling_price : 100; // default price if not found
                        const qty = Number(item.quantity) || 1;
                        total += price * qty;
                        
                        itemsWithPrice.push({
                            product_id: prod ? prod.id : null,
                            name: prod ? prod.name : item.name,
                            quantity: qty,
                            price: price
                        });
                    }

                    // Fetch customer details
                    const cust = db.get("SELECT name, phone FROM customers WHERE id = ?", [activeCustomerId]);

                    // Generate a unique mazeway_id
                    const mazewayId = 'ai_' + Math.random().toString(36).substring(2, 15);

                    db.run(
                        `INSERT INTO mazeway_orders (mazeway_id, customer_name, customer_phone, items, total, notes, type, status)
                         VALUES (?, ?, ?, ?, ?, ?, ?, 'NEW')`,
                        [
                            mazewayId,
                            cust ? cust.name : 'AI Lead',
                            cust ? cust.phone : (phone || ''),
                            JSON.stringify(itemsWithPrice),
                            total,
                            orderData.notes || `AI ordered via ${channel}`,
                            channel // 'WhatsApp' or 'Email'
                        ]
                    );
                    console.log(`[AI Reply] Saved AI Sales Order: ${mazewayId} (Total: ₹${total})`);
                } catch (e) {
                    console.error('[AI Reply] Failed to parse/create order:', e);
                }
            }

            // Strip XML tags for final clean customer message
            const cleanMessage = llmOutput
                .replace(/<CREATE_CUSTOMER>[\s\S]*?<\/CREATE_CUSTOMER>/g, '')
                .replace(/<CREATE_ORDER>[\s\S]*?<\/CREATE_ORDER>/g, '')
                .trim();

            return cleanMessage;
        } catch (err) {
            console.error('[AI Reply] Error in processIncomingMessage:', err);
            return "Thank you for reaching out. We have received your query and our team will get back to you shortly.";
        }
    }
};

module.exports = aiReplyService;
