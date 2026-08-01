const express = require('express');
const router = express.Router();
const db = require('../db');
const crypto = require('crypto');
const cloudSyncManager = require('../services/cloudSyncManager');

function hashSecret(secret) {
    if (!secret) return '';
    return crypto.createHash('sha256').update(String(secret)).digest('hex');
}

function verifySecret(secret, hash) {
    if (!secret || !hash) return false;
    return hashSecret(secret) === hash;
}

// GET /api/hr/employees - Fetch employee directory
router.get('/employees', (req, res) => {
    try {
        const storeId = req.query.store_id;
        let query = 'SELECT id, employee_code, full_name, email, phone, role, assigned_store_ids, department, designation, base_salary, allowances, deductions, status, created_at FROM employees ORDER BY id DESC';
        const employees = db.all(query);
        
        // Parse assigned_store_ids JSON array for each employee
        const parsed = employees.map(emp => ({
            ...emp,
            assigned_store_ids: emp.assigned_store_ids ? JSON.parse(emp.assigned_store_ids) : []
        }));

        // Filter by storeId if provided and not '*'
        let result = parsed;
        if (storeId && storeId !== '*') {
            const sid = Number(storeId);
            result = parsed.filter(emp => 
                emp.assigned_store_ids.includes('*') || emp.assigned_store_ids.includes(sid)
            );
        }

        res.json({ success: true, employees: result });
    } catch (err) {
        console.error('[HR] Error fetching employees:', err);
        res.status(500).json({ error: err.message || 'Failed to fetch employees' });
    }
});

// POST /api/hr/employees - Create new employee with hashed credentials
router.post('/employees', (req, res) => {
    try {
        const { full_name, email, phone, password, pos_pin, role, assigned_store_ids, department, designation, base_salary, allowances, deductions } = req.body;

        if (!full_name || !email || !password) {
            return res.status(400).json({ error: 'Full name, email, and password are required' });
        }

        // Check if email already exists
        const existing = db.get('SELECT id FROM employees WHERE email = ?', [email]);
        if (existing) {
            return res.status(400).json({ error: 'An employee with this email address already exists' });
        }

        // Generate unique employee code (EMP-001, EMP-002...)
        const maxEmp = db.get('SELECT MAX(id) as maxId FROM employees');
        const nextId = (maxEmp?.maxId || 0) + 1;
        const employee_code = `EMP-${String(nextId).padStart(3, '0')}`;

        const password_hash = hashSecret(password);
        const pos_pin_hash = pos_pin ? hashSecret(pos_pin) : null;
        const store_ids_json = JSON.stringify(assigned_store_ids || ['*']);

        const stmt = db.run(`
            INSERT INTO employees (employee_code, full_name, email, phone, password_hash, pos_pin_hash, role, assigned_store_ids, department, designation, base_salary, allowances, deductions, status)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'ACTIVE')
        `, [
            employee_code,
            full_name.trim(),
            email.trim().toLowerCase(),
            phone || '',
            password_hash,
            pos_pin_hash,
            role || 'CASHIER',
            store_ids_json,
            department || 'General',
            designation || 'Staff',
            Number(base_salary || 0),
            Number(allowances || 0),
            Number(deductions || 0)
        ]);

        db.persist();

        const created = db.get('SELECT id, employee_code, full_name, email, phone, role, assigned_store_ids, department, designation, base_salary, status FROM employees WHERE id = ?', [stmt.lastInsertRowid]);

        if (created) {
            cloudSyncManager.syncStaff({
                email: created.email,
                full_name: created.full_name,
                role: created.role,
                pin: pos_pin || '1234',
                phone: created.phone
            });
        }

        res.json({ success: true, employee: { ...created, assigned_store_ids: JSON.parse(created.assigned_store_ids) } });
    } catch (err) {
        console.error('[HR] Error creating employee:', err);
        res.status(500).json({ error: err.message || 'Failed to create employee' });
    }
});

// PUT /api/hr/employees/:id - Update employee profile
router.put('/employees/:id', (req, res) => {
    try {
        const { id } = req.params;
        const { full_name, email, phone, password, pos_pin, role, assigned_store_ids, department, designation, base_salary, allowances, deductions, status } = req.body;

        const existing = db.get('SELECT * FROM employees WHERE id = ?', [id]);
        if (!existing) {
            return res.status(404).json({ error: 'Employee not found' });
        }

        let password_hash = existing.password_hash;
        if (password && password.trim() !== '') {
            password_hash = hashSecret(password.trim());
        }

        let pos_pin_hash = existing.pos_pin_hash;
        if (pos_pin !== undefined && pos_pin !== '') {
            pos_pin_hash = hashSecret(pos_pin);
        }

        const store_ids_json = assigned_store_ids ? JSON.stringify(assigned_store_ids) : existing.assigned_store_ids;

        db.run(`
            UPDATE employees SET 
                full_name = ?,
                email = ?,
                phone = ?,
                password_hash = ?,
                pos_pin_hash = ?,
                role = ?,
                assigned_store_ids = ?,
                department = ?,
                designation = ?,
                base_salary = ?,
                allowances = ?,
                deductions = ?,
                status = ?,
                updated_at = datetime('now','localtime')
            WHERE id = ?
        `, [
            full_name || existing.full_name,
            email ? email.trim().toLowerCase() : existing.email,
            phone !== undefined ? phone : existing.phone,
            password_hash,
            pos_pin_hash,
            role || existing.role,
            store_ids_json,
            department || existing.department,
            designation || existing.designation,
            base_salary !== undefined ? Number(base_salary) : existing.base_salary,
            allowances !== undefined ? Number(allowances) : existing.allowances,
            deductions !== undefined ? Number(deductions) : existing.deductions,
            status || existing.status,
            id
        ]);

        db.persist();

        const updated = db.get('SELECT id, employee_code, full_name, email, phone, role, assigned_store_ids, department, designation, base_salary, allowances, deductions, status FROM employees WHERE id = ?', [id]);

        res.json({ success: true, employee: { ...updated, assigned_store_ids: JSON.parse(updated.assigned_store_ids) } });
    } catch (err) {
        console.error('[HR] Error updating employee:', err);
        res.status(500).json({ error: err.message || 'Failed to update employee' });
    }
});

// POST /api/hr/auth/login - Authentication via Email/Password or 4-Digit PIN
router.post('/auth/login', (req, res) => {
    try {
        const { email, password, pin } = req.body;

        let emp = null;
        if (email && password) {
            emp = db.get('SELECT * FROM employees WHERE email = ? AND status = "ACTIVE"', [email.trim().toLowerCase()]);
            if (!emp || !verifySecret(password, emp.password_hash)) {
                return res.status(401).json({ error: 'Invalid email address or password' });
            }
        } else if (pin) {
            const allEmps = db.all('SELECT * FROM employees WHERE status = "ACTIVE" AND pos_pin_hash IS NOT NULL');
            emp = allEmps.find(e => verifySecret(pin, e.pos_pin_hash));
            if (!emp) {
                return res.status(401).json({ error: 'Invalid Quick POS 4-Digit PIN' });
            }
        } else {
            return res.status(400).json({ error: 'Provide either email/password or 4-digit PIN' });
        }

        const assignedStoreIds = emp.assigned_store_ids ? JSON.parse(emp.assigned_store_ids) : [];

        res.json({
            success: true,
            user: {
                id: emp.id,
                employee_code: emp.employee_code,
                full_name: emp.full_name,
                email: emp.email,
                role: emp.role,
                assigned_store_ids: assignedStoreIds,
                department: emp.department,
                designation: emp.designation
            }
        });
    } catch (err) {
        console.error('[HR Auth] Login error:', err);
        res.status(500).json({ error: err.message || 'Authentication failed' });
    }
});

// POST /api/hr/attendance/clock-in
router.post('/attendance/clock-in', (req, res) => {
    try {
        const { employee_id, store_id, starting_cash_drawer } = req.body;

        if (!employee_id || !store_id) {
            return res.status(400).json({ error: 'Employee ID and Store ID required' });
        }

        const stmt = db.run(`
            INSERT INTO employee_attendance (employee_id, store_id, clock_in_time, starting_cash_drawer)
            VALUES (?, ?, datetime('now','localtime'), ?)
        `, [employee_id, store_id, Number(starting_cash_drawer || 0)]);

        db.persist();

        res.json({ success: true, attendance_id: stmt.lastInsertRowid, message: 'Clocked in successfully!' });
    } catch (err) {
        console.error('[Attendance] Clock-in error:', err);
        res.status(500).json({ error: err.message || 'Clock-in failed' });
    }
});

// POST /api/hr/attendance/clock-out
router.post('/attendance/clock-out', (req, res) => {
    try {
        const { attendance_id, ending_cash_drawer, notes } = req.body;

        if (!attendance_id) {
            return res.status(400).json({ error: 'Attendance Record ID required' });
        }

        db.run(`
            UPDATE employee_attendance SET
                clock_out_time = datetime('now','localtime'),
                ending_cash_drawer = ?,
                notes = ?
            WHERE id = ?
        `, [Number(ending_cash_drawer || 0), notes || '', attendance_id]);

        db.persist();

        res.json({ success: true, message: 'Clocked out successfully!' });
    } catch (err) {
        console.error('[Attendance] Clock-out error:', err);
        res.status(500).json({ error: err.message || 'Clock-out failed' });
    }
});

// GET /api/hr/payroll - History of Disbursements
router.get('/payroll', (req, res) => {
    try {
        const disbursements = db.all(`
            SELECT pd.*, e.full_name, e.employee_code, e.role, s.name as store_name
            FROM payroll_disbursements pd
            JOIN employees e ON pd.employee_id = e.id
            JOIN stores s ON pd.store_id = s.id
            ORDER BY pd.id DESC
        `);

        res.json({ success: true, disbursements });
    } catch (err) {
        console.error('[Payroll] Fetch error:', err);
        res.status(500).json({ error: err.message || 'Failed to fetch payroll history' });
    }
});

// POST /api/hr/payroll/disburse - Execute Monthly Salary Payout
router.post('/payroll/disburse', (req, res) => {
    try {
        const { payroll_month, employee_id, store_id } = req.body;

        if (!payroll_month || !employee_id) {
            return res.status(400).json({ error: 'Payroll month and employee ID required' });
        }

        const emp = db.get('SELECT * FROM employees WHERE id = ?', [employee_id]);
        if (!emp) {
            return res.status(404).json({ error: 'Employee not found' });
        }

        const gross = Number(emp.base_salary || 0) + Number(emp.allowances || 0);
        const net = Math.max(0, gross - Number(emp.deductions || 0));
        const targetStore = store_id || 1;

        const stmt = db.run(`
            INSERT INTO payroll_disbursements (payroll_month, employee_id, store_id, gross_salary, net_salary, status)
            VALUES (?, ?, ?, ?, ?, 'PAID')
        `, [payroll_month, employee_id, targetStore, gross, net]);

        // Automatically record Salary Expense in Accounting Ledger
        db.run(`
            INSERT INTO expenses (category, amount, description, date, store_id)
            VALUES ('Payroll & Salary', ?, ?, date('now','localtime'), ?)
        `, [net, `Salary Payout for ${emp.full_name} (${emp.employee_code}) - ${payroll_month}`, targetStore]);

        db.persist();

        res.json({ success: true, id: stmt.lastInsertRowid, message: `Salary disbursed for ${emp.full_name}!` });
    } catch (err) {
        console.error('[Payroll] Disbursement error:', err);
        res.status(500).json({ error: err.message || 'Payroll disbursement failed' });
    }
});

module.exports = router;
