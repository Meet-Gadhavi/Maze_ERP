/**
 * Global Constants and Default State Objects for Maze ERP
 */

export const APP_NAME = 'Quantro';
export const APP_COMPANY = 'Maze ERP';
export const APP_VERSION = '1.0.7';
export const PURCHASES_LABEL = 'Purchases';

export const EMPTY_PRODUCT = {
    name: '',
    category: '',
    subcategory_id: '',
    brand_id: '',
    tags: '',
    cost_price: '',
    selling_price: '',
    stock_quantity: '',
    product_code: '',
    unit: 'PCS',
    secondary_unit: '',
    conversion_factor: 1,
    allow_decimal: false,
    conversion_rate: 1,
    min_stock_level: 5,
    max_stock_level: 0,
    track_batches: false
};

export const EMPTY_CUSTOMER = {
    name: '',
    phone: '',
    email: '',
    address: '',
    gstin: ''
};

export const EMPTY_SUPPLIER = {
    name: '',
    phone: '',
    gstin: '',
    address: '',
    opening_balance: 0,
    notes: ''
};

export const EMPTY_EXPENSE = {
    category_id: '',
    amount: '',
    date: new Date().toISOString().split('T')[0],
    description: '',
    payment_mode: 'Cash'
};

export const UNIT_CATEGORIES = {
    'Weight': ['GMS', 'KGS', 'QTL', 'TON', 'MTS'],
    'Volume': ['LTR', 'MLT', 'KLR', 'CBM', 'CCM', 'UGS'],
    'Length / Area': ['CMS', 'MTR', 'KME', 'SQF', 'SQM', 'SQY', 'YDS'],
    'Quantity / Pack': ['NOS', 'PCS', 'BOX', 'BAG', 'CTN', 'BTL', 'PAC', 'SET', 'ROL', 'CAN', 'DRM', 'TUB', 'BAL', 'BUN', 'TBS'],
    'Other': ['BOU', 'GGR', 'GRS', 'GYD', 'OTH']
};

export const DECIMAL_UNITS = ['KGS', 'GMS', 'TON', 'MTS', 'LTR', 'MLT', 'KLR', 'MTR', 'CMS', 'SQF', 'SQM', 'SQY'];
