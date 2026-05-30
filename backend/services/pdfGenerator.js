const PDFDocument = require('pdfkit');

function generateInvoicePDF(invoice, settings) {
    return new Promise((resolve, reject) => {
        const doc = new PDFDocument({ margin: 50, size: 'A4' });
        const buffers = [];
        
        doc.on('data', buffers.push.bind(buffers));
        doc.on('end', () => {
            const pdfData = Buffer.concat(buffers);
            resolve(pdfData);
        });
        doc.on('error', reject);

        const companyName = settings.company_name || 'Maze ERP';
        const address = settings.address || '';
        const phone = settings.phone || '';
        const email = settings.email || '';
        const gstin = settings.gstin || '';
        const upiId = settings.upi_id || '';

        // Decode logo if present
        let logoBuffer = null;
        const logoUrl = settings.logo_url || settings.company_logo;
        if (logoUrl) {
            try {
                if (logoUrl.startsWith('data:image/')) {
                    const base64Data = logoUrl.replace(/^data:image\/\w+;base64,/, "");
                    logoBuffer = Buffer.from(base64Data, 'base64');
                } else if (!logoUrl.startsWith('http://') && !logoUrl.startsWith('https://')) {
                    const fs = require('fs');
                    if (fs.existsSync(logoUrl)) {
                        logoBuffer = fs.readFileSync(logoUrl);
                    }
                }
            } catch (e) {
                console.error('Failed to parse logo for PDF:', e.message);
            }
        }

        // Draw Header
        let companyX = 50;
        if (logoBuffer) {
            try {
                doc.image(logoBuffer, 50, 45, { fit: [120, 50] });
                companyX = 190;
            } catch (imageErr) {
                console.error('Error drawing logo image on PDF:', imageErr.message);
                companyX = 50;
            }
        }

        doc.fillColor('#0f172a').fontSize(18).text(companyName, companyX, 50, { width: 340 - companyX });
        doc.fontSize(9).fillColor('#64748b');
        let headerY = 72;
        if (address) {
            doc.text(address, companyX, headerY, { width: 340 - companyX });
            headerY += doc.heightOfString(address, { width: 340 - companyX }) + 2;
        }
        const contactInfo = `${phone ? `Phone: ${phone}` : ''} ${email ? `| Email: ${email}` : ''}`.trim();
        if (contactInfo) {
            doc.text(contactInfo, companyX, headerY, { width: 340 - companyX });
            headerY += doc.heightOfString(contactInfo, { width: 340 - companyX }) + 2;
        }
        if (gstin) {
            doc.text(`GSTIN: ${gstin}`, companyX, headerY, { width: 340 - companyX });
            headerY += 12;
        }


        // Invoice Title and Info (Right side)
        doc.fillColor('#0f172a').fontSize(16).text('TAX INVOICE', 400, 50, { align: 'right' });
        doc.fontSize(10).fillColor('#64748b');
        const invoiceNum = `INV-${String(invoice.id).padStart(4, '0')}`;
        doc.text(`Invoice No: ${invoiceNum}`, 400, 70, { align: 'right' });
        doc.text(`Date: ${invoice.date || invoice.created_at || ''}`, 400, 85, { align: 'right' });
        
        const displayStatus = invoice.payment_status || 'Paid';
        doc.text(`Status: ${displayStatus}`, 400, 100, { align: 'right' });

        // Line separator
        doc.moveTo(50, 130).lineTo(550, 130).stroke('#e2e8f0');

        // Billed To (Left side)
        let customerName = invoice.customer_name;
        let customerPhone = invoice.customer_phone;
        let customerEmail = invoice.customer_email;
        if (!customerName) {
            customerName = invoice.walk_in_name || 'Walk-in Customer';
            customerPhone = invoice.walk_in_phone || '';
        }

        doc.fontSize(11).fillColor('#0f172a').text('BILL TO', 50, 145, { underline: true });
        doc.fontSize(10).fillColor('#334155');
        doc.text(customerName, 50, 160);
        if (customerPhone) doc.text(`Phone: ${customerPhone}`);
        if (customerEmail) doc.text(`Email: ${customerEmail}`);
        if (invoice.customer_gstin || invoice.gstin) doc.text(`GSTIN: ${invoice.customer_gstin || invoice.gstin}`);
        
        if (settings.show_category_in_invoice !== 'false') {
            const billedCategories = [...new Set((invoice.items || []).map(item => item.category).filter(Boolean))].join(', ') || 'General';
            doc.text(`Product Cat: ${billedCategories}`);
        }

        doc.moveDown(2);

        // Table Header
        let tableTop = doc.y + 10;
        doc.fillColor('#f8fafc').rect(50, tableTop, 500, 20).fill();
        doc.fillColor('#475569').fontSize(9);
        doc.text('Item / Description', 60, tableTop + 6, { width: 250 });
        doc.text('Qty', 320, tableTop + 6, { width: 40, align: 'center' });
        doc.text('Price', 370, tableTop + 6, { width: 80, align: 'right' });
        doc.text('Total', 460, tableTop + 6, { width: 80, align: 'right' });

        let currentY = tableTop + 20;

        // Items List
        const items = invoice.items || [];
        items.forEach(item => {
            doc.fillColor('#334155').fontSize(9);
            let itemName = `${item.product_name || item.name || ''} ${item.variant_name ? `(${item.variant_name})` : ''}`;
            doc.text(itemName, 60, currentY + 6, { width: 250 });
            doc.text(String(item.quantity), 320, currentY + 6, { width: 40, align: 'center' });
            doc.text(`₹${Number(item.price).toFixed(2)}`, 370, currentY + 6, { width: 80, align: 'right' });
            doc.text(`₹${Number(item.total).toFixed(2)}`, 460, currentY + 6, { width: 80, align: 'right' });

            // Border bottom for row
            doc.moveTo(50, currentY + 20).lineTo(550, currentY + 20).stroke('#f1f5f9');
            currentY += 20;
        });

        // Totals Summary
        currentY += 10;
        const subtotal = items.reduce((sum, item) => sum + Number(item.total), 0);
        const displayTotal = invoice.total_amount || invoice.effective_total || invoice.total || subtotal;
        const discountRate = Number(invoice.discount_rate || 0);
        const discountAmount = invoice.discount_amount || (subtotal * (discountRate / 100));
        const couponDiscountAmount = Number(invoice.coupon_discount_amount || 0);
        const paidAmount = Number(invoice.paid_amount || 0);
        const dueAmount = displayTotal - paidAmount;

        doc.fillColor('#475569').fontSize(9);
        
        doc.text('Subtotal:', 350, currentY, { width: 100, align: 'right' });
        doc.text(`₹${subtotal.toFixed(2)}`, 460, currentY, { width: 80, align: 'right' });
        currentY += 15;

        if (discountAmount > 0) {
            doc.text('Discount:', 350, currentY, { width: 100, align: 'right' });
            doc.text(`-₹${discountAmount.toFixed(2)}`, 460, currentY, { width: 80, align: 'right' });
            currentY += 15;
        }

        if (couponDiscountAmount > 0) {
            doc.text('Coupon Disc:', 350, currentY, { width: 100, align: 'right' });
            doc.text(`-₹${couponDiscountAmount.toFixed(2)}`, 460, currentY, { width: 80, align: 'right' });
            currentY += 15;
        }

        doc.fillColor('#0f172a').fontSize(11).font('Helvetica-Bold');
        doc.text('Grand Total:', 350, currentY, { width: 100, align: 'right' });
        doc.text(`₹${displayTotal.toFixed(2)}`, 460, currentY, { width: 80, align: 'right' });
        doc.font('Helvetica');
        currentY += 20;

        doc.fillColor('#475569').fontSize(9);
        doc.text('Paid Amount:', 350, currentY, { width: 100, align: 'right' });
        doc.text(`₹${paidAmount.toFixed(2)}`, 460, currentY, { width: 80, align: 'right' });
        currentY += 15;

        doc.fillColor(dueAmount > 0 ? '#ef4444' : '#334155').font('Helvetica-Bold');
        doc.text('Due Amount:', 350, currentY, { width: 100, align: 'right' });
        doc.text(`₹${Math.max(0, dueAmount).toFixed(2)}`, 460, currentY, { width: 80, align: 'right' });
        doc.font('Helvetica');

        // Bank Details & Footer
        currentY += 30;
        if (settings.bank_name || upiId) {
            doc.fillColor('#0f172a').fontSize(10).font('Helvetica-Bold').text('Payment Information', 50, currentY);
            doc.font('Helvetica').fontSize(9).fillColor('#475569');
            currentY += 12;
            if (settings.bank_name) {
                doc.text(`Bank Name: ${settings.bank_name}`, 50, currentY);
                doc.text(`Acc No: ${settings.account_number || ''}`, 50, currentY + 12);
                doc.text(`IFSC: ${settings.ifsc_code || ''}`, 50, currentY + 24);
                doc.text(`Holder: ${settings.account_holder_name || ''}`, 50, currentY + 36);
                currentY += 48;
            }
            if (upiId) {
                doc.text(`UPI ID: ${upiId}`, 50, currentY);
                currentY += 15;
            }
        }

        // Terms and conditions
        if (settings.terms_and_conditions) {
            currentY += 10;
            doc.fillColor('#0f172a').fontSize(10).font('Helvetica-Bold').text('Terms & Conditions', 50, currentY);
            doc.font('Helvetica').fontSize(8).fillColor('#64748b');
            doc.text(settings.terms_and_conditions, 50, currentY + 12, { width: 450 });
        }

        doc.end();
    });
}

module.exports = { generateInvoicePDF };
