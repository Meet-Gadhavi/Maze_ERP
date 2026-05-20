const express = require('express');
const cors = require('cors');
const path = require('path');
const { execFile } = require('child_process'); // M003: use execFile instead of exec
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

const dataRoutes = require('./routes/data');

const app = express();
const DEFAULT_PORT = 3001;
const PORT = parseInt(process.env.PORT, 10) || DEFAULT_PORT;

// Middleware
app.use(helmet()); // C003: Helmet Security Headers

// C002: Rate Limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10000, // Significantly higher limit for local desktop use
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later.' },
  skip: (req) => {
    // Skip rate limiting for local loopback connections since this is a desktop app
    const ip = req.ip || '';
    return ip.includes('127.0.0.1') || ip.includes('::1') || ip.includes('localhost') || ip === '::ffff:127.0.0.1';
  }
});
app.use(limiter);

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

// Routes
app.use('/api/dashboard', require('./routes/dashboard'));
app.use('/api/products', require('./routes/inventory'));
app.use('/api/invoices', require('./routes/sales'));
app.use('/api/customers', require('./routes/customers'));
app.use('/api/suppliers', require('./routes/suppliers'));
app.use('/api/purchases', require('./routes/purchases'));
app.use('/api/expenses', require('./routes/expenses'));
app.use('/api/settings', require('./routes/settings'));
app.use('/api/reports', require('./routes/reports'));
app.use('/api/mazeway', require('./routes/mazeway'));
app.use('/api/data', dataRoutes);

// Health check
app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', port: PORT, timestamp: new Date().toISOString() });
});

// M015: Global error handler — log internally
app.use((err, _req, res, _next) => {
    console.error('[Server Error]', err);
    res.status(err.status || 500).json({ error: err.message || 'Internal server error' });
});

/**
 * M003: Kill any process occupying the target port (Windows only).
 * Uses execFile (not exec) to prevent shell command injection.
 * Returns a promise that resolves once the port is freed (or was already free).
 */
function killProcessOnPort(port) {
    return new Promise((resolve) => {
        // Run netstat with fixed args — no shell interpolation
        execFile('netstat', ['-ano'], (err, stdout) => {
            if (err || !stdout.trim()) return resolve();

            const portStr = `:${port}`;
            const pids = new Set();
            for (const line of stdout.split('\n')) {
                if (!line.includes(portStr) || !line.includes('LISTENING')) continue;
                const parts = line.trim().split(/\s+/);
                const pid = parts[parts.length - 1];
                if (pid && pid !== '0' && /^\d+$/.test(pid)) pids.add(pid);
            }

            if (pids.size === 0) return resolve();

            console.log(`[Maze ERP] Killing previous process(es) on port ${port}: PIDs ${[...pids].join(', ')}`);
            const killPromises = [...pids].map(
                (pid) =>
                    new Promise((res) => {
                        // PID validated as numeric above — safe to pass as separate arg
                        execFile('taskkill', ['/F', '/PID', pid], (killErr) => {
                            if (killErr) console.warn(`[Maze ERP] Could not kill PID ${pid}: ${killErr.message}`);
                            res();
                        });
                    })
            );
            Promise.all(killPromises).then(() => {
                // Small delay to let the OS fully release the port
                setTimeout(resolve, 500);
            });
        });
    });
}

// Auto-backup check every 30 minutes
function startBackupService() {
    setInterval(async () => {
        try {
            await db.ready;
            const cycle = db.get("SELECT value FROM settings WHERE key = 'backup_cycle'")?.value || 'manual';
            const lastDateStr = db.get("SELECT value FROM settings WHERE key = 'last_backup_date'")?.value;
            
            if (cycle === 'off' || cycle === 'manual') return;
            
            const now = new Date();
            let lastDate = lastDateStr ? new Date(lastDateStr) : null;
            
            if (!lastDate) {
                await backupUtil.runBackup();
                return;
            }

            const diffDays = (now - lastDate) / (1000 * 60 * 60 * 24);
            
            let due = false;
            if (cycle === '2_days' && diffDays >= 2) due = true;
            if (cycle === '4_days' && diffDays >= 4) due = true;
            if (cycle === '10_days' && diffDays >= 10) due = true;
            if (cycle === 'monthly' && diffDays >= 30) due = true;

            if (due) {
                await backupUtil.runBackup();
            }
        } catch (err) {
            console.error('[Backup Check Error]', err.message);
        }
    }, 1800000); // 30 mins
}

/**
 * Start the Express server with auto-kill retry on EADDRINUSE.
 */
function startServer() {
    const server = app.listen(PORT, () => {
        console.log(`[Maze ERP] Backend running on http://localhost:${PORT}`);
        startBackupService();
    });

    server.on('error', async (err) => {
        if (err.code === 'EADDRINUSE') {
            console.warn(`[Maze ERP] Port ${PORT} is already in use. Attempting to free it...`);
            await killProcessOnPort(PORT);
            // Retry once
            try {
                app.listen(PORT, () => {
                    console.log(`[Maze ERP] Backend running on http://localhost:${PORT} (after freeing port)`);
                });
            } catch (retryErr) {
                console.error(`[Maze ERP] Failed to start server after freeing port: ${retryErr.message}`);
                process.exit(1);
            }
        } else {
            console.error(`[Maze ERP] Server error: ${err.message}`);
            process.exit(1);
        }
    });

    return server;
}

const db = require('./db');
const backupUtil = require('./backupUtil');

// Only auto-start when run directly (npm run dev:backend).
// When required from Electron main.js, call startServer() explicitly.
if (require.main === module) {
    startServer();
}

module.exports = { app, startServer }; // Trigger restart
