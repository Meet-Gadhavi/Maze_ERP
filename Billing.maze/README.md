# Billing.maze - Hosted Invoice Viewer Deployment Guide

This directory contains the single-page application (SPA) viewer for Quantro ERP hosted invoices. It is configured to be hosted on **Netlify** (or any static site hosting service) under the domain: `https://billing-mazelab.netlify.app`.

---

## Files Included

1. **`index.html`**: The unified frontend containing structural markup, modern responsive CSS styling, A4 print media layouts, and client-side JavaScript.
   - Fetches the invoice data from the Mazeway DB API at `https://mazeway-db.onrender.com`.
   - Renders company details, client info, line items, CGST/SGST/IGST tax breakdowns, totals, payment info, and payment buttons.
   - Includes client-side tracking back to the public database for Views, Downloads, and Payment Clicks.
2. **`_redirects`**: Netlify redirect/rewrite configuration that maps `/invoice/*` to `/index.html` with a 200 rewrite, enabling clean SPA URL paths (e.g. `/invoice/123?token=abc`).

---

## Deployment Steps on Netlify

Follow these simple steps to deploy this viewer to **Netlify**:

### Option A: Drag and Drop (Fastest)
1. Log in to your [Netlify Dashboard](https://app.netlify.com).
2. Go to the **Sites** page.
3. Scroll to the bottom and drag and drop the `Billing.maze` folder directly into the browser upload box.
4. Once deployed:
   - Go to **Site Configuration** -> **Site details** -> **Change site name**.
   - Change it to: `billing-mazelab` (which maps to `https://billing-mazelab.netlify.app`).

### Option B: Git Integration (Continuous Deployment)
1. Push the `Billing.maze` folder to GitHub/GitLab (or create a separate repo containing only `index.html` and `_redirects`).
2. In the Netlify Dashboard, click **Add new site** -> **Import an existing project**.
3. Select your repository.
4. Configure Build Settings:
   - **Build Command**: *Leave blank* (none required).
   - **Publish directory**: `.` (if `index.html` is at the root of the repo) or `Billing.maze` (if deploying from the mono-repo root).
5. Deploy the site, and configure the custom site name to `billing-mazelab`.
