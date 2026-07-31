import { useState, useEffect, useCallback, useRef } from 'react';
import api from '../api';
import { toast } from 'sonner';
import CustomSelect from '../components/CustomSelect';
import { Icons } from '../components/Icons';
import Modal from '../components/Modal';
import SButton from '../components/SButton';
import { FormGroup, Input } from '../components/FormComponents';
import { formatDate, validateCustomer } from '../utils';
import { EMPTY_CUSTOMER } from '../constants';
import './CustomersPage.css';
import Skeleton from '../components/Skeleton';
import { LineChart } from '@mui/x-charts/LineChart';

const getInvoiceMockTemplateHtml = (customerName, settings) => {
    const companyName = (settings.company_name && settings.company_name.trim() !== '' && settings.company_name !== 'Quantro')
        ? settings.company_name
        : 'Maze ERP';
    const logoUrl = settings.logo_url || './icons/Logo.png';
    const invoiceStyle = settings.invoice_style || 'classic';

    const mockItems = [
        { product_name: 'Premium Office Chair', variant_name: 'Mesh Black', quantity: 1, price: 8500, total: 8500 },
        { product_name: 'Wireless Keyboard', variant_name: '', quantity: 1, price: 1500, total: 1500 }
    ];

    const itemsListHtml = mockItems.map(item => `
        <tr>
            <td style="padding: 10px; border-bottom: 1px solid #f1f5f9; text-align: left;">
                ${item.product_name} ${item.variant_name ? `(${item.variant_name})` : ''}
            </td>
            <td style="padding: 10px; border-bottom: 1px solid #f1f5f9; text-align: center;">${item.quantity}</td>
            <td style="padding: 10px; border-bottom: 1px solid #f1f5f9; text-align: right;">₹${item.price.toLocaleString('en-IN')}</td>
            <td style="padding: 10px; border-bottom: 1px solid #f1f5f9; text-align: right; font-weight: bold;">₹${item.total.toLocaleString('en-IN')}</td>
        </tr>
    `).join('');

    if (invoiceStyle === 'minimalist') {
        return `
            <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #334155; max-width: 100%; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 12px; background: #ffffff; box-sizing: border-box; display: flex; flex-direction: column; height: 100%;">
                <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #f1f5f9; padding-bottom: 16px; margin-bottom: 24px;">
                    <div>
                        ${logoUrl 
                            ? `<img src="${logoUrl}" alt="${companyName}" style="max-height: 40px; margin-bottom: 8px; display: block;" />` 
                            : ''
                        }
                        <h2 style="margin: 0; font-size: 20px; font-weight: 800; color: #0f172a;">${companyName}</h2>
                        <p style="margin: 4px 0 0 0; font-size: 12px; color: #64748b;">${settings.email || ''}</p>
                    </div>
                    <div style="text-align: right;">
                        <h3 style="margin: 0; font-size: 16px; font-weight: 700; color: #0f172a;">INVOICE</h3>
                        <p style="margin: 4px 0 0 0; font-size: 12px; color: #64748b;">#INV-2026-001</p>
                    </div>
                </div>
                <div style="margin-bottom: 24px;">
                    <h4 style="margin: 0 0 8px 0; font-size: 12px; text-transform: uppercase; color: #94a3b8; letter-spacing: 0.05em;">Billed To</h4>
                    <p style="margin: 0; font-weight: 600; color: #1e293b;">${customerName}</p>
                </div>
                <table style="width: 100%; border-collapse: collapse; margin-bottom: 24px; font-size: 13px;">
                    <thead>
                        <tr style="background: #f8fafc;">
                            <th style="padding: 10px; border-bottom: 1px solid #e2e8f0; text-align: left; font-weight: 600; color: #475569;">Item</th>
                            <th style="padding: 10px; border-bottom: 1px solid #e2e8f0; text-align: center; font-weight: 600; color: #475569;">Qty</th>
                            <th style="padding: 10px; border-bottom: 1px solid #e2e8f0; text-align: right; font-weight: 600; color: #475569;">Price</th>
                            <th style="padding: 10px; border-bottom: 1px solid #e2e8f0; text-align: right; font-weight: 600; color: #475569;">Total</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${itemsListHtml}
                    </tbody>
                </table>
                <div style="width: 200px; margin-left: auto; font-size: 13px; margin-top: auto;">
                    <div style="display: flex; justify-content: space-between; padding: 6px 0; color: #475569;">
                        <span>Subtotal</span>
                        <span>₹10,000</span>
                    </div>
                    <div style="display: flex; justify-content: space-between; padding: 10px 0; border-top: 1px solid #0f172a; font-weight: 700; color: #0f172a; font-size: 15px; margin-top: 8px;">
                        <span>Grand Total</span>
                        <span>₹10,000</span>
                    </div>
                </div>
            </div>
        `;
    }

    // Default / Classic layout
    return `
        <div style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; max-width: 100%; margin: 0 auto; background: #f8fafc; padding: 12px; box-sizing: border-box; height: 100%; display: flex; flex-direction: column;">
            <div style="background: #ffffff; border-radius: 8px; border: 1px solid #eaecf0; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05); padding: 24px; flex: 1; display: flex; flex-direction: column;">
                <div style="border-bottom: 2px solid #3b82f6; padding-bottom: 16px; margin-bottom: 20px; display: flex; justify-content: space-between; align-items: center;">
                    ${logoUrl 
                        ? `<img src="${logoUrl}" alt="${companyName}" style="max-height: 35px; display: block;" />`
                        : `<span style="font-size: 20px; font-weight: bold; color: #1e3a8a;">${companyName}</span>`
                    }
                    <span style="font-size: 12px; background: #eff6ff; color: #1e40af; padding: 4px 10px; border-radius: 20px; font-weight: 600; text-transform: uppercase;">Invoice Due</span>
                </div>
                <div style="font-size: 13px; line-height: 1.5; color: #4b5563; margin-bottom: 20px;">
                    <p>Dear <strong>${customerName}</strong>,</p>
                    <p>Thank you for shopping with us. We have generated invoice <strong>#INV-2026-001</strong> for your recent purchase.</p>
                </div>
                <div style="background: #f9fafb; border-radius: 6px; border: 1px solid #f3f4f6; padding: 12px; margin-bottom: 20px;">
                    <table style="width: 100%; font-size: 12px; color: #4b5563;">
                        <tr>
                            <td style="padding: 2px 0; color: #9ca3af;">Invoice Number:</td>
                            <td style="padding: 2px 0; text-align: right; font-weight: 600;">#INV-2026-001</td>
                        </tr>
                        <tr>
                            <td style="padding: 2px 0; color: #9ca3af;">Date:</td>
                            <td style="padding: 2px 0; text-align: right; font-weight: 600;">${new Date().toLocaleDateString('en-IN')}</td>
                        </tr>
                        <tr>
                            <td style="padding: 2px 0; color: #9ca3af;">Total Amount:</td>
                            <td style="padding: 2px 0; text-align: right; font-weight: bold; color: #111827; font-size: 13.5px;">₹10,000</td>
                        </tr>
                    </table>
                </div>
                <h4 style="margin: 0 0 8px 0; font-size: 13px; color: #111827; border-bottom: 1px solid #e5e7eb; padding-bottom: 4px;">Purchase Summary</h4>
                <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px; font-size: 12px; color: #4b5563;">
                    <thead>
                        <tr style="color: #9ca3af;">
                            <th style="padding: 4px 0; border-bottom: 1px solid #e5e7eb; text-align: left;">Product</th>
                            <th style="padding: 4px 0; border-bottom: 1px solid #e5e7eb; text-align: center; width: 40px;">Qty</th>
                            <th style="padding: 4px 0; border-bottom: 1px solid #e5e7eb; text-align: right; width: 80px;">Price</th>
                            <th style="padding: 4px 0; border-bottom: 1px solid #e5e7eb; text-align: right; width: 80px;">Total</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${itemsListHtml}
                    </tbody>
                </table>
                <div style="font-size: 11px; color: #9ca3af; text-align: center; line-height: 1.5; border-top: 1px solid #e5e7eb; padding-top: 16px; margin-top: auto;">
                    <p>${companyName} | Phone: ${settings.phone || ''} | Email: ${settings.email || ''}</p>
                </div>
            </div>
        </div>
    `;
};

const wrapCampaignPreviewHtml = (title, customerName, innerContent, settings) => {
    const companyName = (settings.company_name && settings.company_name.trim() !== '' && settings.company_name !== 'Quantro')
        ? settings.company_name
        : 'Maze ERP';
    const logoUrl = settings.logo_url || './icons/Logo.png';
    const logoHtml = logoUrl 
        ? `<img src="${logoUrl}" alt="${companyName}" style="max-height: 40px; margin-bottom: 12px; display: inline-block;" />` 
        : '';
    return `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 100%; margin: 0 auto; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; box-shadow: 0 4px 6px rgba(0,0,0,0.05); overflow: hidden; height: 100%; display: flex; flex-direction: column;">
            <div style="background: linear-gradient(135deg, #1e3a8a, #3b82f6); padding: 24px; text-align: center; color: #ffffff;">
                ${logoHtml}
                <div style="font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.1em; color: #93c5fd; margin-bottom: 4px;">${companyName}</div>
                <h2 style="margin: 0; font-size: 20px; font-weight: 800;">${title}</h2>
            </div>
            <div style="padding: 24px; color: #334155; line-height: 1.5; font-size: 13.5px; flex: 1;">
                <p style="margin: 0 0 12px 0;">Hello <strong>${customerName}</strong>,</p>
                ${innerContent}
            </div>
            <div style="background: #f8fafc; padding: 18px; text-align: center; font-size: 11px; color: #64748b; border-top: 1px solid #f1f5f9;">
                <p style="margin: 0 0 4px 0; font-weight: bold; color: #334155;">${companyName}</p>
                <p style="margin: 0;">Support: ${settings.email || ''} | Phone: ${settings.phone || ''}</p>
            </div>
        </div>
    `;
};

const getWhatsAppTemplateText = (templateType, customerName, settings) => {
    const companyName = (settings.company_name && settings.company_name.trim() !== '' && settings.company_name !== 'Quantro')
        ? settings.company_name
        : 'Maze ERP';

    if (templateType === 'due_balance') {
        return `Outstanding Due Reminder:\n\nDear ${customerName},\n\nYou have an outstanding due balance of ₹5,000 at ${companyName}. Please clear your balance as soon as possible. Thank you!\n\nSupport: ${settings.email || 'N/A'}\nPhone: ${settings.phone || 'N/A'}`;
    }
    if (templateType === 'festival_offer') {
        return `Festival Sale Greetings!\n\nDear ${customerName},\n\nCelebrate this festive season with our exclusive Diwali/Holi/Eid sale. Enjoy special deals and discounts on all our products! Visit us today!\n\nBest regards,\n${companyName}`;
    }
    if (templateType === 'discount_coupon') {
        return `Exclusive Discount!\n\nDear ${customerName},\n\nHere is your exclusive promo code: WELCOME10.\nUse this code at checkout to claim 10% Flat Discount on your next order! Valid for a limited time.\n\nBest regards,\n${companyName}`;
    }
    if (templateType === 'new_arrivals') {
        return `New Arrivals!\n\nDear ${customerName},\n\nWe have just launched our brand new products and latest collections. Check them out today before they sell out!\n\nBest regards,\n${companyName}`;
    }
    if (templateType === 'flash_sale') {
        return `Flash Sale Alert!\n\nDear ${customerName},\n\nOur Flash Sale is live! Slashed prices on our top products for a limited time only. Hurry and order now!\n\nBest regards,\n${companyName}`;
    }
    if (templateType === 'clearance_sale') {
        return `Clearance Sale!\n\nDear ${customerName},\n\nClearance Sale is live now! Get massive discounts on remaining inventory. Grab them while stocks last!\n\nBest regards,\n${companyName}`;
    }
    if (templateType === 'back_in_stock') {
        return `Back In Stock!\n\nDear ${customerName},\n\nYour favorite products are now back in stock and ready to order. Get yours today before they are sold out again!\n\nBest regards,\n${companyName}`;
    }
    if (templateType === 'order_confirmation') {
        return `Order Confirmed!\n\nDear ${customerName},\n\nThank you for your order. We have successfully received it and are processing it. We will notify you once shipped.\n\nBest regards,\n${companyName}`;
    }
    if (templateType === 'feedback') {
        return `We'd Love Your Feedback!\n\nDear ${customerName},\n\nThank you for shopping at ${companyName}. We hope you had a great experience. Please reply to this message with your rating (1-5 stars) and feedback!\n\nBest regards,\n${companyName}`;
    }
    // Default / marketing_newsletter
    return `Special Update from ${companyName}:\n\nDear ${customerName},\n\nWe wanted to share some exciting news regarding our latest products and inventory updates. Contact us for more details!\n\nBest regards,\n${companyName}`;
};

const getTemplatePreviewHtml = (templateType, customerName, settings, customContent) => {
    const companyName = (settings.company_name && settings.company_name.trim() !== '' && settings.company_name !== 'Quantro')
        ? settings.company_name
        : 'Maze ERP';
    const logoUrl = settings.logo_url || './icons/Logo.png';

    if (templateType === 'order_confirmation') {
        const logoHtml = logoUrl 
            ? `<img src="${logoUrl}" alt="${companyName}" style="max-height: 40px; margin-bottom: 12px; display: inline-block;" />` 
            : '';
        return `
            <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 100%; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 12px; background: #ffffff; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.05); height: 100%;">
                <div style="background: linear-gradient(135deg, #0f172a, #1e293b); padding: 24px; text-align: center; color: #ffffff;">
                    ${logoHtml}
                    <div style="font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.1em; color: #38bdf8; margin-bottom: 4px;">Order Placed Successfully</div>
                    <h2 style="margin: 0; font-size: 20px; font-weight: 800;">Order Confirmed</h2>
                </div>
                <div style="padding: 24px; color: #334155; line-height: 1.5; font-size: 13.5px;">
                    <p style="margin: 0 0 12px 0;">Dear <strong>${customerName}</strong>,</p>
                    <p style="margin: 0 0 16px 0;">We are thrilled to confirm your order has been received and is being processed. Below are the details of your confirmation.</p>
                    
                    <div style="background: #f8fafc; border-radius: 8px; padding: 14px; border: 1px solid #f1f5f9; margin-bottom: 16px;">
                        <h4 style="margin: 0 0 8px 0; font-size: 13px; color: #0f172a; text-transform: uppercase; letter-spacing: 0.05em; border-bottom: 1px solid #e2e8f0; padding-bottom: 6px;">Order Details</h4>
                        <div style="font-size: 12.5px; color: #475569;">
                            <p style="margin: 4px 0;">Thank you for your order! Your confirmation details are being processed.</p>
                            <p style="margin: 4px 0;"><strong>Customer Name:</strong> ${customerName}</p>
                            <p style="margin: 4px 0;"><strong>Support Email:</strong> ${settings.email || 'N/A'}</p>
                        </div>
                    </div>

                    <p style="margin: 0 0 16px 0;">We will send another notification with tracking information as soon as your items are dispatched.</p>
                    
                    <div style="text-align: center;">
                        <a href="#" style="background: #0f172a; color: #ffffff; padding: 10px 24px; border-radius: 6px; font-weight: 600; text-decoration: none; display: inline-block; font-size: 13px;">View In Portal</a>
                    </div>
                </div>
                <div style="background: #f8fafc; padding: 18px; text-align: center; font-size: 11px; color: #64748b; border-top: 1px solid #f1f5f9;">
                    <p style="margin: 0 0 4px 0; font-weight: bold; color: #334155;">${companyName}</p>
                    <p style="margin: 0;">Support: ${settings.email || ''} | Phone: ${settings.phone || ''}</p>
                </div>
            </div>
        `;
    } else if (templateType === 'feedback') {
        const logoHtml = logoUrl 
            ? `<img src="${logoUrl}" alt="${companyName}" style="max-height: 40px; margin-bottom: 12px; display: inline-block;" />` 
            : '';
        return `
            <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 100%; margin: 0 auto; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; box-shadow: 0 4px 6px rgba(0,0,0,0.05); overflow: hidden; height: 100%;">
                <div style="background: #0f172a; padding: 24px; text-align: center; color: #ffffff;">
                    ${logoHtml}
                    <h2 style="margin: 0; font-size: 20px; font-weight: 700;">We'd Love Your Feedback!</h2>
                </div>
                <div style="padding: 24px; color: #334155; line-height: 1.5; text-align: center; font-size: 13.5px;">
                    <p style="margin: 0 0 12px 0; text-align: left;">Dear <strong>${customerName}</strong>,</p>
                    <p style="margin: 0 0 16px 0; text-align: left;">Thank you for your recent purchase at <strong>${companyName}</strong>. We strive to provide the best possible experience, and your opinion helps us improve.</p>
                    
                    <p style="margin: 0 0 20px 0; font-weight: 600; color: #0f172a;">How would you rate your overall experience with us?</p>
                    
                    <div style="margin: 16px 0; display: inline-flex; gap: 10px; justify-content: center;">
                        <span style="font-size: 28px; cursor: pointer; padding: 0 4px;">😠</span>
                        <span style="font-size: 28px; cursor: pointer; padding: 0 4px;">🙁</span>
                        <span style="font-size: 28px; cursor: pointer; padding: 0 4px;">😐</span>
                        <span style="font-size: 28px; cursor: pointer; padding: 0 4px;">🙂</span>
                        <span style="font-size: 28px; cursor: pointer; padding: 0 4px;">😍</span>
                    </div>

                    <p style="margin: 20px 0 16px 0; text-align: left;">Alternatively, you can write to us directly by replying to this email. We read every response!</p>
                    
                    <div style="text-align: center; margin-top: 20px;">
                        <a href="#" style="background: #3b82f6; color: #ffffff; padding: 10px 28px; border-radius: 6px; font-weight: 600; text-decoration: none; display: inline-block; font-size: 13px; box-shadow: 0 4px 6px -1px rgba(59, 130, 246, 0.2);">Share Detailed Review</a>
                    </div>
                </div>
                <div style="background: #f8fafc; padding: 18px; text-align: center; font-size: 11px; color: #64748b; border-top: 1px solid #f1f5f9;">
                    <p style="margin: 0; font-weight: 600; color: #334155;">${companyName}</p>
                    <p style="margin: 4px 0 0 0;">Phone: ${settings.phone || ''} | Address: ${settings.address || ''}</p>
                </div>
            </div>
        `;
    } else if (templateType === 'invoice_email') {
        return getInvoiceMockTemplateHtml(customerName, settings);
    } else if (templateType === 'due_balance') {
        const innerHtml = `
            <p>Our records show that you have an outstanding due balance of <strong>₹4,500.00</strong>.</p>
            <p>Below is the list of your unpaid invoices:</p>
            <table style="width: 100%; border-collapse: collapse; margin: 16px 0; font-size: 13px;">
                <thead>
                    <tr style="background: #f8fafc; border-bottom: 1px solid #e2e8f0; color: #475569;">
                        <th style="padding: 8px; text-align: left;">Invoice ID</th>
                        <th style="padding: 8px; text-align: left;">Date</th>
                        <th style="padding: 8px; text-align: right;">Total Amount</th>
                        <th style="padding: 8px; text-align: right;">Outstanding Due</th>
                    </tr>
                </thead>
                <tbody>
                    <tr style="border-bottom: 1px solid #f1f5f9;">
                        <td style="padding: 8px;">#INV-0042</td>
                        <td style="padding: 8px;">2026-05-20</td>
                        <td style="padding: 8px; text-align: right;">₹10,500.00</td>
                        <td style="padding: 8px; text-align: right; color: #ef4444; font-weight: bold;">₹4,500.00</td>
                    </tr>
                </tbody>
            </table>
            <p>Please complete your payment at your earliest convenience.</p>
        `;
        return wrapCampaignPreviewHtml("Outstanding Due Statement", customerName, innerHtml, settings);
    } else if (templateType === 'festival_offer') {
        const innerHtml = `
            <p>Celebrate this festive season with our exclusive **Diwali / Holi / Eid Sale**!</p>
            <p>Enjoy special deals, seasonal catalogs, and limited-time discounts across our entire store. Be sure to check them out today!</p>
        `;
        return wrapCampaignPreviewHtml("Festival Sale!", customerName, innerHtml, settings);
    } else if (templateType === 'discount_coupon') {
        const innerHtml = `
            <p>We are pleased to offer you an exclusive discount on your next purchase!</p>
            <div style="background: #f0fdf4; border: 1px dashed #22c55e; border-radius: 8px; padding: 20px; text-align: center; margin: 20px 0;">
                <div style="font-size: 13px; color: #166534; font-weight: 600; text-transform: uppercase;">Your Coupon Code</div>
                <div style="font-size: 28px; font-weight: bold; color: #15803d; margin: 8px 0; letter-spacing: 2px;">WELCOME10</div>
                <div style="font-size: 14px; color: #166534;">Get <strong>10% Flat Discount</strong> at checkout!</div>
            </div>
            <p>Hurry, this offer is valid for a limited time only.</p>
        `;
        return wrapCampaignPreviewHtml("Exclusive Discount!", customerName, innerHtml, settings);
    } else if (templateType === 'new_arrivals') {
        const innerHtml = `
            <p>We are thrilled to announce that our **New Arrivals** are officially here!</p>
            <p>Discover fresh collections, advanced new inventory, and cutting-edge products designed to fit your needs perfectly. Visit our catalog today to check them out!</p>
        `;
        return wrapCampaignPreviewHtml("New Arrivals!", customerName, innerHtml, settings);
    } else if (templateType === 'flash_sale') {
        const innerHtml = `
            <p>Our **Flash Sale** is officially live for a very limited time!</p>
            <p>Prices have been heavily slashed across selected high-demand products. Don't wait — grab your favorites before the timer runs out!</p>
        `;
        return wrapCampaignPreviewHtml("Flash Sale Alert!", customerName, innerHtml, settings);
    } else if (templateType === 'clearance_sale') {
        const innerHtml = `
            <p>Get ready for our massive **Stock Clearance Sale**!</p>
            <p>We are clearing out inventory to make room for new stock. Take advantage of our lowest prices ever. Quantities are highly limited, so shop today!</p>
        `;
        return wrapCampaignPreviewHtml("Clearance Sale!", customerName, innerHtml, settings);
    } else if (templateType === 'back_in_stock') {
        const innerHtml = `
            <p>We've got great news! Your favorite products are officially **Back In Stock**!</p>
            <p>We have restocked our most popular products, and they are now ready for immediate billing and delivery. Order yours now while supplies last.</p>
        `;
        return wrapCampaignPreviewHtml("Back In Stock!", customerName, innerHtml, settings);
    } else {
        const logoHtml = logoUrl 
            ? `<img src="${logoUrl}" alt="${companyName}" style="max-height: 40px; margin-bottom: 12px; display: inline-block;" />` 
            : '';
        return `
            <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 100%; margin: 0 auto; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; box-shadow: 0 4px 6px rgba(0,0,0,0.05); overflow: hidden; height: 100%; display: flex; flex-direction: column;">
                <div style="background: linear-gradient(135deg, #1e3a8a, #3b82f6); padding: 24px; text-align: center; color: #ffffff;">
                    ${logoHtml}
                    <div style="font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.1em; color: #93c5fd; margin-bottom: 4px;">Exclusive Newsletter</div>
                    <h2 style="margin: 0; font-size: 20px; font-weight: 800;">Special Update</h2>
                </div>
                <div style="padding: 24px; color: #334155; line-height: 1.5; font-size: 13.5px; flex: 1;">
                    <p style="margin: 0 0 12px 0;">Hello <strong>${customerName}</strong>,</p>
                    <p style="margin: 0 0 16px 0; white-space: pre-wrap;">${customContent || "We wanted to reach out and share an exciting update regarding our latest products and services. We are continuously working to improve your experience."}</p>
                    
                    ${!customContent ? `
                    <div style="background: #eff6ff; border-radius: 8px; padding: 14px; border: 1px solid #dbeafe; margin-bottom: 16px; color: #1e3a8a;">
                        <p style="margin: 0; font-weight: 600;">What's New?</p>
                        <ul style="margin: 8px 0 0 0; padding-left: 20px; font-size: 12.5px; color: #1e40af;">
                            <li>Premium updates to client communication systems</li>
                            <li>Enhanced discount and marketing coupon management</li>
                            <li>Real-time campaign tracking and template styling</li>
                        </ul>
                    </div>
                    ` : ''}

                    <p style="margin: 0 0 16px 0;">Thank you for being a valued customer and choosing <strong>${companyName}</strong>!</p>
                    
                    <div style="text-align: center;">
                        <a href="#" style="background: #1e3a8a; color: #ffffff; padding: 10px 24px; border-radius: 6px; font-weight: 600; text-decoration: none; display: inline-block; font-size: 13px; box-shadow: 0 4px 6px -1px rgba(30, 58, 138, 0.2);">Explore Updates</a>
                    </div>
                </div>
                <div style="background: #f8fafc; padding: 18px; text-align: center; font-size: 11px; color: #64748b; border-top: 1px solid #f1f5f9;">
                    <p style="margin: 0 0 4px 0; font-weight: bold; color: #334155;">${companyName}</p>
                    <p style="margin: 0;">Support: ${settings.email || ''} | Phone: ${settings.phone || ''}</p>
                </div>
            </div>
        `;
    }
};

export default function CustomersPage() {
    const [customers, setCustomers] = useState([]);
    const [search, setSearch] = useState('');
    const [loading, setLoading] = useState(true);

    const [selectedCustomerIds, setSelectedCustomerIds] = useState([]);
    const lastSelectedCustomerCount = useRef(0);
    if (selectedCustomerIds.length > 0) {
        lastSelectedCustomerCount.current = selectedCustomerIds.length;
    }

    async function handleBulkDeleteCustomers() {
        if (selectedCustomerIds.length === 0) return;
        const confirmDelete = window.confirm(`Are you sure you want to delete ${selectedCustomerIds.length} selected customers? This action is permanent and cannot be undone.`);
        if (!confirmDelete) return;

        try {
            const promises = selectedCustomerIds.map(id => api.deleteCustomer(id));
            await Promise.all(promises);
            toast.success('Selected customers deleted successfully');
            setSelectedCustomerIds([]);
            loadCustomers();
        } catch (err) {
            toast.error(err.message || 'Failed to delete some customers');
            loadCustomers();
        }
    }


    // Filters
    const [sortBy, setSortBy] = useState('Newest First');
    const [filterCredit, setFilterCredit] = useState('All');

    // Settings for Tier Discounts
    const [settings, setSettings] = useState({
        tier_a_discount: '10',
        tier_b_discount: '5',
        tier_c_discount: '0'
    });

    // Settings Modal
    const [showSettingsModal, setShowSettingsModal] = useState(false);
    const [editingTier, setEditingTier] = useState(null); // 'A', 'B', 'C'
    const [editingTierDiscount, setEditingTierDiscount] = useState('');
    const [savingSettings, setSavingSettings] = useState(false);

    // Modal for Add/Edit
    const [showModal, setShowModal] = useState(false);
    const [editingCustomer, setEditingCustomer] = useState(null);
    const [form, setForm] = useState(EMPTY_CUSTOMER);
    const [saving, setSaving] = useState(false);

    // Pagination state
    const [currentPage, setCurrentPage] = useState(1);
    const PAGE_SIZE = 50;

    // Session Recovery: Restore customer page session on load
    useEffect(() => {
        const isRestorePending = localStorage.getItem('quantro_restore_pending') === 'true';
        const savedSessionStr = localStorage.getItem('quantro_customers_session');

        if ((isRestorePending || savedSessionStr) && savedSessionStr) {
            try {
                const data = JSON.parse(savedSessionStr);
                if (data) {
                    if (data.search !== undefined) setSearch(data.search);
                    if (data.sortBy !== undefined) setSortBy(data.sortBy);
                    if (data.filterCredit !== undefined) setFilterCredit(data.filterCredit);
                    if (data.currentPage) setCurrentPage(data.currentPage);
                    if (isRestorePending) {
                        toast.success('Customers page session restored!');
                    }
                }
            } catch (e) {
                console.error('[SessionRecovery] Customers restore error:', e);
            }
        }
    }, []);

    // Session Recovery: Auto-save customers page state
    useEffect(() => {
        const sessionState = {
            search,
            sortBy,
            filterCredit,
            currentPage,
            timestamp: Date.now()
        };
        localStorage.setItem('quantro_customers_session', JSON.stringify(sessionState));
    }, [search, sortBy, filterCredit, currentPage]);

    // Delete
    const [deleteId, setDeleteId] = useState(null);

    // Customer Activity/History Modal
    const [historyCustomer, setHistoryCustomer] = useState(null);
    const [activeTab, setActiveTab] = useState('purchases'); // 'purchases' or 'communication'
    const [purchases, setPurchases] = useState([]);
    const [logs, setLogs] = useState([]);
    const [loadingLogs, setLoadingLogs] = useState(false);
    const [logForm, setLogForm] = useState({ type: 'Call', notes: '' });
    const [savingLog, setSavingLog] = useState(false);

    // Loyalty Points state
    const [loyaltyDetails, setLoyaltyDetails] = useState(null);
    const [loadingLoyalty, setLoadingLoyalty] = useState(false);
    const [showAdjustPointsModal, setShowAdjustPointsModal] = useState(false);
    const [adjustPointsForm, setAdjustPointsForm] = useState({ points: '', note: '' });
    const [adjustingPoints, setAdjustingPoints] = useState(false);

    // Marketing/Coupons page tab
    const [activePageTab, setActivePageTab] = useState('directory'); // 'directory' or 'marketing'
    const [coupons, setCoupons] = useState([]);
    const [loadingCoupons, setLoadingCoupons] = useState(false);
    const [products, setProducts] = useState([]);
    const [showCouponModal, setShowCouponModal] = useState(false);
    const [couponForm, setCouponForm] = useState({
        code: '',
        type: 'discount',
        value: '',
        expiry_date: '',
        usage_limit_type: 'unlimited',
        usage_limit: '',
        reward_quantity: '1'
    });
    const [savingCoupon, setSavingCoupon] = useState(false);

    // Campaigns state
    const [marketingSubTab, setMarketingSubTab] = useState('coupons'); // 'coupons' or 'campaigns'
    const [campaigns, setCampaigns] = useState([]);
    const [loadingCampaigns, setLoadingCampaigns] = useState(false);
    const [showCampaignModal, setShowCampaignModal] = useState(false);
    const [savingCampaign, setSavingCampaign] = useState(false);
    const [campaignForm, setCampaignForm] = useState({
        name: '',
        customers: [],
        startDate: '',
        endDate: '',
        timeToSend: '09:00',
        template: 'marketing_newsletter',
        channel: 'email'
    });
    const [campaignSearch, setCampaignSearch] = useState('');
    const [previewCustomerId, setPreviewCustomerId] = useState(null);

    // Voice Campaign Progress states
    const [agents, setAgents] = useState([]);
    const [showProgressModal, setShowProgressModal] = useState(false);
    const [progressCampaign, setProgressCampaign] = useState(null);
    const [progressData, setProgressData] = useState(null);
    const [selectedProgressDate, setSelectedProgressDate] = useState('');
    const [loadingProgress, setLoadingProgress] = useState(false);

    // Pricelists state
    const [pricelists, setPricelists] = useState([]);
    const [loadingPricelists, setLoadingPricelists] = useState(false);
    const [showPricelistModal, setShowPricelistModal] = useState(false);
    const [editingPricelist, setEditingPricelist] = useState(null);
    const [savingPricelist, setSavingPricelist] = useState(false);
    const [pricelistForm, setPricelistForm] = useState({
        name: '',
        coupon_code: '',
        description: '',
        discount_type: 'Percentage',
        discount_value: '',
        min_order_amount: '0',
        max_uses: '0',
        active: 1
    });
    const [pricelistSearch, setPricelistSearch] = useState('');

    useEffect(() => {
        api.getAgents().then(data => {
            setAgents(data || []);
        }).catch(console.error);
    }, []);

    // Catalog search and filter states inside coupon modal
    const [catalogSearch, setCatalogSearch] = useState('');
    const [catalogCategory, setCatalogCategory] = useState('All');
    const [catalogSubcategory, setCatalogSubcategory] = useState('All');
    const [catalogBrand, setCatalogBrand] = useState('All');
    const [selectedProducts, setSelectedProducts] = useState([]);

    useEffect(() => {
        setSelectedCustomerIds([]);
    }, [search, sortBy, filterCredit, currentPage, activePageTab]);

    const loadCoupons = useCallback(async () => {
        setLoadingCoupons(true);
        try {
            const data = await api.getCoupons();
            setCoupons(data || []);
        } catch (err) {
            console.error('Failed to load coupons', err);
        } finally {
            setLoadingCoupons(false);
        }
    }, []);

    const loadCampaigns = useCallback(async () => {
        setLoadingCampaigns(true);
        try {
            const data = await api.getCampaigns();
            setCampaigns(data || []);
        } catch (err) {
            console.error('Failed to load campaigns', err);
        } finally {
            setLoadingCampaigns(false);
        }
    }, []);

    const handleViewVoiceProgress = useCallback(async (camp) => {
        setProgressCampaign(camp);
        setShowProgressModal(true);
        setLoadingProgress(true);
        setProgressData(null);
        setSelectedProgressDate('');
        try {
            const data = await api.getVoiceCampaignProgress(camp.id);
            setProgressData(data);
            if (data && data.progress && data.progress.length > 0) {
                setSelectedProgressDate(data.progress[0].date);
            }
        } catch (err) {
            toast.error(err.message || 'Failed to fetch voice campaign progress');
        } finally {
            setLoadingProgress(false);
        }
    }, []);

    const loadPricelists = useCallback(async () => {
        setLoadingPricelists(true);
        try {
            const data = await api.getPricelists();
            setPricelists(data || []);
        } catch (err) {
            console.error('Failed to load pricelists', err);
        } finally {
            setLoadingPricelists(false);
        }
    }, []);

    useEffect(() => {
        if (activePageTab === 'marketing') {
            if (marketingSubTab === 'coupons') {
                loadCoupons();
            } else {
                loadCampaigns();
            }
            api.getProducts().then(data => {
                setProducts(Array.isArray(data) ? data : (data?.items || []));
            }).catch(console.error);
        } else if (activePageTab === 'pricelists') {
            loadPricelists();
        }
    }, [activePageTab, marketingSubTab, loadCoupons, loadCampaigns, loadPricelists]);

    const openCreatePricelistModal = () => {
        setEditingPricelist(null);
        setPricelistForm({
            name: '',
            coupon_code: '',
            description: '',
            discount_type: 'Percentage',
            discount_value: '',
            min_order_amount: '0',
            max_uses: '0',
            active: 1
        });
        setShowPricelistModal(true);
    };

    const openEditPricelist = (pl) => {
        setEditingPricelist(pl);
        setPricelistForm({
            name: pl.name,
            coupon_code: pl.coupon_code,
            description: pl.description || '',
            discount_type: pl.discount_type,
            discount_value: pl.discount_value,
            min_order_amount: String(pl.min_order_amount || 0),
            max_uses: String(pl.max_uses || 0),
            active: pl.active
        });
        setShowPricelistModal(true);
    };

    const handleSavePricelist = async () => {
        if (!pricelistForm.name.trim()) {
            return toast.error('Pricelist Name is required');
        }
        if (!pricelistForm.coupon_code.trim()) {
            return toast.error('Coupon Code is required');
        }
        if (pricelistForm.discount_value === '' || Number(pricelistForm.discount_value) < 0) {
            return toast.error('Discount Value must be a valid positive number');
        }

        setSavingPricelist(true);
        try {
            const payload = {
                name: pricelistForm.name.trim(),
                coupon_code: pricelistForm.coupon_code.trim().toUpperCase(),
                description: pricelistForm.description.trim(),
                discount_type: pricelistForm.discount_type,
                discount_value: Number(pricelistForm.discount_value),
                min_order_amount: Number(pricelistForm.min_order_amount || 0),
                max_uses: Number(pricelistForm.max_uses || 0),
                active: Number(pricelistForm.active)
            };

            if (editingPricelist) {
                await api.updatePricelist(editingPricelist.id, payload);
                toast.success('Price list updated successfully');
            } else {
                await api.createPricelist(payload);
                toast.success('Price list created successfully');
            }
            setShowPricelistModal(false);
            loadPricelists();
        } catch (err) {
            toast.error(err.message || 'Failed to save price list');
        } finally {
            setSavingPricelist(false);
        }
    };

    const handleDeletePricelist = async (id) => {
        if (!window.confirm('Are you sure you want to delete this price list?')) return;
        try {
            await api.deletePricelist(id);
            toast.success('Price list deleted successfully');
            loadPricelists();
        } catch (err) {
            toast.error(err.message || 'Failed to delete price list');
        }
    };

    async function handleSaveCoupon() {
        if (!couponForm.code.trim()) {
            return toast.error('Coupon code is required');
        }
        if (couponForm.type !== 'product' && (couponForm.value === '' || isNaN(Number(couponForm.value)) || Number(couponForm.value) < 0)) {
            return toast.error('Discount value must be a non-negative number');
        }
        if (couponForm.type === 'product' && selectedProducts.length === 0) {
            return toast.error('Please select at least one product reward');
        }
        if (couponForm.usage_limit_type === 'custom' && (couponForm.usage_limit === '' || isNaN(Number(couponForm.usage_limit)) || Number(couponForm.usage_limit) <= 0)) {
            return toast.error('Usage limit must be a positive integer');
        }

        const payload = {
            code: couponForm.code.trim().toUpperCase(),
            type: couponForm.type,
            value: couponForm.type === 'product'
                ? JSON.stringify(selectedProducts.map(sp => ({ id: sp.id, qty: sp.qty })))
                : Number(couponForm.value),
            expiry_date: couponForm.expiry_date || null,
            usage_limit_type: couponForm.usage_limit_type,
            usage_limit: couponForm.usage_limit_type === 'custom' ? Math.floor(Number(couponForm.usage_limit)) : null,
            reward_quantity: 1
        };

        setSavingCoupon(true);
        try {
            await api.createCoupon(payload);
            toast.success('Coupon created successfully!');
            setShowCouponModal(false);
            setCouponForm({
                code: '',
                type: 'discount',
                value: '',
                expiry_date: '',
                usage_limit_type: 'unlimited',
                usage_limit: '',
                reward_quantity: '1'
            });
            // Reset filters
            setSelectedProducts([]);
            setCatalogSearch('');
            setCatalogCategory('All');
            setCatalogSubcategory('All');
            setCatalogBrand('All');
            loadCoupons();
        } catch (err) {
            toast.error(err.message || 'Failed to create coupon');
        } finally {
            setSavingCoupon(false);
        }
    }

    function openCreateCouponModal() {
        setSelectedProducts([]);
        setCatalogSearch('');
        setCatalogCategory('All');
        setCatalogSubcategory('All');
        setCatalogBrand('All');
        setCouponForm({
            code: '',
            type: 'discount',
            value: '',
            expiry_date: '',
            usage_limit_type: 'unlimited',
            usage_limit: '',
            reward_quantity: '1'
        });
        setShowCouponModal(true);
    }

    async function handleDeleteCoupon(couponId) {
        if (!confirm('Are you sure you want to delete this coupon?')) return;
        try {
            await api.deleteCoupon(couponId);
            toast.success('Coupon deleted successfully');
            loadCoupons();
        } catch (err) {
            toast.error(err.message || 'Failed to delete coupon');
        }
    }

    async function handleSaveCampaign() {
        if (!campaignForm.name.trim()) {
            return toast.error('Campaign name is required');
        }
        if (campaignForm.customers.length === 0) {
            return toast.error('Please select at least one customer');
        }
        if (!campaignForm.startDate) {
            return toast.error('Start date is required');
        }
        if (!campaignForm.timeToSend) {
            return toast.error('Time to send is required');
        }

        const payload = {
            name: campaignForm.name.trim(),
            customers: campaignForm.customers,
            startDate: campaignForm.startDate,
            endDate: campaignForm.endDate || null,
            timeToSend: campaignForm.timeToSend,
            template: campaignForm.template,
            channel: campaignForm.channel || 'email'
        };

        setSavingCampaign(true);
        try {
            await api.scheduleCampaign(payload);
            toast.success('Campaign scheduled successfully!');
            setShowCampaignModal(false);
            setCampaignForm({
                name: '',
                customers: [],
                startDate: '',
                endDate: '',
                timeToSend: '09:00',
                template: 'marketing_newsletter',
                channel: 'email'
            });
            loadCampaigns();
        } catch (err) {
            toast.error(err.message || 'Failed to schedule campaign');
        } finally {
            setSavingCampaign(false);
        }
    }

    async function handleCancelCampaign(id) {
        if (!confirm('Are you sure you want to cancel this campaign?')) return;
        try {
            await api.cancelCampaign(id);
            toast.success('Campaign cancelled successfully');
            loadCampaigns();
        } catch (err) {
            toast.error(err.message || 'Failed to cancel campaign');
        }
    }

    const loadSettings = useCallback(async () => {
        try {
            const s = await api.getSettings();
            if (s) {
                setSettings({
                    ...s,
                    tier_a_discount: s.tier_a_discount ?? '10',
                    tier_b_discount: s.tier_b_discount ?? '5',
                    tier_c_discount: s.tier_c_discount ?? '0'
                });
                if (s.license_plan === 'Free' && activePageTab === 'pricelists') {
                    setActivePageTab('directory');
                }
            }
        } catch (err) {
            console.error('Failed to load settings', err);
        }
    }, []);

    const loadCustomers = useCallback(async () => {
        try {
            const params = {};
            if (search) params.search = search;
            const data = await api.getCustomers(params);
            setCustomers(data);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    }, [search]);

    useEffect(() => {
        loadCustomers();
        loadSettings();
    }, [loadCustomers, loadSettings]);

    function openAdd() {
        setEditingCustomer(null);
        setForm(EMPTY_CUSTOMER);
        setShowModal(true);
    }

    function openEdit(customer) {
        setEditingCustomer(customer);
        setForm({
            name: customer.name,
            phone: customer.phone,
            email: customer.email || '',
            address: customer.address,
            gstin: customer.gstin || '',
            tier: customer.tier || 'C',
            credit_limit: customer.credit_limit || 0
        });
        setShowModal(true);
    }

    async function handleSave() {
        const error = validateCustomer(form);
        if (error) return toast.error(error);
        
        const payload = {
            name: form.name.trim(),
            phone: form.phone.trim(),
            email: form.email.trim(),
            address: form.address.trim(),
            gstin: form.gstin.trim(),
            tier: form.tier || 'C',
            credit_limit: Number(form.credit_limit || 0)
        };

        const promise = editingCustomer 
            ? api.updateCustomer(editingCustomer.id, payload)
            : api.createCustomer(payload);

        setSaving(true);
        toast.promise(promise, {
            loading: editingCustomer ? 'Updating customer...' : 'Adding new customer...',
            success: () => {
                setShowModal(false);
                loadCustomers();
                return editingCustomer ? 'Customer updated successfully' : 'Customer added successfully';
            },
            error: (err) => err.message || 'Failed to save customer',
            finally: () => setSaving(false)
        });
    }

    async function handleDelete() {
        if (!deleteId) return;
        
        const promise = api.deleteCustomer(deleteId);
        
        toast.promise(promise, {
            loading: 'Deleting customer records...',
            success: () => {
                setDeleteId(null);
                loadCustomers();
                return 'Customer deleted successfully';
            },
            error: (err) => err.message || 'Failed to delete customer'
        });
    }

    // Settings / Tier Discounts management
    function openEditTier(tier) {
        setEditingTier(tier);
        const key = `tier_${tier.toLowerCase()}_discount`;
        setEditingTierDiscount(settings[key] || '0');
        setShowSettingsModal(true);
    }

    async function handleSaveTierDiscount() {
        const pct = parseFloat(editingTierDiscount);
        if (isNaN(pct) || pct < 0 || pct > 100) {
            return toast.error('Discount percentage must be between 0 and 100');
        }
        setSavingSettings(true);
        const key = `tier_${editingTier.toLowerCase()}_discount`;
        try {
            await api.updateSettings({ [key]: String(pct) });
            toast.success(`Tier ${editingTier} discount updated successfully`);
            setSettings(prev => ({ ...prev, [key]: String(pct) }));
            setShowSettingsModal(false);
        } catch (err) {
            toast.error(err.message || 'Failed to save setting');
        } finally {
            setSavingSettings(false);
        }
    }

    // CRM activity logs management
    const loadLogs = async (customerId) => {
        setLoadingLogs(true);
        try {
            const data = await api.getCustomerCommunicationLogs(customerId);
            setLogs(data || []);
        } catch (err) {
            console.error('Failed to load communication logs', err);
            setLogs([]);
        } finally {
            setLoadingLogs(false);
        }
    };

    const loadLoyaltyDetails = async (customerId) => {
        setLoadingLoyalty(true);
        try {
            const data = await api.getLoyaltyDetails(customerId);
            setLoyaltyDetails(data);
        } catch (err) {
            console.error('Failed to load loyalty details', err);
            toast.error(err.message || 'Failed to load loyalty details');
        } finally {
            setLoadingLoyalty(false);
        }
    };

    async function handleAdjustPoints() {
        const pts = parseInt(adjustPointsForm.points, 10);
        if (isNaN(pts) || pts === 0) {
            return toast.error('Please enter a non-zero integer for points adjustment.');
        }
        setAdjustingPoints(true);
        try {
            await api.adjustLoyaltyPoints({
                customerId: historyCustomer.id,
                points: pts,
                note: adjustPointsForm.note.trim()
            });
            toast.success('Loyalty points adjusted successfully');
            setShowAdjustPointsModal(false);
            setAdjustPointsForm({ points: '', note: '' });
            loadLoyaltyDetails(historyCustomer.id);
            loadCustomers();
        } catch (err) {
            toast.error(err.message || 'Failed to adjust points');
        } finally {
            setAdjustingPoints(false);
        }
    }

    async function viewHistory(customer) {
        setHistoryCustomer(customer);
        setActiveTab('purchases');
        setLogForm({ type: 'Call', notes: '' });
        try {
            const data = await api.getCustomerPurchases(customer.id);
            setPurchases(data || []);
        } catch (err) {
            console.error(err);
            setPurchases([]);
        }
        loadLogs(customer.id);
        if (settings.enable_loyalty_points === 'true') {
            loadLoyaltyDetails(customer.id);
        }
    }

    async function handleAddLog() {
        if (!logForm.notes.trim()) {
            return toast.error('Notes cannot be empty');
        }
        setSavingLog(true);
        try {
            await api.createCustomerCommunicationLog(historyCustomer.id, {
                type: logForm.type,
                notes: logForm.notes.trim()
            });
            toast.success('Activity logged successfully');
            setLogForm({ ...logForm, notes: '' });
            loadLogs(historyCustomer.id);
        } catch (err) {
            toast.error(err.message || 'Failed to log activity');
        } finally {
            setSavingLog(false);
        }
    }

    async function handleDeleteLog(logId) {
        try {
            await api.deleteCustomerCommunicationLog(historyCustomer.id, logId);
            toast.success('Log deleted successfully');
            loadLogs(historyCustomer.id);
        } catch (err) {
            toast.error(err.message || 'Failed to delete log');
        }
    }

    const filteredAndSortedCustomers = customers.filter(c => {
        if (filterCredit === 'With P-Credit') return c.p_credit_balance > 0;
        if (filterCredit === 'Without P-Credit') return c.p_credit_balance <= 0;
        return true;
    }).sort((a, b) => {
        if (sortBy === 'Name A-Z') return a.name.localeCompare(b.name);
        if (sortBy === 'Name Z-A') return b.name.localeCompare(a.name);
        if (sortBy === 'Highest Credit') return Number(b.p_credit_balance) - Number(a.p_credit_balance);
        if (sortBy === 'Oldest First') return new Date(a.created_at) - new Date(b.created_at);
        return new Date(b.created_at) - new Date(a.created_at);
    });

    const totalPages = Math.max(1, Math.ceil(filteredAndSortedCustomers.length / PAGE_SIZE));
    const paginatedCustomers = filteredAndSortedCustomers.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

    const prevSearch = useRef(search);
    if (prevSearch.current !== search) {
        prevSearch.current = search;
        if (currentPage !== 1) setCurrentPage(1);
    }

    // Catalog definitions for Coupon modal
    const productCategories = ['All', ...new Set(products.map(p => p.category).filter(Boolean))];
    const productSubcategories = ['All', ...new Set(products.map(p => p.subcategory_name || p.subcategory).filter(Boolean))];
    const productBrands = ['All', ...new Set(products.map(p => p.brand_name || p.brand).filter(Boolean))];

    const filteredCatalogProducts = products.filter(p => {
        const matchesSearch = p.name.toLowerCase().includes(catalogSearch.toLowerCase()) ||
                              (p.product_code && p.product_code.toLowerCase().includes(catalogSearch.toLowerCase()));
        const matchesCategory = catalogCategory === 'All' || p.category === catalogCategory;
        const matchesSubcategory = catalogSubcategory === 'All' || (p.subcategory_name === catalogSubcategory || p.subcategory === catalogSubcategory);
        const matchesBrand = catalogBrand === 'All' || (p.brand_name === catalogBrand || p.brand === catalogBrand);
        return matchesSearch && matchesCategory && matchesSubcategory && matchesBrand;
    });

    return (
        <div className="customers-page">
            <div className="page-header">
                <div>
                    <h1>Customers</h1>
                    <p className="text-secondary">
                        {activePageTab === 'directory' 
                            ? 'Manage customer profiles, contact directories, and credits' 
                            : activePageTab === 'marketing'
                                ? 'Create and manage promo codes, flat discount vouchers, and free product rewards'
                                : 'Create and manage campaign-based discount price lists'}
                    </p>
                </div>
                {activePageTab === 'directory' ? (
                    <SButton variant="primary" onClick={openAdd} aria-label="Add customer">
                        Add Customer
                    </SButton>
                ) : activePageTab === 'marketing' ? (
                    <SButton variant="primary" onClick={openCreateCouponModal} aria-label="Create coupon">
                        Create Coupon
                    </SButton>
                ) : (
                    <SButton variant="primary" onClick={openCreatePricelistModal} aria-label="Create price list">
                        Create Price List
                    </SButton>
                )}
            </div>

            {/* Page Tabs */}
            <div className="crm-modal-tabs" style={{ marginBottom: '24px' }}>
                <button 
                    className={`crm-tab-btn ${activePageTab === 'directory' ? 'active' : ''}`}
                    onClick={() => setActivePageTab('directory')}
                >
                    <Icons.Users size={16} />
                    Customers Directory
                </button>
                <button 
                    className={`crm-tab-btn ${activePageTab === 'marketing' ? 'active' : ''}`}
                    onClick={() => setActivePageTab('marketing')}
                >
                    <Icons.Tag size={16} />
                    Marketing
                </button>
                <button 
                    className={`crm-tab-btn ${activePageTab === 'pricelists' ? 'active' : ''}`}
                    onClick={() => {
                        if (settings?.license_plan === 'Free') {
                            toast.info("Price Lists require the Business PRO plan. Click the upgrade link in the sidebar to unlock.");
                            return;
                        }
                        setActivePageTab('pricelists');
                    }}
                    style={{
                        opacity: settings?.license_plan === 'Free' ? 0.6 : 1,
                        cursor: settings?.license_plan === 'Free' ? 'not-allowed' : 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px'
                    }}
                    title={settings?.license_plan === 'Free' ? "Price Lists require the Business PRO plan." : undefined}
                >
                    <Icons.Settings size={16} />
                    Price Lists
                    {settings?.license_plan === 'Free' && <Icons.Lock size={12} style={{ color: '#94a3b8' }} />}
                </button>
            </div>

            {activePageTab === 'directory' ? (
                <>
                    {/* Tier Configuration Strip */}
                    <div className="tier-strip" style={{ opacity: settings?.license_plan === 'Free' ? 0.6 : 1, cursor: settings?.license_plan === 'Free' ? 'pointer' : 'default' }} onClick={() => {
                        if (settings?.license_plan === 'Free') {
                            toast.info("Tier Configuration & Auto-Discounts require the Business PRO plan. Click the upgrade link in the sidebar to unlock.");
                        }
                    }}>
                        <div className="tier-strip-header">
                            <span className="tier-strip-title" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                Tier Configuration & Default Auto-Discounts
                                {settings?.license_plan === 'Free' && <Icons.Lock size={14} style={{ color: '#94a3b8' }} />}
                            </span>
                        </div>
                        <div className="tier-strip-grid">
                            <div className="tier-strip-card">
                                <div className="tier-strip-card-top">
                                    <span className="tier-badge tier-a">Tier A</span>
                                    <button className="tier-card-settings-btn" onClick={(e) => {
                                        e.stopPropagation();
                                        if (settings?.license_plan === 'Free') {
                                            toast.info("Tier Configuration & Auto-Discounts require the Business PRO plan. Click the upgrade link in the sidebar to unlock.");
                                            return;
                                        }
                                        openEditTier('A');
                                    }} title="Edit Tier A Discount" style={{ cursor: settings?.license_plan === 'Free' ? 'not-allowed' : 'pointer' }}>
                                        <Icons.Settings size={14} />
                                    </button>
                                </div>
                                <span className="tier-strip-value">{settings.tier_a_discount}%</span>
                                <span className="tier-strip-desc">Default discount applied automatically at checkout</span>
                            </div>
                            <div className="tier-strip-card">
                                <div className="tier-strip-card-top">
                                    <span className="tier-badge tier-b">Tier B</span>
                                    <button className="tier-card-settings-btn" onClick={(e) => {
                                        e.stopPropagation();
                                        if (settings?.license_plan === 'Free') {
                                            toast.info("Tier Configuration & Auto-Discounts require the Business PRO plan. Click the upgrade link in the sidebar to unlock.");
                                            return;
                                        }
                                        openEditTier('B');
                                    }} title="Edit Tier B Discount" style={{ cursor: settings?.license_plan === 'Free' ? 'not-allowed' : 'pointer' }}>
                                        <Icons.Settings size={14} />
                                    </button>
                                </div>
                                <span className="tier-strip-value">{settings.tier_b_discount}%</span>
                                <span className="tier-strip-desc">Default discount applied automatically at checkout</span>
                            </div>
                            <div className="tier-strip-card">
                                <div className="tier-strip-card-top">
                                    <span className="tier-badge tier-c">Tier C</span>
                                    <button className="tier-card-settings-btn" onClick={(e) => {
                                        e.stopPropagation();
                                        if (settings?.license_plan === 'Free') {
                                            toast.info("Tier Configuration & Auto-Discounts require the Business PRO plan. Click the upgrade link in the sidebar to unlock.");
                                            return;
                                        }
                                        openEditTier('C');
                                    }} title="Edit Tier C Discount" style={{ cursor: settings?.license_plan === 'Free' ? 'not-allowed' : 'pointer' }}>
                                        <Icons.Settings size={14} />
                                    </button>
                                </div>
                                <span className="tier-strip-value">{settings.tier_c_discount}%</span>
                                <span className="tier-strip-desc">Default discount applied automatically at checkout</span>
                            </div>
                        </div>
                    </div>

                    {/* Tier Distribution Chart */}
                    {customers.length > 0 && (() => {
                        const tierACount = customers.filter(c => (c.tier || 'C') === 'A').length;
                        const tierBCount = customers.filter(c => (c.tier || 'C') === 'B').length;
                        const tierCCount = customers.filter(c => (c.tier || 'C') === 'C').length;
                        return (
                            <div style={{
                                background: 'var(--bg-card, #ffffff)',
                                border: '1px solid var(--border-light)',
                                borderRadius: '16px',
                                padding: '16px 24px 8px 24px',
                                marginBottom: '18px',
                                boxShadow: '0 2px 12px rgba(0,0,0,0.04)'
                            }}>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                                    <span style={{ fontWeight: 600, fontSize: '13px', color: 'var(--text-secondary)' }}>Customer Distribution by Tier</span>
                                    <span style={{ fontSize: '12px', color: 'var(--text-tertiary)' }}>{customers.length} total customers</span>
                                </div>
                                <LineChart
                                    height={240}
                                    margin={{ left: 60, right: 20, top: 12, bottom: 24 }}
                                    xAxis={[{ data: ['Tier A', 'Tier B', 'Tier C'], scaleType: 'point' }]}
                                    series={[{ data: [tierACount, tierBCount, tierCCount], label: 'Customers', color: 'var(--accent, #6366f1)', valueFormatter: v => `${v} customers` }]}
                                    slotProps={{ legend: { hidden: true } }}
                                    sx={{ '& .MuiChartsAxis-tickLabel': { fontSize: '11px', fill: 'var(--text-secondary)' }, '& .MuiChartsAxis-line, & .MuiChartsAxis-tick': { stroke: 'var(--border-light)' } }}
                                />
                            </div>
                        );
                    })()}

                    <div className="page-toolbar">
                        <div className="search-bar">
                            <Icons.Search />
                            <input placeholder="Search customers…" value={search} onChange={e => setSearch(e.target.value)} />
                        </div>
                        <div className="page-toolbar-actions">
                            <CustomSelect 
                                value={filterCredit}
                                onChange={setFilterCredit}
                                options={[
                                    { value: 'All', label: 'All Customers' },
                                    { value: 'With P-Credit', label: 'Has P-Credit' },
                                    { value: 'Without P-Credit', label: 'No P-Credit' }
                                ]}
                                className="min-w-[160px]"
                            />
                            <CustomSelect 
                                value={sortBy}
                                onChange={setSortBy}
                                options={[
                                    { value: 'Newest First', label: 'Newest First' },
                                    { value: 'Oldest First', label: 'Oldest First' },
                                    { value: 'Name A-Z', label: 'Name A-Z' },
                                    { value: 'Name Z-A', label: 'Name Z-A' },
                                    { value: 'Highest Credit', label: 'Highest P-Credit' }
                                ]}
                            />
                        </div>
                    </div>

                    {loading ? (
                        <div className="customers-table-wrap card" style={{ padding: '20px' }}>
                            <Skeleton type="table" count={5} />
                        </div>
                    ) : customers.length === 0 ? (
                        <div className="empty-state-premium">
                            <div className="empty-icon-wrapper">
                                <Icons.Users size={40} />
                            </div>
                            <h3>No Customers Found</h3>
                            <p>Add your customers to track their purchases and credits.</p>
                            <SButton variant="primary" onClick={openAdd} aria-label="Add customer">
                                Add Customer
                            </SButton>
                        </div>
                    ) : filteredAndSortedCustomers.length === 0 ? (
                        <div className="customers-table-wrap card">
                            <div className="empty-state">
                                <Icons.UserX size={32} />
                                <p>No customers matching your search or filters</p>
                            </div>
                        </div>
                    ) : (
                        <>
                            <div style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                background: 'rgba(255, 255, 255, 0.85)',
                                backdropFilter: 'blur(8px)',
                                border: selectedCustomerIds.length > 0 ? '1px solid var(--border-light)' : '0px solid transparent',
                                padding: selectedCustomerIds.length > 0 ? '12px 24px' : '0px 24px',
                                borderRadius: '12px',
                                marginBottom: selectedCustomerIds.length > 0 ? '16px' : '0px',
                                boxShadow: selectedCustomerIds.length > 0 ? '0 8px 30px rgba(0, 0, 0, 0.08)' : 'none',
                                maxHeight: selectedCustomerIds.length > 0 ? '80px' : '0px',
                                opacity: selectedCustomerIds.length > 0 ? 1 : 0,
                                transform: selectedCustomerIds.length > 0 ? 'translateY(0)' : 'translateY(-10px)',
                                pointerEvents: selectedCustomerIds.length > 0 ? 'auto' : 'none',
                                overflow: 'hidden',
                                transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
                            }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <span style={{
                                        background: 'var(--accent)',
                                        color: '#fff',
                                        padding: '2px 8px',
                                        borderRadius: '20px',
                                        fontSize: '12px',
                                        fontWeight: 'bold'
                                    }}>{selectedCustomerIds.length > 0 ? selectedCustomerIds.length : lastSelectedCustomerCount.current}</span>
                                    <span style={{ fontWeight: '500', color: 'var(--text-secondary)' }}>Customers Selected</span>
                                </div>
                                <div style={{ display: 'flex', gap: '10px' }}>
                                    <SButton 
                                        variant="primary" 
                                        tone="critical" 
                                        onClick={handleBulkDeleteCustomers}
                                    >
                                        Delete Selected
                                    </SButton>
                                    <SButton 
                                        variant="secondary" 
                                        onClick={() => setSelectedCustomerIds([])}
                                    >
                                        Clear Selection
                                    </SButton>
                                </div>
                            </div>

                            <div className="customers-table-wrap card">
                                <table className="premium-table">
                                    <thead>
                                        <tr>
                                            <th style={{ width: '40px', textAlign: 'center' }}>
                                                <div 
                                                    onClick={() => {
                                                        const allChecked = paginatedCustomers.length > 0 && selectedCustomerIds.length === paginatedCustomers.length;
                                                        if (allChecked) {
                                                            setSelectedCustomerIds([]);
                                                        } else {
                                                            setSelectedCustomerIds(paginatedCustomers.map(c => c.id));
                                                        }
                                                    }}
                                                    style={{
                                                        display: 'inline-flex',
                                                        alignItems: 'center',
                                                        justifyContent: 'center',
                                                        width: '18px',
                                                        height: '18px',
                                                        borderRadius: '4px',
                                                        border: '1.5px solid ' + (paginatedCustomers.length > 0 && selectedCustomerIds.length === paginatedCustomers.length ? 'var(--accent)' : 'var(--text-tertiary)'),
                                                        background: paginatedCustomers.length > 0 && selectedCustomerIds.length === paginatedCustomers.length ? 'var(--accent)' : 'transparent',
                                                        cursor: 'pointer',
                                                        transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
                                                        transform: paginatedCustomers.length > 0 && selectedCustomerIds.length === paginatedCustomers.length ? 'scale(1.05)' : 'scale(1)',
                                                        userSelect: 'none',
                                                        margin: '0 auto',
                                                        boxShadow: paginatedCustomers.length > 0 && selectedCustomerIds.length === paginatedCustomers.length ? '0 2px 6px rgba(10, 110, 255, 0.2)' : 'none'
                                                    }}
                                                >
                                                    <div style={{
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        justifyContent: 'center',
                                                        opacity: paginatedCustomers.length > 0 && selectedCustomerIds.length === paginatedCustomers.length ? 1 : 0,
                                                        transform: paginatedCustomers.length > 0 && selectedCustomerIds.length === paginatedCustomers.length ? 'scale(1)' : 'scale(0.5)',
                                                        transition: 'all 0.2s cubic-bezier(0.34, 1.56, 0.64, 1)'
                                                    }}>
                                                        <Icons.Check size={12} color="#fff" strokeWidth={3} />
                                                    </div>
                                                </div>
                                            </th>
                                            <th>Name</th>
                                            <th>Phone</th>
                                            <th>Tier</th>
                                            <th>Credit Limit</th>
                                            <th>P-Credit Balance</th>
                                            {settings.enable_loyalty_points === 'true' && <th>Loyalty Points</th>}
                                            <th>GSTIN</th>
                                            <th>Address</th>
                                            <th>Joined</th>
                                            <th className="text-right">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {paginatedCustomers.map(c => {
                                            const isNegativeCredit = Number(c.p_credit_balance || 0) < 0;
                                            return (
                                                <tr key={c.id}>
                                                    <td style={{ textAlign: 'center' }}>
                                                        <div 
                                                            onClick={() => {
                                                                const isChecked = selectedCustomerIds.includes(c.id);
                                                                if (isChecked) {
                                                                    setSelectedCustomerIds(selectedCustomerIds.filter(id => id !== c.id));
                                                                } else {
                                                                    setSelectedCustomerIds([...selectedCustomerIds, c.id]);
                                                                }
                                                            }}
                                                            style={{
                                                                display: 'inline-flex',
                                                                alignItems: 'center',
                                                                justifyContent: 'center',
                                                                width: '18px',
                                                                height: '18px',
                                                                borderRadius: '4px',
                                                                border: '1.5px solid ' + (selectedCustomerIds.includes(c.id) ? 'var(--accent)' : 'var(--text-tertiary)'),
                                                                background: selectedCustomerIds.includes(c.id) ? 'var(--accent)' : 'transparent',
                                                                cursor: 'pointer',
                                                                transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
                                                                transform: selectedCustomerIds.includes(c.id) ? 'scale(1.05)' : 'scale(1)',
                                                                userSelect: 'none',
                                                                margin: '0 auto',
                                                                boxShadow: selectedCustomerIds.includes(c.id) ? '0 2px 6px rgba(10, 110, 255, 0.2)' : 'none'
                                                            }}
                                                        >
                                                            <div style={{
                                                                display: 'flex',
                                                                alignItems: 'center',
                                                                justifyContent: 'center',
                                                                opacity: selectedCustomerIds.includes(c.id) ? 1 : 0,
                                                                transform: selectedCustomerIds.includes(c.id) ? 'scale(1)' : 'scale(0.5)',
                                                                transition: 'all 0.2s cubic-bezier(0.34, 1.56, 0.64, 1)'
                                                            }}>
                                                                <Icons.Check size={12} color="#fff" strokeWidth={3} />
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td className="fw-600">{c.name}</td>
                                                    <td className="text-secondary">{c.phone || '—'}</td>
                                                <td>
                                                    <span className={`tier-badge tier-${(c.tier || 'C').toLowerCase()}`}>
                                                        Tier {c.tier || 'C'}
                                                    </span>
                                                </td>
                                                <td className="text-secondary">₹{Number(c.credit_limit || 0).toLocaleString('en-IN')}</td>
                                                <td className="fw-600" style={{ color: isNegativeCredit ? 'var(--danger)' : 'inherit' }}>
                                                    ₹{Number(c.p_credit_balance || 0).toLocaleString('en-IN')}
                                                </td>
                                                {settings.enable_loyalty_points === 'true' && (
                                                    <td className="fw-600" style={{ color: 'var(--primary-color)' }}>
                                                        {Number(c.loyalty_points || 0).toLocaleString('en-IN')} pts
                                                    </td>
                                                )}
                                                <td className="text-secondary">{c.gstin || 'Not Provided'}</td>
                                                <td className="text-secondary">{c.address || '—'}</td>
                                                <td className="text-secondary">{formatDate(c.created_at)}</td>
                                                <td className="text-right">
                                                    <div className="customer-actions">
                                                        <SButton variant="secondary" size="small" onClick={() => viewHistory(c)} title="Details & CRM History">
                                                            Activity
                                                        </SButton>
                                                        <SButton variant="secondary" size="small" onClick={() => openEdit(c)} title="Edit">
                                                            Edit
                                                        </SButton>
                                                        <SButton variant="secondary" size="small" onClick={() => setDeleteId(c.id)} title="Delete" style={{ color: 'var(--danger)' }}>
                                                            Delete
                                                        </SButton>
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                            {filteredAndSortedCustomers.length > 0 && (
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', borderTop: '1px solid var(--border-light)', marginTop: 8 }}>
                                    <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                                        Showing <strong style={{ color: 'var(--accent)', fontWeight: '600' }}>{(currentPage - 1) * PAGE_SIZE + 1}</strong> to <strong style={{ color: 'var(--accent)', fontWeight: '600' }}>{Math.min(currentPage * PAGE_SIZE, filteredAndSortedCustomers.length)}</strong> of <strong style={{ color: 'var(--accent)', fontWeight: '600' }}>{filteredAndSortedCustomers.length}</strong> records
                                    </span>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <button 
                                            disabled={currentPage === 1} 
                                            onClick={() => setCurrentPage(p => p - 1)}
                                            style={{
                                                background: 'transparent',
                                                border: 'none',
                                                color: 'var(--text-primary)',
                                                cursor: currentPage === 1 ? 'not-allowed' : 'pointer',
                                                fontSize: '16px',
                                                padding: '4px 8px',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                outline: 'none',
                                                opacity: currentPage === 1 ? 0.3 : 0.8,
                                                transition: 'opacity 0.2s'
                                            }}
                                            onMouseEnter={(e) => { if (currentPage !== 1) e.currentTarget.style.opacity = '1'; }}
                                            onMouseLeave={(e) => { if (currentPage !== 1) e.currentTarget.style.opacity = '0.8'; }}
                                        >
                                            &lt;
                                        </button>
                                        <span style={{ fontSize: '14px', fontWeight: '600', color: 'var(--text-secondary)', minWidth: '45px', textAlign: 'center' }}>
                                            {currentPage} / {totalPages}
                                        </span>
                                        <button 
                                            disabled={currentPage === totalPages} 
                                            onClick={() => setCurrentPage(p => p + 1)}
                                            style={{
                                                background: 'transparent',
                                                border: 'none',
                                                color: 'var(--text-primary)',
                                                cursor: currentPage === totalPages ? 'not-allowed' : 'pointer',
                                                fontSize: '16px',
                                                padding: '4px 8px',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                outline: 'none',
                                                opacity: currentPage === totalPages ? 0.3 : 0.8,
                                                transition: 'opacity 0.2s'
                                            }}
                                            onMouseEnter={(e) => { if (currentPage !== totalPages) e.currentTarget.style.opacity = '1'; }}
                                            onMouseLeave={(e) => { if (currentPage !== totalPages) e.currentTarget.style.opacity = '0.8'; }}
                                        >
                                            &gt;
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                        </>
                    )}
                </>
            ) : activePageTab === 'marketing' ? (
                /* Marketing Tab */
                <div className="coupons-section flex-column gap-20" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                    <div style={{ 
                        display: 'flex', 
                        gap: '4px', 
                        background: 'rgba(0, 0, 0, 0.03)', 
                        padding: '4px', 
                        borderRadius: '10px', 
                        width: 'fit-content', 
                        marginBottom: '16px',
                        border: '1px solid var(--border-light)'
                    }}>
                        <button 
                            className={`crm-tab-btn ${marketingSubTab === 'coupons' ? 'active' : ''}`}
                            onClick={() => setMarketingSubTab('coupons')}
                            style={{ 
                                background: marketingSubTab === 'coupons' ? '#fff' : 'none', 
                                border: 'none', 
                                padding: '8px 20px', 
                                fontWeight: 600, 
                                cursor: 'pointer', 
                                borderRadius: '8px',
                                boxShadow: marketingSubTab === 'coupons' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                                color: marketingSubTab === 'coupons' ? 'var(--accent)' : 'var(--text-secondary)',
                                transition: 'all 0.2s ease',
                                borderBottom: 'none'
                            }}
                        >
                            Coupons
                        </button>
                        <button 
                            className={`crm-tab-btn ${marketingSubTab === 'campaigns' ? 'active' : ''}`}
                            onClick={() => setMarketingSubTab('campaigns')}
                            style={{ 
                                background: marketingSubTab === 'campaigns' ? '#fff' : 'none', 
                                border: 'none', 
                                padding: '8px 20px', 
                                fontWeight: 600, 
                                cursor: 'pointer', 
                                borderRadius: '8px',
                                boxShadow: marketingSubTab === 'campaigns' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                                color: marketingSubTab === 'campaigns' ? 'var(--accent)' : 'var(--text-secondary)',
                                transition: 'all 0.2s ease',
                                borderBottom: 'none'
                            }}
                        >
                            Email Campaigns
                        </button>
                        <button 
                            className={`crm-tab-btn ${marketingSubTab === 'whatsapp' ? 'active' : ''}`}
                            onClick={() => {
                                if (settings?.license_plan === 'Free') {
                                    toast.info("WhatsApp Campaigns require the Business PRO plan. Click the upgrade link in the sidebar to unlock.");
                                    return;
                                }
                                setMarketingSubTab('whatsapp');
                            }}
                            title={settings?.license_plan === 'Free' ? "WhatsApp Campaigns require the Business PRO plan." : undefined}
                            style={{ 
                                background: marketingSubTab === 'whatsapp' ? '#fff' : 'none', 
                                border: 'none', 
                                padding: '8px 20px', 
                                fontWeight: 600, 
                                cursor: 'pointer', 
                                borderRadius: '8px',
                                boxShadow: marketingSubTab === 'whatsapp' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                                color: settings?.license_plan === 'Free' ? '#94a3b8' : (marketingSubTab === 'whatsapp' ? 'var(--accent)' : 'var(--text-secondary)'),
                                transition: 'all 0.2s ease',
                                borderBottom: 'none',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '6px'
                            }}
                        >
                            WhatsApp Campaigns
                            {settings?.license_plan === 'Free' && <Icons.Lock size={12} style={{ color: '#94a3b8' }} />}
                        </button>
                        <button 
                            className={`crm-tab-btn ${marketingSubTab === 'voice' ? 'active' : ''}`}
                            onClick={() => {
                                if (settings?.license_plan !== 'Professional') {
                                    toast.info("Voice Campaigns require the AI Professional plan. Click the upgrade link in the sidebar to unlock.");
                                    return;
                                }
                                setMarketingSubTab('voice');
                            }}
                            title={settings?.license_plan !== 'Professional' ? "Voice Campaigns require the AI Professional plan." : undefined}
                            style={{ 
                                background: marketingSubTab === 'voice' ? '#fff' : 'none', 
                                border: 'none', 
                                padding: '8px 20px', 
                                fontWeight: 600, 
                                cursor: 'pointer', 
                                borderRadius: '8px',
                                boxShadow: marketingSubTab === 'voice' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                                color: settings?.license_plan !== 'Professional' ? '#94a3b8' : (marketingSubTab === 'voice' ? 'var(--accent)' : 'var(--text-secondary)'),
                                transition: 'all 0.2s ease',
                                borderBottom: 'none',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '6px'
                            }}
                        >
                            Voice Campaigns (Outbound)
                            {settings?.license_plan !== 'Professional' && <Icons.Lock size={12} style={{ color: '#94a3b8' }} />}
                        </button>
                    </div>

                    {marketingSubTab === 'coupons' ? (
                        <div className="flex-column gap-20" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <div>
                                    <h4 style={{ margin: 0, fontSize: '16px', fontWeight: 600 }}>Discount Coupons</h4>
                                    <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: 'var(--text-secondary)' }}>Create promo codes and discount vouchers for your marketing campaigns.</p>
                                </div>
                                <SButton variant="primary" onClick={openCreateCouponModal}>
                                    Create Coupon
                                </SButton>
                            </div>
                            {loadingCoupons ? (
                                <div className="customers-table-wrap card" style={{ padding: '20px' }}>
                                    <Skeleton type="table" count={3} />
                                </div>
                            ) : coupons.length === 0 ? (
                                <div className="empty-state-premium">
                                    <div className="empty-icon-wrapper">
                                        <Icons.Tag size={40} />
                                    </div>
                                    <h3>No Coupons Found</h3>
                                    <p>Create promo codes and discount vouchers for your marketing campaigns.</p>
                                    <SButton variant="primary" onClick={openCreateCouponModal}>
                                        Create Coupon
                                    </SButton>
                                </div>
                            ) : (
                                <div className="customers-table-wrap card">
                                    <table className="premium-table">
                                        <thead>
                                            <tr>
                                                <th>Code</th>
                                                <th>Type</th>
                                                <th>Benefit</th>
                                                <th>Expiry Date</th>
                                                <th>Limit</th>
                                                <th>Uses</th>
                                                <th className="text-right">Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {coupons.map(c => {
                                                const isExpired = c.expiry_date && new Date(c.expiry_date) < new Date(new Date().toISOString().slice(0, 10));
                                                const isLimitReached = c.usage_limit_type === 'custom' && c.times_used >= c.usage_limit;
                                                
                                                return (
                                                    <tr key={c.id}>
                                                        <td className="fw-600">
                                                            <span style={{ 
                                                                background: 'var(--accent-light)', 
                                                                color: 'var(--accent)', 
                                                                padding: '4px 8px', 
                                                                borderRadius: '4px', 
                                                                fontFamily: 'monospace', 
                                                                fontWeight: 'bold',
                                                                letterSpacing: '0.5px' 
                                                            }}>
                                                                {c.code}
                                                            </span>
                                                        </td>
                                                        <td>
                                                            <span style={{ textTransform: 'capitalize', fontWeight: '600', fontSize: '12.5px' }}>
                                                                {c.type === 'discount' ? 'Discount (%)' : c.type === 'currency' ? 'Currency (Flat)' : 'Product Reward'}
                                                            </span>
                                                        </td>
                                                        <td className="fw-600">
                                                            {c.type === 'discount' 
                                                                ? `${c.value}% Off` 
                                                                : c.type === 'currency' 
                                                                    ? `₹${c.value.toLocaleString('en-IN')}` 
                                                                    : (typeof c.value === 'string' && c.value.trim().startsWith('['))
                                                                        ? `Free: ${c.product_name || 'Reward items'}`
                                                                        : `Free: ${c.product_name || 'Product ID #' + c.value} (x${c.reward_quantity || 1})`
                                                            }
                                                        </td>
                                                        <td>
                                                            {c.expiry_date ? (
                                                                <span style={{ color: isExpired ? 'var(--danger)' : 'inherit', fontWeight: isExpired ? '600' : 'normal' }}>
                                                                    {c.expiry_date} {isExpired && ' (Expired)'}
                                                                </span>
                                                            ) : (
                                                                <span style={{ color: 'var(--text-tertiary)' }}>No Expiry</span>
                                                            )}
                                                        </td>
                                                        <td>
                                                            {c.usage_limit_type === 'custom' ? (
                                                                <span style={{ color: isLimitReached ? 'var(--danger)' : 'inherit', fontWeight: isLimitReached ? '600' : 'normal' }}>
                                                                    Max {c.usage_limit} uses {isLimitReached && ' (Limit reached)'}
                                                                </span>
                                                            ) : (
                                                                <span style={{ color: 'var(--text-tertiary)' }}>Unlimited</span>
                                                            )}
                                                        </td>
                                                        <td>
                                                            <span className="fw-600">{c.times_used}</span>
                                                        </td>
                                                        <td className="text-right">
                                                            <SButton variant="secondary" size="small" onClick={() => handleDeleteCoupon(c.id)} title="Delete Coupon" style={{ color: 'var(--danger)' }}>
                                                                Delete
                                                            </SButton>
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="flex-column gap-20" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <div>
                                    <h4 style={{ margin: 0, fontSize: '16px', fontWeight: 600 }}>
                                        {marketingSubTab === 'whatsapp' ? 'Scheduled WhatsApp Campaigns' : marketingSubTab === 'voice' ? 'Scheduled Voice Agent Campaigns (Outbound)' : 'Scheduled Email Campaigns'}
                                    </h4>
                                    <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: 'var(--text-secondary)' }}>
                                        {marketingSubTab === 'whatsapp' 
                                            ? 'Automate sending text updates and promotions to customers via WhatsApp.' 
                                            : marketingSubTab === 'voice'
                                                ? 'Automate calling customers and running phone promotional campaigns via AI Voice Agents.'
                                                : 'Automate sending newsletters, confirmations, and feedback requests to customers.'}
                                    </p>
                                </div>
                                <SButton variant="primary" onClick={() => {
                                    const channel = marketingSubTab === 'whatsapp' ? 'whatsapp' : (marketingSubTab === 'voice' ? 'voice' : 'email');
                                    const defaultTemplate = channel === 'voice' ? (agents[0]?.id || '') : 'marketing_newsletter';
                                    setCampaignForm({
                                        name: '',
                                        customers: [],
                                        startDate: '',
                                        endDate: '',
                                        timeToSend: '09:00',
                                        template: defaultTemplate,
                                        channel: channel,
                                        customContent: ''
                                    });
                                    setShowCampaignModal(true);
                                }}>
                                    Schedule Campaign
                                </SButton>
                            </div>

                            {loadingCampaigns ? (
                                <div className="customers-table-wrap card" style={{ padding: '20px' }}>
                                    <Skeleton type="table" count={3} />
                                </div>
                            ) : (() => {
                                const list = campaigns.filter(camp => 
                                    marketingSubTab === 'whatsapp' ? camp.channel === 'whatsapp' : marketingSubTab === 'voice' ? camp.channel === 'voice' : (camp.channel === 'email' || !camp.channel)
                                );
                                if (list.length === 0) {
                                    return (
                                        <div className="empty-state-premium">
                                            <div className="empty-icon-wrapper">
                                                {marketingSubTab === 'whatsapp' ? <Icons.MessageSquare size={40} /> : marketingSubTab === 'voice' ? <Icons.Phone size={40} /> : <Icons.Mail size={40} />}
                                            </div>
                                            <h3>No Campaigns Found</h3>
                                            <p>
                                                {marketingSubTab === 'whatsapp' 
                                                    ? 'Schedule your first WhatsApp campaign to engage with your customers.'
                                                    : marketingSubTab === 'voice'
                                                        ? 'Schedule your first voice calling campaign to engage with your customers.'
                                                        : 'Schedule your first email campaign to engage with your customers.'}
                                            </p>
                                            <SButton variant="primary" onClick={() => {
                                                const channel = marketingSubTab === 'whatsapp' ? 'whatsapp' : (marketingSubTab === 'voice' ? 'voice' : 'email');
                                                const defaultTemplate = channel === 'voice' ? (agents[0]?.id || '') : 'marketing_newsletter';
                                                setCampaignForm({
                                                    name: '',
                                                    customers: [],
                                                    startDate: '',
                                                    endDate: '',
                                                    timeToSend: '09:00',
                                                    template: defaultTemplate,
                                                    channel: channel,
                                                    customContent: ''
                                                });
                                                setShowCampaignModal(true);
                                            }}>
                                                Schedule Campaign
                                            </SButton>
                                        </div>
                                    );
                                }
                                return (
                                    <div className="customers-table-wrap card">
                                        <table className="premium-table">
                                            <thead>
                                                <tr>
                                                    <th>Campaign Name</th>
                                                    <th>Template</th>
                                                    <th>Customers</th>
                                                    <th>Start Date</th>
                                                    <th>End Date</th>
                                                    <th>Send Time</th>
                                                    <th>Status</th>
                                                    <th className="text-right">Actions</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {list.map(camp => (
                                                    <tr key={camp.id}>
                                                        <td className="fw-600">{camp.name}</td>
                                                        <td>
                                                            <span style={{ textTransform: 'capitalize', fontWeight: '500' }}>
                                                                {camp.template.replace(/_/g, ' ')}
                                                            </span>
                                                        </td>
                                                        <td>{camp.customers?.length || 0} selected</td>
                                                        <td>{camp.start_date}</td>
                                                        <td>{camp.end_date || 'No Expiry'}</td>
                                                        <td>{camp.time_to_send}</td>
                                                        <td>
                                                            <span className={`status-badge ${camp.status}`} style={{
                                                                fontSize: '11px',
                                                                padding: '2px 8px',
                                                                borderRadius: '999px',
                                                                fontWeight: '600',
                                                                background: camp.status === 'completed' ? 'rgba(52, 199, 89, 0.1)' : camp.status === 'scheduled' ? 'rgba(0, 113, 227, 0.1)' : 'rgba(255, 149, 0, 0.1)',
                                                                color: camp.status === 'completed' ? 'var(--success)' : camp.status === 'scheduled' ? 'var(--accent)' : '#d07c00'
                                                            }}>
                                                                {camp.status}
                                                            </span>
                                                        </td>
                                                        <td className="text-right" style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', alignItems: 'center' }}>
                                                            {camp.channel === 'voice' && (
                                                                <SButton variant="secondary" size="small" onClick={() => handleViewVoiceProgress(camp)}>
                                                                    View Progress
                                                                </SButton>
                                                            )}
                                                            {camp.status === 'scheduled' && (
                                                                <SButton variant="secondary" size="small" onClick={() => handleCancelCampaign(camp.id)} style={{ color: 'var(--danger)' }}>
                                                                    Cancel
                                                                </SButton>
                                                            )}
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                );
                            })()}
                        </div>
                    )}
                </div>
            ) : (
                /* Price Lists Tab */
                <div className="pricelists-section flex-column gap-20" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ position: 'relative', width: '300px' }}>
                            <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }}>
                                <Icons.Search size={16} />
                            </span>
                            <input
                                type="text"
                                className="form-control"
                                placeholder="Search price lists..."
                                value={pricelistSearch}
                                onChange={e => setPricelistSearch(e.target.value)}
                                style={{ paddingLeft: '38px', borderRadius: '10px' }}
                            />
                        </div>
                    </div>

                    {loadingPricelists ? (
                        <div className="customers-table-wrap card" style={{ padding: '20px' }}>
                            <Skeleton type="table" count={3} />
                        </div>
                    ) : pricelists.length === 0 ? (
                        <div className="empty-state-premium">
                            <div className="empty-icon-wrapper">
                                <Icons.Settings size={40} />
                            </div>
                            <h3>No Price Lists Found</h3>
                            <p>Create campaign-based discount price lists to apply custom rates during checkout.</p>
                            <SButton variant="primary" onClick={openCreatePricelistModal}>
                                Create Price List
                            </SButton>
                        </div>
                    ) : (() => {
                        const filtered = pricelists.filter(pl => 
                            pl.name.toLowerCase().includes(pricelistSearch.toLowerCase()) ||
                            pl.coupon_code.toLowerCase().includes(pricelistSearch.toLowerCase()) ||
                            (pl.description && pl.description.toLowerCase().includes(pricelistSearch.toLowerCase()))
                        );

                        if (filtered.length === 0) {
                            return (
                                <div className="empty-state-premium" style={{ padding: '40px' }}>
                                    <h3>No Matching Results</h3>
                                    <p>Try searching for a different price list name or coupon code.</p>
                                </div>
                            );
                        }

                        return (
                            <div className="customers-table-wrap card">
                                <table className="premium-table">
                                    <thead>
                                        <tr>
                                            <th>Name</th>
                                            <th>Coupon Code</th>
                                            <th>Description</th>
                                            <th>Discount</th>
                                            <th>Min Order</th>
                                            <th>Uses</th>
                                            <th>Status</th>
                                            <th className="text-right">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {filtered.map(pl => {
                                            const isLimitReached = pl.max_uses > 0 && pl.times_used >= pl.max_uses;
                                            return (
                                                <tr key={pl.id}>
                                                    <td className="fw-600">{pl.name}</td>
                                                    <td className="fw-600">
                                                        <span style={{ 
                                                            background: 'var(--accent-light)', 
                                                            color: 'var(--accent)', 
                                                            padding: '4px 8px', 
                                                            borderRadius: '4px', 
                                                            fontFamily: 'monospace', 
                                                            fontWeight: 'bold',
                                                            letterSpacing: '0.5px' 
                                                        }}>
                                                            {pl.coupon_code}
                                                        </span>
                                                    </td>
                                                    <td className="text-secondary" style={{ maxWidth: '250px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                        {pl.description || '—'}
                                                    </td>
                                                    <td className="fw-600">
                                                        {pl.discount_type === 'Percentage' ? `${pl.discount_value}% Off` : `₹${pl.discount_value} Off`}
                                                    </td>
                                                    <td>
                                                        {pl.min_order_amount > 0 ? `₹${pl.min_order_amount}` : 'No Min'}
                                                    </td>
                                                    <td>
                                                        {pl.times_used} / {pl.max_uses > 0 ? pl.max_uses : '∞'}
                                                    </td>
                                                    <td>
                                                        {pl.active === 1 && !isLimitReached ? (
                                                            <span style={{
                                                                background: 'rgba(46, 204, 113, 0.1)',
                                                                color: 'var(--success)',
                                                                padding: '4px 8px',
                                                                borderRadius: '4px',
                                                                fontSize: '12px',
                                                                fontWeight: '600'
                                                            }}>
                                                                Active
                                                            </span>
                                                        ) : (
                                                            <span style={{
                                                                background: 'rgba(231, 76, 60, 0.1)',
                                                                color: 'var(--danger)',
                                                                padding: '4px 8px',
                                                                borderRadius: '4px',
                                                                fontSize: '12px',
                                                                fontWeight: '600'
                                                            }}>
                                                                {isLimitReached ? 'Limit Reached' : 'Inactive'}
                                                            </span>
                                                        )}
                                                    </td>
                                                    <td className="text-right">
                                                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', alignItems: 'center' }}>
                                                            <button 
                                                                className="tier-card-settings-btn" 
                                                                onClick={() => openEditPricelist(pl)} 
                                                                title="Edit Price List"
                                                                style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--text-secondary)' }}
                                                            >
                                                                <Icons.Settings size={16} />
                                                            </button>
                                                            <button 
                                                                className="tier-card-settings-btn" 
                                                                onClick={() => handleDeletePricelist(pl.id)} 
                                                                title="Delete Price List"
                                                                style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--danger)' }}
                                                            >
                                                                <Icons.Delete size={16} />
                                                            </button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        );
                    })()}
                </div>
            )}

            {/* Save/Add Customer Modal */}
            <Modal 
                open={showModal} 
                onClose={() => setShowModal(false)} 
                heading={editingCustomer ? 'Edit Customer' : 'Add Customer'}
                size="base"
                primaryAction={
                    <SButton variant="primary" onClick={handleSave} loading={saving} disabled={saving}>
                        {editingCustomer ? 'Update Details' : 'Save Customer'}
                    </SButton>
                }
                secondaryActions={
                    <SButton onClick={() => setShowModal(false)}>Cancel</SButton>
                }
            >
                <div className="flex-column gap-16">
                    <FormGroup label="Customer Name" required>
                        <Input 
                            value={form.name} 
                            onChange={e => setForm({ ...form, name: e.target.value })} 
                            placeholder="e.g. John Doe" 
                        />
                    </FormGroup>
                    <div className="grid-2 gap-16">
                        <FormGroup label="Phone Number">
                            <Input 
                                value={form.phone} 
                                onChange={e => setForm({ ...form, phone: e.target.value })} 
                                placeholder="e.g. +91 98765 43210" 
                            />
                        </FormGroup>
                        <FormGroup label="Email Address">
                            <Input 
                                type="email"
                                value={form.email} 
                                onChange={e => setForm({ ...form, email: e.target.value })} 
                                placeholder="e.g. john@example.com" 
                            />
                        </FormGroup>
                    </div>
                    <div className="grid-2 gap-16">
                        <FormGroup 
                            label={
                                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                    Customer Tier
                                    {settings?.license_plan === 'Free' && (
                                        <Icons.Lock size={12} style={{ color: '#94a3b8' }} title="Requires Business PRO" />
                                    )}
                                </div>
                            }
                        >
                            <div 
                                onClick={() => {
                                    if (settings?.license_plan === 'Free') {
                                        toast.info("Customer Tier categorizations require the Business PRO plan. Click the upgrade link in the sidebar to unlock.");
                                    }
                                }}
                                style={{ cursor: settings?.license_plan === 'Free' ? 'pointer' : 'default' }}
                                title={settings?.license_plan === 'Free' ? "Customer Tier categorizations require the Business PRO plan." : undefined}
                            >
                                <CustomSelect 
                                    value={settings?.license_plan === 'Free' ? 'C' : form.tier} 
                                    onChange={value => {
                                        if (settings?.license_plan === 'Free') return;
                                        setForm({ ...form, tier: value });
                                    }} 
                                    disabled={settings?.license_plan === 'Free'}
                                    options={[
                                        { value: 'A', label: 'Tier A' },
                                        { value: 'B', label: 'Tier B' },
                                        { value: 'C', label: 'Tier C' }
                                    ]}
                                />
                            </div>
                        </FormGroup>
                        <FormGroup 
                            label={
                                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                    Credit Limit (₹)
                                    {settings?.license_plan === 'Free' && (
                                        <Icons.Lock size={12} style={{ color: '#94a3b8' }} title="Requires Business PRO" />
                                    )}
                                </div>
                            }
                        >
                            <div 
                                onClick={() => {
                                    if (settings?.license_plan === 'Free') {
                                        toast.info("Credit limit controls require the Business PRO plan. Click the upgrade link in the sidebar to unlock.");
                                    }
                                }}
                                style={{ cursor: settings?.license_plan === 'Free' ? 'pointer' : 'default' }}
                                title={settings?.license_plan === 'Free' ? "Credit limit controls require the Business PRO plan." : undefined}
                            >
                                <Input 
                                    type="number"
                                    min="0"
                                    step="any"
                                    value={settings?.license_plan === 'Free' ? 0 : form.credit_limit} 
                                    onChange={e => {
                                        if (settings?.license_plan === 'Free') return;
                                        setForm({ ...form, credit_limit: e.target.value === '' ? '' : Number(e.target.value) });
                                    }} 
                                    disabled={settings?.license_plan === 'Free'}
                                    placeholder="e.g. 5000" 
                                />
                            </div>
                        </FormGroup>
                    </div>
                    <FormGroup label="GST Number (Optional)">
                        <Input 
                            value={form.gstin} 
                            onChange={e => setForm({ ...form, gstin: e.target.value.toUpperCase() })} 
                            placeholder="e.g. 07AAAAA0000A1Z5" 
                        />
                    </FormGroup>
                    <FormGroup label="Residential/Business Address">
                        <textarea 
                            rows={3} 
                            value={form.address} 
                            onChange={e => setForm({ ...form, address: e.target.value })} 
                            placeholder="Enter full address..." 
                            className="form-control"
                        />
                    </FormGroup>
                </div>
            </Modal>

            {/* Delete Customer Modal */}
            <Modal
                open={!!deleteId}
                onClose={() => setDeleteId(null)}
                heading="Delete Customer"
                size="small"
                variant="critical"
                primaryAction={
                    <SButton variant="primary" tone="critical" onClick={handleDelete}>Delete Permanently</SButton>
                }
                secondaryActions={
                    <SButton onClick={() => setDeleteId(null)}>Cancel</SButton>
                }
            >
                <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                    <div style={{ color: 'var(--danger)', marginTop: '2px' }}>
                        <Icons.AlertCircle size={20} />
                    </div>
                    <div>
                        <p style={{ fontWeight: 600, marginBottom: '4px' }}>Are you absolutely sure?</p>
                        <p className="text-secondary" style={{ fontSize: '13px' }}>
                            This action will permanently remove the customer and all associated local records. This cannot be undone.
                        </p>
                    </div>
                </div>
            </Modal>

            {/* Manage Tier Settings Modal */}
            <Modal
                open={showSettingsModal}
                onClose={() => setShowSettingsModal(false)}
                heading={`Manage Tier ${editingTier} Discount`}
                size="small"
                primaryAction={
                    <SButton variant="primary" onClick={handleSaveTierDiscount} loading={savingSettings} disabled={savingSettings}>
                        Save Changes
                    </SButton>
                }
                secondaryActions={
                    <SButton onClick={() => setShowSettingsModal(false)}>Cancel</SButton>
                }
            >
                <div className="flex-column gap-16">
                    <FormGroup label="Default Discount Percentage (%)" required>
                        <Input 
                            type="number" 
                            min="0" 
                            max="100" 
                            step="any" 
                            value={editingTierDiscount} 
                            onChange={e => setEditingTierDiscount(e.target.value)} 
                            placeholder="e.g. 10" 
                        />
                    </FormGroup>
                    <p className="text-secondary" style={{ fontSize: '12.5px', lineHeight: 1.4 }}>
                        This discount rate will be automatically applied at checkout when a customer of Tier {editingTier} is selected at the sales point.
                    </p>
                </div>
            </Modal>

            {/* Customer Details & History Tabbed Modal */}
            <Modal
                id="customer-history-modal"
                open={!!historyCustomer}
                onClose={() => setHistoryCustomer(null)}
                heading={`Customer Details — ${historyCustomer?.name}`}
                size="large"
                secondaryActions={
                    <SButton onClick={() => setHistoryCustomer(null)}>Close</SButton>
                }
            >
                <div>
                    <div className="crm-modal-tabs">
                        <button 
                            className={`crm-tab-btn ${activeTab === 'purchases' ? 'active' : ''}`}
                            onClick={() => setActiveTab('purchases')}
                        >
                            <Icons.ShoppingCart size={16} />
                            Purchase History
                        </button>
                        <button 
                            className={`crm-tab-btn ${activeTab === 'communication' ? 'active' : ''}`}
                            onClick={() => setActiveTab('communication')}
                        >
                            <Icons.MessageSquare size={16} />
                            Communication Logs
                        </button>
                        {settings.enable_loyalty_points === 'true' && (
                            <button 
                                className={`crm-tab-btn ${activeTab === 'loyalty' ? 'active' : ''}`}
                                onClick={() => {
                                    setActiveTab('loyalty');
                                    loadLoyaltyDetails(historyCustomer.id);
                                }}
                            >
                                <Icons.Award size={16} />
                                Loyalty Points
                            </button>
                        )}
                    </div>

                    {activeTab === 'purchases' && (
                        <div className="card" style={{ border: 'none', boxShadow: 'none', padding: 0 }}>
                            {purchases.length === 0 ? (
                                <div className="empty-state">
                                    <Icons.ShoppingCart size={32} />
                                    <p>No purchase history found</p>
                                </div>
                            ) : (
                                <table className="premium-table">
                                    <thead>
                                        <tr>
                                            <th>Invoice #</th>
                                            <th>Items</th>
                                            <th className="text-right">Total</th>
                                            <th className="text-right">Date</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {purchases.map(inv => (
                                            <tr key={inv.id}>
                                                <td className="fw-600">INV-{String(inv.id).padStart(4, '0')}</td>
                                                <td className="text-secondary">{inv.items?.length || 0} Products</td>
                                                <td className="fw-600 text-right">₹{Number(inv.total).toLocaleString('en-IN')}</td>
                                                <td className="text-secondary text-right">{formatDate(inv.date)}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            )}
                        </div>
                    )}

                    {activeTab === 'communication' && (
                        <div>
                            {/* Log new activity form */}
                            <div className="log-activity-form">
                                <h4>Log Customer Interaction</h4>
                                <div className="log-activity-row">
                                    <div className="log-activity-type">
                                        <CustomSelect 
                                            value={logForm.type}
                                            onChange={type => setLogForm({ ...logForm, type })}
                                            options={[
                                                { value: 'Call', label: <span className="select-icon-label"><Icons.Phone size={14} /> Call</span> },
                                                { value: 'Email', label: <span className="select-icon-label"><Icons.Mail size={14} /> Email</span> },
                                                { value: 'SMS', label: <span className="select-icon-label"><Icons.MessageSquare size={14} /> SMS</span> },
                                                { value: 'Meeting', label: <span className="select-icon-label"><Icons.Users size={14} /> Meeting</span> },
                                                { value: 'Other', label: <span className="select-icon-label"><Icons.Info size={14} /> Other</span> }
                                            ]}
                                        />
                                    </div>
                                    <div className="log-activity-notes">
                                        <Input 
                                            value={logForm.notes}
                                            onChange={e => setLogForm({ ...logForm, notes: e.target.value })}
                                            placeholder="Type interaction notes (e.g. 'Discussed credit terms and catalog')..."
                                            onKeyDown={e => {
                                                if (e.key === 'Enter') handleAddLog();
                                            }}
                                        />
                                    </div>
                                    <SButton variant="primary" onClick={handleAddLog} loading={savingLog} disabled={savingLog}>
                                        Log
                                    </SButton>
                                </div>
                            </div>

                            {/* Timeline list */}
                            <div className="communications-timeline">
                                {loadingLogs ? (
                                    <div style={{ padding: '20px' }}>
                                        <Skeleton type="list" count={4} />
                                    </div>
                                ) : logs.length === 0 ? (
                                    <div className="empty-state">
                                        <Icons.MessageSquare size={32} />
                                        <p>No communication logs found. Record a call or email above to begin tracking.</p>
                                    </div>
                                ) : (
                                    <div className="timeline-items">
                                        {logs.map(log => {
                                            let typeIcon = <Icons.Info size={16} />;
                                            let badgeClass = 'timeline-badge-other';
                                            if (log.type === 'Call') {
                                                typeIcon = <Icons.Phone size={16} />;
                                                badgeClass = 'timeline-badge-call';
                                            } else if (log.type === 'Email') {
                                                typeIcon = <Icons.Mail size={16} />;
                                                badgeClass = 'timeline-badge-email';
                                            } else if (log.type === 'SMS') {
                                                typeIcon = <Icons.MessageSquare size={16} />;
                                                badgeClass = 'timeline-badge-sms';
                                            } else if (log.type === 'Meeting') {
                                                typeIcon = <Icons.Users size={16} />;
                                                badgeClass = 'timeline-badge-meeting';
                                            }
                                            return (
                                                <div className={`timeline-item timeline-item-${log.type.toLowerCase()}`} key={log.id}>
                                                    <div className={`timeline-badge ${badgeClass}`}>
                                                        {typeIcon}
                                                    </div>
                                                    <div className="timeline-body">
                                                        <div className="timeline-header">
                                                            <span className="log-type-tag">{log.type}</span>
                                                            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                                                <span className="log-date">{formatDate(log.date)}</span>
                                                                <button 
                                                                    className="delete-log-btn"
                                                                    onClick={() => handleDeleteLog(log.id)}
                                                                    title="Delete log"
                                                                >
                                                                    <Icons.Delete size={14} />
                                                                </button>
                                                            </div>
                                                        </div>
                                                        <div className="timeline-notes">
                                                            {log.notes}
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {activeTab === 'loyalty' && (
                        <div>
                            {loadingLoyalty ? (
                                <div style={{ padding: '20px' }}>
                                    <Skeleton type="list" count={4} />
                                </div>
                            ) : !loyaltyDetails ? (
                                <div className="empty-state">
                                    <Icons.Award size={32} />
                                    <p>Failed to load loyalty details</p>
                                </div>
                            ) : (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                                    {/* Loyalty KPI Cards */}
                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px' }}>
                                        <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-light)', borderRadius: '12px', padding: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <div>
                                                <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Current Balance</div>
                                                <div style={{ fontSize: '28px', fontWeight: 700, color: 'var(--accent)', marginTop: '8px' }}>
                                                    {loyaltyDetails.points.toLocaleString('en-IN')} <span style={{ fontSize: '16px', fontWeight: 500 }}>pts</span>
                                                </div>
                                            </div>
                                            <div style={{ background: 'var(--accent-light)', color: 'var(--accent)', borderRadius: '50%', width: '48px', height: '48px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                <Icons.Award size={24} />
                                            </div>
                                        </div>

                                        <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-light)', borderRadius: '12px', padding: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <div>
                                                <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Redeemable Value</div>
                                                <div style={{ fontSize: '28px', fontWeight: 700, color: 'var(--success)', marginTop: '8px' }}>
                                                    ₹{loyaltyDetails.cashValue.toLocaleString('en-IN')}
                                                </div>
                                            </div>
                                            <SButton variant="secondary" onClick={() => setShowAdjustPointsModal(true)} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                <Icons.Settings size={14} /> Adjust Points
                                            </SButton>
                                        </div>
                                    </div>

                                    {/* Transaction History */}
                                    <div>
                                        <h4 style={{ margin: '0 0 12px 0', fontSize: '15px', fontWeight: 600 }}>Loyalty Transactions History</h4>
                                        {loyaltyDetails.history.length === 0 ? (
                                            <div className="empty-state" style={{ padding: '30px' }}>
                                                <Icons.Award size={24} style={{ opacity: 0.5, marginBottom: '8px' }} />
                                                <p style={{ fontSize: '13px' }}>No transactions recorded yet.</p>
                                            </div>
                                        ) : (
                                            <div style={{ overflowX: 'auto', border: '1px solid var(--border-light)', borderRadius: '8px' }}>
                                                <table className="premium-table" style={{ margin: 0 }}>
                                                    <thead>
                                                        <tr>
                                                            <th>Date</th>
                                                            <th>Type</th>
                                                            <th className="text-right">Points</th>
                                                            <th className="text-right">Balance After</th>
                                                            <th>Note</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {loyaltyDetails.history.map(tx => {
                                                            let badgeColor = 'var(--text-secondary)';
                                                            let badgeBg = 'rgba(0,0,0,0.05)';
                                                            if (tx.type === 'EARN') {
                                                                badgeColor = 'var(--success)';
                                                                badgeBg = 'rgba(46, 204, 113, 0.1)';
                                                            } else if (tx.type === 'REDEEM') {
                                                                badgeColor = 'var(--warning)';
                                                                badgeBg = 'rgba(243, 156, 18, 0.1)';
                                                            } else if (tx.type === 'REVERSAL') {
                                                                badgeColor = 'var(--danger)';
                                                                badgeBg = 'rgba(231, 76, 60, 0.1)';
                                                            } else if (tx.type === 'ADJUST') {
                                                                badgeColor = 'var(--accent)';
                                                                badgeBg = 'var(--accent-light)';
                                                            } else if (tx.type === 'EXPIRE') {
                                                                badgeColor = '#7f8c8d';
                                                                badgeBg = '#f2f2f2';
                                                            }

                                                            const isPositive = tx.points > 0;

                                                            return (
                                                                <tr key={tx.id}>
                                                                    <td className="text-secondary">{formatDate(tx.created_at, true)}</td>
                                                                    <td>
                                                                        <span style={{ 
                                                                            display: 'inline-block',
                                                                            padding: '2px 8px', 
                                                                            borderRadius: '20px', 
                                                                            fontSize: '11px', 
                                                                            fontWeight: 700, 
                                                                            color: badgeColor, 
                                                                            background: badgeBg,
                                                                            textTransform: 'uppercase'
                                                                        }}>
                                                                            {tx.type}
                                                                        </span>
                                                                    </td>
                                                                    <td className="fw-600 text-right" style={{ color: isPositive ? 'var(--success)' : 'var(--danger)' }}>
                                                                        {isPositive ? `+${tx.points}` : tx.points}
                                                                    </td>
                                                                    <td className="fw-600 text-right">{tx.balance_after}</td>
                                                                    <td className="text-secondary">{tx.note || '—'}</td>
                                                                </tr>
                                                            );
                                                        })}
                                                    </tbody>
                                                </table>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </Modal>

            {/* Adjust Points Modal */}
            <Modal
                open={showAdjustPointsModal}
                onClose={() => setShowAdjustPointsModal(false)}
                heading="Adjust Loyalty Points"
                size="base"
                primaryAction={
                    <SButton variant="primary" onClick={handleAdjustPoints} loading={adjustingPoints} disabled={adjustingPoints}>
                        Apply Adjustment
                    </SButton>
                }
                secondaryActions={
                    <SButton onClick={() => setShowAdjustPointsModal(false)}>Cancel</SButton>
                }
            >
                <div className="flex-column gap-16">
                    <FormGroup label="Points Difference (Positive or Negative)" required>
                        <Input
                            type="number"
                            value={adjustPointsForm.points}
                            onChange={e => setAdjustPointsForm({ ...adjustPointsForm, points: e.target.value })}
                            placeholder="e.g. 100 to add, -50 to subtract"
                        />
                    </FormGroup>
                    <FormGroup label="Adjustment Note" required>
                        <Input
                            value={adjustPointsForm.note}
                            onChange={e => setAdjustPointsForm({ ...adjustPointsForm, note: e.target.value })}
                            placeholder="e.g. Customer service correction"
                        />
                    </FormGroup>
                </div>
            </Modal>

            {/* Create Coupon Modal */}
            <Modal
                open={showCouponModal}
                onClose={() => setShowCouponModal(false)}
                heading="Create Coupon"
                size="base"
                primaryAction={
                    <SButton variant="primary" onClick={handleSaveCoupon} loading={savingCoupon} disabled={savingCoupon}>
                        Save Coupon
                    </SButton>
                }
                secondaryActions={
                    <SButton onClick={() => setShowCouponModal(false)}>Cancel</SButton>
                }
            >
                <div className="flex-column gap-16">
                    <FormGroup label="Coupon Code" required>
                        <Input
                            value={couponForm.code}
                            onChange={e => setCouponForm({ ...couponForm, code: e.target.value.toUpperCase().replace(/[^A-Z0-9_-]/g, '') })}
                            placeholder="e.g. SAVE20, WELCOME500"
                        />
                        <p style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '4px' }}>Alphanumeric characters only, automatically capitalized.</p>
                    </FormGroup>
                    
                    <div className="grid-2 gap-16">
                        <FormGroup label="Coupon Type">
                            <CustomSelect
                                value={couponForm.type}
                                onChange={type => setCouponForm({ ...couponForm, type, value: '' })}
                                options={[
                                    { value: 'discount', label: 'Percentage Discount' },
                                    { value: 'currency', label: 'Flat Currency Discount' },
                                    { value: 'product', label: 'Free Product Reward' }
                                ]}
                            />
                        </FormGroup>
                        
                        {couponForm.type === 'product' ? (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', border: '1px solid var(--border-light)', borderRadius: '8px', padding: '12px', background: 'var(--bg-secondary)', gridColumn: 'span 2' }}>
                                <div style={{ fontSize: 'var(--font-size-xs)', fontWeight: '700', textTransform: 'uppercase', color: 'var(--text-secondary)' }}>Inventory Catalog Selector</div>
                                
                                {/* Filter Row */}
                                <div className="grid-4 gap-8" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))' }}>
                                    <FormGroup label="Search">
                                        <input 
                                            type="text" 
                                            placeholder="Search name/code..." 
                                            value={catalogSearch} 
                                            onChange={e => setCatalogSearch(e.target.value)}
                                            style={{ height: '32px', fontSize: '12px', width: '100%', boxSizing: 'border-box', border: '1px solid var(--border-strong)', borderRadius: '4px', padding: '0 8px', background: 'var(--bg-primary)', color: 'var(--text-primary)' }}
                                        />
                                    </FormGroup>
                                    <FormGroup label="Category">
                                        <CustomSelect 
                                            value={catalogCategory} 
                                            onChange={setCatalogCategory}
                                            options={productCategories.map(c => ({ value: c, label: c }))}
                                            style={{ height: '32px' }}
                                        />
                                    </FormGroup>
                                    <FormGroup label="Subcategory">
                                        <CustomSelect 
                                            value={catalogSubcategory} 
                                            onChange={setCatalogSubcategory}
                                            options={productSubcategories.map(s => ({ value: s, label: s }))}
                                            style={{ height: '32px' }}
                                        />
                                    </FormGroup>
                                    <FormGroup label="Brand">
                                        <CustomSelect 
                                            value={catalogBrand} 
                                            onChange={setCatalogBrand}
                                            options={productBrands.map(b => ({ value: b, label: b }))}
                                            style={{ height: '32px' }}
                                        />
                                    </FormGroup>
                                </div>

                                {/* Catalog Scroll Area */}
                                <div style={{ height: '160px', overflowY: 'auto', border: '1px solid var(--border-strong)', borderRadius: '6px', background: 'var(--bg-primary)', display: 'flex', flexDirection: 'column' }}>
                                    {filteredCatalogProducts.length === 0 ? (
                                        <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-tertiary)', fontSize: '12px' }}>
                                            No matching products found.
                                        </div>
                                    ) : (
                                        filteredCatalogProducts.map(p => {
                                            const isSelected = selectedProducts.some(sp => sp.id === p.id);
                                            return (
                                                <div 
                                                    key={p.id}
                                                    onClick={() => {
                                                        setSelectedProducts(prev => {
                                                            const isSel = prev.some(sp => sp.id === p.id);
                                                            if (isSel) {
                                                                return prev.filter(sp => sp.id !== p.id);
                                                            } else {
                                                                return [...prev, { id: p.id, name: p.name, qty: 1 }];
                                                            }
                                                        });
                                                    }}
                                                    style={{
                                                        display: 'flex',
                                                        justifyContent: 'space-between',
                                                        alignItems: 'center',
                                                        padding: '8px 12px',
                                                        borderBottom: '1px solid var(--border-light)',
                                                        cursor: 'pointer',
                                                        background: isSelected ? 'var(--accent-light)' : 'transparent',
                                                        transition: 'background 0.15s ease'
                                                    }}
                                                >
                                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                                        <span style={{ fontWeight: isSelected ? '700' : '500', color: isSelected ? 'var(--accent)' : 'var(--text-primary)', fontSize: '13px' }}>
                                                            {p.name}
                                                        </span>
                                                        <span style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>
                                                            {p.brand_name || 'Generic'} • {p.subcategory_name || 'General'} • Code: {p.product_code || '—'}
                                                        </span>
                                                    </div>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                                        <span style={{ fontWeight: '600', color: 'var(--text-secondary)', fontSize: '12px' }}>
                                                            ₹{Number(p.selling_price || 0).toFixed(2)}
                                                        </span>
                                                        {isSelected && (
                                                            <Icons.CheckCircle size={14} style={{ color: 'var(--accent)' }} />
                                                        )}
                                                    </div>
                                                </div>
                                            );
                                        })
                                    )}
                                </div>

                                {/* Selected Products Tags container */}
                                {selectedProducts.length > 0 ? (
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', borderTop: '1px solid var(--border-light)', paddingTop: '10px', marginTop: '4px' }}>
                                        {selectedProducts.map(sp => (
                                            <div 
                                                key={sp.id} 
                                                style={{ 
                                                    display: 'inline-flex', 
                                                    alignItems: 'center', 
                                                    gap: '6px', 
                                                    background: 'var(--accent-light)', 
                                                    border: '1px solid var(--accent)', 
                                                    color: 'var(--accent)', 
                                                    padding: '4px 8px', 
                                                    borderRadius: '4px', 
                                                    fontSize: '12px', 
                                                    fontWeight: '600' 
                                                }}
                                            >
                                                <span>{sp.name}</span>
                                                <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                                                    <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>qty:</span>
                                                    <input 
                                                        type="number" 
                                                        min="1" 
                                                        value={sp.qty} 
                                                        onChange={e => {
                                                            const val = Math.max(1, Math.floor(Number(e.target.value || 1)));
                                                            setSelectedProducts(prev => prev.map(p => p.id === sp.id ? { ...p, qty: val } : p));
                                                        }}
                                                        onClick={e => e.stopPropagation()} // Prevent list toggle
                                                        style={{ 
                                                            width: '45px', 
                                                            height: '22px',
                                                            border: '1px solid var(--border-strong)', 
                                                            borderRadius: '4px', 
                                                            padding: '0 4px', 
                                                            fontSize: '11px', 
                                                            textAlign: 'center', 
                                                            background: 'var(--bg-primary)', 
                                                            color: 'var(--text-primary)' 
                                                        }} 
                                                    />
                                                </div>
                                                <button 
                                                    type="button" 
                                                    onClick={(e) => {
                                                        e.stopPropagation(); // Prevent list toggle
                                                        setSelectedProducts(prev => prev.filter(p => p.id !== sp.id));
                                                    }}
                                                    style={{ 
                                                        background: 'none', 
                                                        border: 'none', 
                                                        color: 'var(--accent)', 
                                                        cursor: 'pointer', 
                                                        display: 'inline-flex', 
                                                        alignItems: 'center', 
                                                        padding: 0,
                                                        marginLeft: '4px'
                                                    }}
                                                >
                                                    <Icons.X size={12} />
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div style={{ fontSize: '12px', color: 'var(--text-secondary)', fontStyle: 'italic', borderTop: '1px solid var(--border-light)', paddingTop: '10px', marginTop: '4px' }}>
                                        No products selected yet. Click on products above to select them.
                                    </div>
                                )}
                            </div>
                        ) : (
                            <FormGroup label={couponForm.type === 'discount' ? "Discount Percentage (%)" : "Flat Amount (₹)"} required>
                                <Input
                                    type="number"
                                    min="0"
                                    step="any"
                                    value={couponForm.value}
                                    onChange={e => setCouponForm({ ...couponForm, value: e.target.value })}
                                    placeholder={couponForm.type === 'discount' ? "e.g. 15" : "e.g. 250"}
                                />
                            </FormGroup>
                        )}
                    </div>

                    <div className="grid-2 gap-16">
                        <FormGroup label="Expiry Date (Optional)">
                            <Input
                                type="date"
                                value={couponForm.expiry_date}
                                onChange={e => setCouponForm({ ...couponForm, expiry_date: e.target.value })}
                            />
                        </FormGroup>
                        
                        <FormGroup label="Usage Limit">
                            <CustomSelect
                                value={couponForm.usage_limit_type}
                                onChange={usage_limit_type => setCouponForm({ ...couponForm, usage_limit_type, usage_limit: usage_limit_type === 'custom' ? '1' : '' })}
                                options={[
                                    { value: 'unlimited', label: 'Unlimited Uses' },
                                    { value: 'custom', label: 'Custom Limit' }
                                ]}
                            />
                        </FormGroup>
                    </div>

                    {couponForm.usage_limit_type === 'custom' && (
                        <FormGroup label="Max Number of Uses" required>
                            <Input
                                type="number"
                                min="1"
                                value={couponForm.usage_limit}
                                onChange={e => setCouponForm({ ...couponForm, usage_limit: e.target.value })}
                                placeholder="e.g. 100"
                            />
                        </FormGroup>
                    )}
                </div>
            </Modal>

            {/* Create/Edit Pricelist Modal */}
            <Modal
                open={showPricelistModal}
                onClose={() => setShowPricelistModal(false)}
                heading={editingPricelist ? "Edit Price List" : "Create Price List"}
                size="base"
                primaryAction={
                    <SButton variant="primary" onClick={handleSavePricelist} loading={savingPricelist} disabled={savingPricelist}>
                        {editingPricelist ? "Save Changes" : "Create Price List"}
                    </SButton>
                }
                secondaryActions={
                    <SButton onClick={() => setShowPricelistModal(false)}>Cancel</SButton>
                }
            >
                <div className="flex-column gap-16">
                    <FormGroup label="Price List Name" required>
                        <Input
                            value={pricelistForm.name}
                            onChange={e => setPricelistForm({ ...pricelistForm, name: e.target.value })}
                            placeholder="e.g. Summer Special Discount"
                        />
                    </FormGroup>
                    <div className="grid-2 gap-16">
                        <FormGroup label="Coupon Code" required>
                            <Input
                                value={pricelistForm.coupon_code}
                                onChange={e => setPricelistForm({ ...pricelistForm, coupon_code: e.target.value.toUpperCase().replace(/[^A-Z0-9_-]/g, '') })}
                                placeholder="e.g. SUMMER20"
                                disabled={!!editingPricelist}
                            />
                        </FormGroup>
                        <FormGroup label="Discount Type" required>
                            <CustomSelect
                                value={pricelistForm.discount_type}
                                onChange={value => setPricelistForm({ ...pricelistForm, discount_type: value })}
                                options={[
                                    { value: 'Percentage', label: 'Percentage (%)' },
                                    { value: 'Fixed', label: 'Fixed Amount (₹)' }
                                ]}
                            />
                        </FormGroup>
                    </div>
                    <div className="grid-2 gap-16">
                        <FormGroup label={`Discount Value (${pricelistForm.discount_type === 'Percentage' ? '%' : '₹'})`} required>
                            <Input
                                type="number"
                                min="0"
                                step="any"
                                value={pricelistForm.discount_value}
                                onChange={e => setPricelistForm({ ...pricelistForm, discount_value: e.target.value })}
                                placeholder="e.g. 15"
                            />
                        </FormGroup>
                        <FormGroup label="Minimum Order Amount (₹)">
                            <Input
                                type="number"
                                min="0"
                                step="any"
                                value={pricelistForm.min_order_amount}
                                onChange={e => setPricelistForm({ ...pricelistForm, min_order_amount: e.target.value })}
                                placeholder="e.g. 500 (0 for none)"
                            />
                        </FormGroup>
                    </div>
                    <div className="grid-2 gap-16">
                        <FormGroup label="Max Uses (Across all sales)">
                            <Input
                                type="number"
                                min="0"
                                value={pricelistForm.max_uses}
                                onChange={e => setPricelistForm({ ...pricelistForm, max_uses: e.target.value })}
                                placeholder="e.g. 100 (0 for unlimited)"
                            />
                        </FormGroup>
                        <FormGroup label="Status" required>
                            <CustomSelect
                                value={pricelistForm.active}
                                onChange={value => setPricelistForm({ ...pricelistForm, active: Number(value) })}
                                options={[
                                    { value: 1, label: 'Active' },
                                    { value: 0, label: 'Inactive' }
                                ]}
                            />
                        </FormGroup>
                    </div>
                    <FormGroup label="Description (Optional)">
                        <textarea
                            rows={2}
                            value={pricelistForm.description}
                            onChange={e => setPricelistForm({ ...pricelistForm, description: e.target.value })}
                            placeholder="Describe when this price list is applied..."
                            className="form-control"
                            style={{ resize: 'vertical' }}
                        />
                    </FormGroup>
                </div>
            </Modal>

            {/* Schedule Campaign Modal */}
            <Modal
                open={showCampaignModal}
                onClose={() => setShowCampaignModal(false)}
                heading={campaignForm.channel === 'voice' ? "Schedule Voice Agent Campaign" : (campaignForm.channel === 'whatsapp' ? "Schedule WhatsApp Campaign" : "Schedule Email Campaign")}
                size="large"
                primaryAction={
                    <SButton variant="primary" onClick={handleSaveCampaign} loading={savingCampaign} disabled={savingCampaign}>
                        Schedule Campaign
                    </SButton>
                }
                secondaryActions={
                    <SButton onClick={() => setShowCampaignModal(false)}>Cancel</SButton>
                }
            >
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.1fr', gap: '24px', minHeight: '480px' }}>
                    {/* Left Column: Form Fields */}
                    <div className="flex-column gap-16" style={{ minWidth: 0, display: 'flex', flexDirection: 'column', gap: '16px' }}>
                        <FormGroup label="Campaign Name" required>
                            <Input
                                value={campaignForm.name}
                                onChange={e => setCampaignForm({ ...campaignForm, name: e.target.value })}
                                placeholder="e.g. Summer Discount Blast"
                            />
                        </FormGroup>
                        <FormGroup label={campaignForm.channel === 'voice' ? "Voice Agent Selection" : "Template Selection"} required>
                            <CustomSelect
                                value={campaignForm.template}
                                onChange={template => setCampaignForm({ ...campaignForm, template })}
                                options={
                                    campaignForm.channel === 'voice'
                                        ? agents.map(agent => ({ value: agent.id, label: agent.name }))
                                        : [
                                            { value: 'marketing_newsletter', label: 'General Marketing Newsletter' },
                                            { value: 'due_balance', label: 'Due Balance Statement' },
                                            { value: 'festival_offer', label: 'Festival Offer (Diwali/Holi/Eid Sale)' },
                                            { value: 'discount_coupon', label: 'Discount Coupon' },
                                            { value: 'new_arrivals', label: 'New Arrivals' },
                                            { value: 'flash_sale', label: 'Flash Sale (Limited Offer)' },
                                            { value: 'clearance_sale', label: 'Clearance Sale (Stock Clearance)' },
                                            { value: 'back_in_stock', label: 'Back In Stock (Available Again)' }
                                        ]
                                }
                            />
                        </FormGroup>

                        {campaignForm.template === 'marketing_newsletter' && (
                            <FormGroup label="Newsletter Message Content" required>
                                <textarea
                                    value={campaignForm.customContent || ''}
                                    onChange={e => setCampaignForm({ ...campaignForm, customContent: e.target.value })}
                                    placeholder="Write your custom newsletter message here..."
                                    style={{
                                        width: '100%',
                                        minHeight: '120px',
                                        padding: '10px',
                                        borderRadius: '6px',
                                        border: '1px solid var(--border-light)',
                                        background: 'var(--bg-primary)',
                                        color: 'var(--text-primary)',
                                        fontFamily: 'inherit',
                                        fontSize: '13px',
                                        resize: 'vertical'
                                    }}
                                />
                            </FormGroup>
                        )}

                        <div className="grid-2 gap-16" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                            <FormGroup label="Time to Send" required>
                                <Input
                                    type="time"
                                    value={campaignForm.timeToSend}
                                    onChange={e => setCampaignForm({ ...campaignForm, timeToSend: e.target.value })}
                                />
                            </FormGroup>

                            <FormGroup label="Start Date" required>
                                <Input
                                    type="date"
                                    value={campaignForm.startDate}
                                    onChange={e => setCampaignForm({ ...campaignForm, startDate: e.target.value })}
                                />
                            </FormGroup>
                        </div>

                        <div className="grid-2 gap-16" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                            <FormGroup label="End Date (Optional)">
                                <Input
                                    type="date"
                                    value={campaignForm.endDate}
                                    onChange={e => setCampaignForm({ ...campaignForm, endDate: e.target.value })}
                                />
                            </FormGroup>
                        </div>

                        <FormGroup label="Select Recipients (Customers)" required>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '8px' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)' }}>
                                        Selected: {campaignForm.customers.length} of {customers.filter(c => (campaignForm.channel === 'whatsapp' || campaignForm.channel === 'voice') ? c.phone : c.email).length}
                                    </span>
                                    <button 
                                        type="button"
                                        onClick={() => {
                                            const filteredCustomers = customers.filter(c => (campaignForm.channel === 'whatsapp' || campaignForm.channel === 'voice') ? c.phone : c.email);
                                            const hasAll = campaignForm.customers.length === filteredCustomers.length;
                                            setCampaignForm({
                                                ...campaignForm,
                                                customers: hasAll ? [] : filteredCustomers.map(c => c.id)
                                            });
                                        }}
                                        style={{
                                            background: 'none',
                                            border: 'none',
                                            color: 'var(--accent)',
                                            fontSize: '12px',
                                            fontWeight: 600,
                                            cursor: 'pointer',
                                            padding: 0
                                        }}
                                    >
                                        {campaignForm.customers.length === customers.filter(c => (campaignForm.channel === 'whatsapp' || campaignForm.channel === 'voice') ? c.phone : c.email).length ? 'Deselect All' : 'Select All'}
                                    </button>
                                </div>
                                {campaignForm.customers.length > 0 && (
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', maxHeight: '72px', overflowY: 'auto', padding: '6px', background: '#f8fafc', border: '1px solid var(--border)', borderRadius: '8px' }}>
                                        {campaignForm.customers.map(id => {
                                            const cust = customers.find(c => c.id === id);
                                            if (!cust) return null;
                                            return (
                                                <span 
                                                    key={id} 
                                                    style={{ 
                                                        fontSize: '11px', 
                                                        padding: '3px 8px', 
                                                        background: 'rgba(10, 110, 255, 0.1)', 
                                                        color: 'var(--accent)', 
                                                        borderRadius: '12px',
                                                        display: 'inline-flex',
                                                        alignItems: 'center',
                                                        gap: '4px',
                                                        fontWeight: 600
                                                    }}
                                                >
                                                    {cust.name}
                                                    <span 
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            setCampaignForm(prev => ({
                                                                ...prev,
                                                                customers: prev.customers.filter(cid => cid !== id)
                                                            }));
                                                        }}
                                                        style={{ cursor: 'pointer', fontWeight: 'bold', fontSize: '12px', marginLeft: '2px', opacity: 0.7 }}
                                                        title="Deselect"
                                                    >
                                                        ×
                                                    </span>
                                                </span>
                                            );
                                        })}
                                    </div>
                                )}
                                <div style={{ position: 'relative' }}>
                                    <Input
                                        placeholder={`Search customers by name or ${(campaignForm.channel === 'whatsapp' || campaignForm.channel === 'voice') ? 'phone' : 'email'}...`}
                                        value={campaignSearch}
                                        onChange={e => setCampaignSearch(e.target.value)}
                                        style={{ paddingLeft: '36px' }}
                                    />
                                    <div style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-tertiary)', display: 'flex', alignItems: 'center' }}>
                                        <Icons.Search size={16} />
                                    </div>
                                </div>
                            </div>

                            <div style={{ 
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '6px',
                                maxHeight: '180px', 
                                overflowY: 'auto', 
                                border: '1px solid var(--border)', 
                                borderRadius: '10px', 
                                padding: '12px',
                                background: '#f8fafc'
                            }}>
                                {(() => {
                                    const isPhoneChannel = campaignForm.channel === 'whatsapp' || campaignForm.channel === 'voice';
                                    const filtered = customers.filter(c => {
                                        if (isPhoneChannel ? !c.phone : !c.email) return false;
                                        if (!campaignSearch) return true;
                                        const query = campaignSearch.toLowerCase();
                                        return c.name.toLowerCase().includes(query) || (isPhoneChannel ? c.phone.includes(query) : c.email.toLowerCase().includes(query));
                                    });
                                    if (filtered.length === 0) {
                                        return (
                                            <div style={{ textAlign: 'center', padding: '24px 0', color: 'var(--text-secondary)', fontSize: '13px' }}>
                                                No customers found matching "{campaignSearch}"
                                            </div>
                                        );
                                    }
                                    return filtered.map(c => {
                                        const isChecked = campaignForm.customers.includes(c.id);
                                        const displayContact = isPhoneChannel ? c.phone : c.email;
                                        return (
                                            <div
                                                key={c.id}
                                                onClick={() => {
                                                    if (isChecked) {
                                                        setCampaignForm({
                                                            ...campaignForm,
                                                            customers: campaignForm.customers.filter(id => id !== c.id)
                                                        });
                                                    } else {
                                                        setCampaignForm({
                                                            ...campaignForm,
                                                            customers: [...campaignForm.customers, c.id]
                                                        });
                                                    }
                                                }}
                                                style={{
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: '12px',
                                                    padding: '8px 12px',
                                                    borderRadius: '8px',
                                                    border: isChecked ? '1px solid var(--accent)' : '1px solid var(--border)',
                                                    background: isChecked ? 'rgba(10, 110, 255, 0.05)' : '#fff',
                                                    cursor: 'pointer',
                                                    transition: 'all 0.15s ease',
                                                    userSelect: 'none'
                                                }}
                                            >
                                                <input
                                                    type="checkbox"
                                                    checked={isChecked}
                                                    readOnly
                                                    style={{ 
                                                        cursor: 'pointer', 
                                                        accentColor: 'var(--accent)',
                                                        width: '16px',
                                                        height: '16px',
                                                        minWidth: '16px',
                                                        minHeight: '16px',
                                                        padding: 0,
                                                        margin: 0,
                                                        border: '1px solid var(--border)',
                                                        background: '#fff',
                                                        boxShadow: 'none',
                                                        flexShrink: 0
                                                    }}
                                                />
                                                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', flex: 1, minWidth: 0 }}>
                                                    <span style={{ fontWeight: 600, fontSize: '13px', color: isChecked ? 'var(--accent)' : 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                        {c.name}
                                                    </span>
                                                    <span style={{ fontSize: '11px', color: 'var(--text-secondary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                        {displayContact}
                                                    </span>
                                                </div>
                                            </div>
                                        );
                                    });
                                })()}
                            </div>
                        </FormGroup>
                    </div>

                    {/* Right Column: Live Template Preview */}
                    <div style={{ 
                        display: 'flex', 
                        flexDirection: 'column', 
                        borderLeft: '1px solid var(--border)', 
                        paddingLeft: '24px',
                        minWidth: 0 
                    }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                            <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)' }}>
                                Live Template Preview
                            </span>
                            {/* Dropdown to select preview customer name */}
                            {campaignForm.customers.length > 0 && (
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    <span style={{ fontSize: '11.5px', color: 'var(--text-secondary)' }}>Preview for:</span>
                                    <select 
                                        value={previewCustomerId && campaignForm.customers.includes(previewCustomerId) ? previewCustomerId : (campaignForm.customers[0] || '')}
                                        onChange={e => setPreviewCustomerId(Number(e.target.value))}
                                        style={{ 
                                            fontSize: '11.5px', 
                                            padding: '2px 8px', 
                                            borderRadius: '6px', 
                                            border: '1px solid var(--border)', 
                                            background: '#fff',
                                            maxWidth: '120px',
                                            cursor: 'pointer'
                                        }}
                                    >
                                        {campaignForm.customers.map(id => {
                                            const cust = customers.find(c => c.id === id);
                                            return cust ? <option key={id} value={id}>{cust.name}</option> : null;
                                        })}
                                    </select>
                                </div>
                            )}
                        </div>
                        <div style={{ 
                            flex: 1, 
                            background: '#f1f5f9', 
                            borderRadius: '10px', 
                            padding: '12px',
                            display: 'flex',
                            alignItems: 'stretch',
                            justifyContent: 'stretch',
                            border: '1px solid var(--border)',
                            height: '100%',
                            minHeight: '380px'
                        }}>
                              {campaignForm.channel === 'voice' ? (() => {
                                 const selectedAgent = agents.find(a => a.id === campaignForm.template);
                                 if (!selectedAgent) {
                                     return (
                                         <div style={{
                                             display: 'flex',
                                             flexDirection: 'column',
                                             alignItems: 'center',
                                             justifyContent: 'center',
                                             width: '100%',
                                             height: '100%',
                                             color: 'var(--text-secondary)',
                                             fontSize: '14px',
                                             gap: '12px'
                                         }}>
                                             <Icons.AlertCircle size={32} style={{ color: 'var(--text-tertiary)' }} />
                                             <span>No Voice Agent selected or configured.</span>
                                         </div>
                                     );
                                 }

                                 const firstMsg = selectedAgent.config?.first_message || "Hello! How can I help you today?";
                                 const phoneNum = selectedAgent.config?.phone || "ElevenLabs Telephony Trunk";
                                 const agentPersona = selectedAgent.persona || "Helpful customer assistant";

                                 return (
                                     <div style={{
                                         width: '100%',
                                         height: '100%',
                                         borderRadius: '8px',
                                         background: '#090d16',
                                         color: '#f8fafc',
                                         padding: '20px',
                                         display: 'flex',
                                         flexDirection: 'column',
                                         justifyContent: 'space-between',
                                         boxShadow: 'inset 0 0 20px rgba(0, 0, 0, 0.6)',
                                         border: '1px solid #1e293b',
                                         fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
                                     }}>
                                         {/* Agent Header */}
                                         <div style={{ display: 'flex', alignItems: 'center', gap: '12px', borderBottom: '1px solid #1e293b', paddingBottom: '12px' }}>
                                             <div style={{
                                                 width: '40px',
                                                 height: '40px',
                                                 borderRadius: '12px',
                                                 background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)',
                                                 display: 'flex',
                                                 alignItems: 'center',
                                                 justifyContent: 'center',
                                                 boxShadow: '0 0 10px rgba(59, 130, 246, 0.4)'
                                             }}>
                                                 <Icons.Phone size={20} color="#fff" />
                                             </div>
                                             <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                                                 <span style={{ fontWeight: 700, fontSize: '15px', color: '#fff' }}>{selectedAgent.name}</span>
                                                 <span style={{ fontSize: '11px', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Outbound Voice Agent</span>
                                             </div>
                                         </div>

                                         {/* Visual Voice Pulse */}
                                         <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', margin: '24px 0', gap: '12px' }}>
                                             <div style={{ display: 'flex', alignItems: 'center', gap: '6px', height: '40px' }}>
                                                 <span className="pulse-bar" style={{ animationDelay: '0.1s' }}></span>
                                                 <span className="pulse-bar" style={{ animationDelay: '0.3s' }}></span>
                                                 <span className="pulse-bar" style={{ animationDelay: '0.5s' }}></span>
                                                 <span className="pulse-bar" style={{ animationDelay: '0.2s' }}></span>
                                                 <span className="pulse-bar" style={{ animationDelay: '0.4s' }}></span>
                                             </div>
                                             <span style={{ fontSize: '12px', color: '#38bdf8', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                 <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#38bdf8', animation: 'ping 1s infinite' }}></span>
                                                 Synthesizing Outbound Voice Line
                                             </span>
                                         </div>

                                         {/* Calling details */}
                                         <div className="flex-column gap-12" style={{ display: 'flex', flexDirection: 'column', gap: '12px', flex: 1, overflowY: 'auto' }}>
                                             <div>
                                                 <div style={{ fontSize: '10px', color: '#64748b', fontWeight: 600, textTransform: 'uppercase', marginBottom: '4px' }}>Caller Trunk ID</div>
                                                 <div style={{ fontSize: '13px', color: '#cbd5e1', fontWeight: 500 }}>{phoneNum}</div>
                                             </div>

                                             <div>
                                                 <div style={{ fontSize: '10px', color: '#64748b', fontWeight: 600, textTransform: 'uppercase', marginBottom: '4px' }}>Greeting Phrase</div>
                                                 <div style={{
                                                     fontSize: '12.5px',
                                                     color: '#e2e8f0',
                                                     fontStyle: 'italic',
                                                     background: 'rgba(255,255,255,0.03)',
                                                     padding: '8px 12px',
                                                     borderRadius: '6px',
                                                     borderLeft: '3px solid #3b82f6'
                                                 }}>
                                                     "{firstMsg}"
                                                 </div>
                                             </div>

                                             <div>
                                                 <div style={{ fontSize: '10px', color: '#64748b', fontWeight: 600, textTransform: 'uppercase', marginBottom: '4px' }}>System Prompt / Instructions</div>
                                                 <div style={{
                                                     fontSize: '11px',
                                                     color: '#94a3b8',
                                                     maxHeight: '80px',
                                                     overflowY: 'auto',
                                                     background: 'rgba(0,0,0,0.2)',
                                                     padding: '8px',
                                                     borderRadius: '6px',
                                                     border: '1px solid #1e293b',
                                                     lineHeight: '1.4'
                                                 }}>
                                                     {agentPersona}
                                                 </div>
                                             </div>
                                         </div>
                                     </div>
                                 );
                             })() : campaignForm.channel === 'whatsapp' ? (() => {
                                 const previewCust = (previewCustomerId && campaignForm.customers.includes(previewCustomerId)
                                     ? customers.find(c => c.id === previewCustomerId)
                                     : customers.find(c => c.id === campaignForm.customers[0]));
                                 const previewCustomerName = previewCust ? previewCust.name : 'Valued Customer';
                                 return (
                                     <div style={{ 
                                         width: '100%', 
                                         height: '100%', 
                                         borderRadius: '6px',
                                         background: '#efeae2', 
                                         backgroundImage: 'radial-gradient(#dfdcd6 1px, transparent 0), radial-gradient(#dfdcd6 1px, #efeae2 0)',
                                         backgroundSize: '12px 12px',
                                         backgroundPosition: '0 0, 6px 6px',
                                         padding: '16px',
                                         display: 'flex',
                                         flexDirection: 'column',
                                         justifyContent: 'flex-start',
                                         overflowY: 'auto'
                                     }}>
                                         {/* WhatsApp Chat Header (Mock) */}
                                         <div style={{
                                             display: 'flex',
                                             alignItems: 'center',
                                             gap: '8px',
                                             background: '#075e54',
                                             color: '#fff',
                                             padding: '10px 14px',
                                             margin: '-16px -16px 16px -16px',
                                             borderTopLeftRadius: '6px',
                                             borderTopRightRadius: '6px',
                                             boxShadow: '0 1px 3px rgba(0,0,0,0.15)'
                                         }}>
                                             <div style={{
                                                 width: '32px',
                                                 height: '32px',
                                                 borderRadius: '50%',
                                                 background: '#ece5dd',
                                                 color: '#555',
                                                 display: 'flex',
                                                 alignItems: 'center',
                                                 justifyContent: 'center',
                                                 fontWeight: 'bold',
                                                 fontSize: '14px'
                                             }}>
                                                 {(previewCustomerName && previewCustomerName[0]) || 'C'}
                                             </div>
                                             <div style={{ display: 'flex', flexDirection: 'column' }}>
                                                 <span style={{ fontSize: '13px', fontWeight: 600 }}>{previewCustomerName}</span>
                                                 <span style={{ fontSize: '9.5px', opacity: 0.8 }}>online</span>
                                             </div>
                                         </div>

                                         {/* Chat message bubble */}
                                         <div style={{
                                             background: '#d9fdd3',
                                             borderRadius: '8px',
                                             padding: '8px 12px 24px 12px',
                                             maxWidth: '85%',
                                             alignSelf: 'flex-end',
                                             boxShadow: '0 1px 1px rgba(0,0,0,0.15)',
                                             position: 'relative',
                                             color: '#111b21',
                                             fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
                                             fontSize: '13.5px',
                                             lineHeight: '1.4',
                                             whiteSpace: 'pre-wrap',
                                             wordBreak: 'break-word',
                                             marginTop: '8px',
                                             marginBottom: '8px'
                                         }}>
                                             {getWhatsAppTemplateText(
                                                 campaignForm.template, 
                                                 previewCustomerName,
                                                 settings
                                             )}
                                             <div style={{ 
                                                 position: 'absolute', 
                                                 bottom: '3px', 
                                                 right: '7px', 
                                                 fontSize: '9.5px', 
                                                 color: '#667781',
                                                 display: 'flex',
                                                 alignItems: 'center',
                                                 gap: '3px'
                                             }}>
                                                 <span>{new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true })}</span>
                                                 <span style={{ color: '#53bdeb', display: 'flex' }}>
                                                     <svg viewBox="0 0 16 15" width="15" height="14" fill="currentColor">
                                                         <path d="M15.01 3.316l-.478-.372a.365.365 0 0 0-.51.063L8.666 9.879a.32.32 0 0 1-.484.033L5.438 7.168a.365.365 0 0 0-.51.008l-.427.422a.37.37 0 0 0-.006.521l3.51 3.554a.32.32 0 0 0 .474-.019l5.594-6.83a.37.37 0 0 0-.063-.51z" />
                                                         <path d="M11.177 3.316l-.478-.372a.365.365 0 0 0-.51.063L4.833 9.879a.32.32 0 0 1-.484.033L1.591 7.143a.365.365 0 0 0-.51.008l-.427.422a.37.37 0 0 0-.006.521l3.51 3.554a.32.32 0 0 0 .474-.019l5.594-6.83a.37.37 0 0 0-.063-.51z" />
                                                     </svg>
                                                 </span>
                                             </div>
                                         </div>
                                     </div>
                                 );
                             })() : (
                                 <iframe 
                                     title="Template Preview"
                                     srcDoc={getTemplatePreviewHtml(
                                         campaignForm.template, 
                                         (previewCustomerId && campaignForm.customers.includes(previewCustomerId)
                                             ? (customers.find(c => c.id === previewCustomerId)?.name || 'Valued Customer')
                                             : (customers.find(c => c.id === campaignForm.customers[0])?.name || 'Valued Customer')),
                                         settings,
                                         campaignForm.customContent
                                     )}
                                     style={{ 
                                         width: '100%', 
                                         height: '100%', 
                                         border: 'none', 
                                         borderRadius: '6px',
                                         background: '#fff' 
                                     }}
                                 />
                             )}
                        </div>
                    </div>
                </div>
            </Modal>

            {/* Voice Campaign Progress Modal */}
            <Modal
                open={showProgressModal}
                onClose={() => setShowProgressModal(false)}
                heading={`Voice Campaign Progress: ${progressCampaign?.name || ''}`}
                size="large"
                secondaryActions={
                    <SButton onClick={() => setShowProgressModal(false)}>Close</SButton>
                }
            >
                {loadingProgress ? (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '300px', gap: '16px' }}>
                        <div className="spinner" style={{
                            width: '40px',
                            height: '40px',
                            border: '3px solid rgba(10, 110, 255, 0.1)',
                            borderTop: '3px solid var(--accent)',
                            borderRadius: '50%',
                            animation: 'spin 1s linear infinite'
                        }}></div>
                        <span style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>Syncing status from ElevenLabs...</span>
                    </div>
                ) : !progressData || !progressData.progress || progressData.progress.length === 0 ? (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '300px', gap: '12px', color: 'var(--text-secondary)' }}>
                        <Icons.AlertCircle size={32} style={{ color: 'var(--text-tertiary)' }} />
                        <span>No calling progress found for this campaign.</span>
                    </div>
                ) : (() => {
                    const currentDay = progressData.progress.find(p => p.date === selectedProgressDate) || progressData.progress[0];
                    if (!currentDay) return null;

                    // Calculate overall progress across all days
                    const overallTotal = progressData.progress.reduce((sum, d) => sum + (d.total || 0), 0);
                    const overallCompleted = progressData.progress.reduce((sum, d) => sum + (d.completed || 0), 0);
                    const overallPct = overallTotal > 0 ? Math.round((overallCompleted / overallTotal) * 100) : 0;

                    return (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', minHeight: '400px' }}>
                            {/* Overall Progress Banner */}
                            <div style={{
                                background: 'linear-gradient(135deg, rgba(10, 110, 255, 0.05) 0%, rgba(139, 92, 246, 0.05) 100%)',
                                border: '1px solid rgba(10, 110, 255, 0.15)',
                                borderRadius: '12px',
                                padding: '16px 20px',
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '10px'
                            }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <Icons.Activity size={18} style={{ color: 'var(--accent)' }} />
                                        <span style={{ fontWeight: 600, fontSize: '14px', color: 'var(--text-primary)' }}>Overall Outbound Campaign Status</span>
                                    </div>
                                    <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--accent)' }}>
                                        {overallCompleted} / {overallTotal} Calls Completed ({overallPct}%)
                                    </span>
                                </div>
                                <div style={{ width: '100%', height: '8px', background: 'rgba(0,0,0,0.05)', borderRadius: '4px', overflow: 'hidden' }}>
                                    <div style={{ width: `${overallPct}%`, height: '100%', background: 'linear-gradient(90deg, #0a6eff, #8b5cf6)', borderRadius: '4px', transition: 'width 0.4s ease' }} />
                                </div>
                            </div>

                            {/* Date Navigation Tabs */}
                            <div style={{
                                display: 'flex',
                                gap: '8px',
                                borderBottom: '1px solid var(--border-light)',
                                overflowX: 'auto',
                                paddingBottom: '4px'
                            }}>
                                {progressData.progress.map(d => {
                                    const isActive = d.date === selectedProgressDate;
                                    return (
                                        <button
                                            key={d.date}
                                            onClick={() => setSelectedProgressDate(d.date)}
                                            style={{
                                                background: isActive ? 'rgba(10, 110, 255, 0.06)' : 'none',
                                                border: 'none',
                                                borderBottom: isActive ? '2px solid var(--accent)' : '2px solid transparent',
                                                padding: '8px 16px',
                                                fontSize: '13px',
                                                fontWeight: 600,
                                                color: isActive ? 'var(--accent)' : 'var(--text-secondary)',
                                                cursor: 'pointer',
                                                whiteSpace: 'nowrap',
                                                transition: 'all 0.2s ease',
                                                borderRadius: '6px 6px 0 0',
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '6px'
                                            }}
                                        >
                                            <Icons.Calendar size={14} />
                                            {formatDate(d.date)}
                                            <span style={{
                                                fontSize: '10px',
                                                padding: '2px 6px',
                                                background: d.isDone ? 'rgba(52, 199, 89, 0.15)' : 'rgba(0,0,0,0.05)',
                                                color: d.isDone ? 'var(--success)' : 'var(--text-secondary)',
                                                borderRadius: '10px',
                                                fontWeight: 700
                                            }}>
                                                {d.completed}/{d.total}
                                            </span>
                                        </button>
                                    );
                                })}
                            </div>

                            {/* Day Call List */}
                            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)' }}>
                                        Calling Queue for {formatDate(currentDay.date)}
                                    </span>
                                    {currentDay.batchId && (
                                        <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                                            Batch ID: {currentDay.batchId} ({currentDay.batchStatus})
                                        </span>
                                    )}
                                </div>

                                <div style={{
                                    display: 'grid',
                                    gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
                                    gap: '12px',
                                    maxHeight: '340px',
                                    overflowY: 'auto',
                                    padding: '4px'
                                }}>
                                    {currentDay.calls.map(call => {
                                        let statusColor = '#64748b';
                                        let statusBg = 'rgba(100, 116, 139, 0.1)';
                                        let statusIcon = <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#64748b' }} />;

                                        if (call.status === 'called') {
                                            statusColor = 'var(--success)';
                                            statusBg = 'rgba(52, 199, 89, 0.1)';
                                            statusIcon = <Icons.CheckCircle size={16} style={{ color: 'var(--success)' }} />;
                                        } else if (call.status === 'failed') {
                                            statusColor = 'var(--danger)';
                                            statusBg = 'rgba(239, 68, 68, 0.1)';
                                            statusIcon = <Icons.AlertCircle size={16} style={{ color: 'var(--danger)' }} />;
                                        } else if (call.status === 'dispatched') {
                                            statusColor = 'var(--accent)';
                                            statusBg = 'rgba(10, 110, 255, 0.1)';
                                            statusIcon = (
                                                <div className="spinner" style={{
                                                    width: '14px',
                                                    height: '14px',
                                                    border: '2px solid rgba(10, 110, 255, 0.2)',
                                                    borderTop: '2px solid var(--accent)',
                                                    borderRadius: '50%',
                                                    animation: 'spin 1s linear infinite'
                                                }}></div>
                                            );
                                        } else {
                                            // pending
                                            statusColor = 'var(--text-secondary)';
                                            statusBg = 'rgba(0, 0, 0, 0.05)';
                                            statusIcon = <Icons.Clock size={16} style={{ color: 'var(--text-secondary)' }} />;
                                        }

                                        return (
                                            <div
                                                key={call.id}
                                                style={{
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'space-between',
                                                    padding: '12px 16px',
                                                    borderRadius: '10px',
                                                    border: '1px solid var(--border)',
                                                    background: 'var(--bg-card)',
                                                    boxShadow: 'var(--shadow-sm)'
                                                }}
                                            >
                                                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', minWidth: 0 }}>
                                                    <span style={{ fontWeight: 600, fontSize: '13px', color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                        {call.customerName}
                                                    </span>
                                                    <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                                                        {call.customerPhone}
                                                    </span>
                                                </div>

                                                <div style={{
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: '8px',
                                                    padding: '4px 10px',
                                                    borderRadius: '20px',
                                                    background: statusBg,
                                                    color: statusColor,
                                                    fontSize: '11.5px',
                                                    fontWeight: 600,
                                                    textTransform: 'capitalize'
                                                }}>
                                                    {statusIcon}
                                                    {call.status}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>
                    );
                })()}
            </Modal>
        </div>
    );
}
