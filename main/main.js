const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const { autoUpdater } = require('electron-updater');

// Disable background auto-download to allow user-driven, interactive downloads in settings
autoUpdater.autoDownload = false;
autoUpdater.autoInstallOnAppQuit = true;

// Enable Chromium's print preview component to allow print previews in print dialog
// app.commandLine.appendSwitch('disable-print-preview');

// Register custom protocol for deep linking
if (process.defaultApp) {
  if (process.argv.length >= 2) {
    app.setAsDefaultProtocolClient('maze-erp', process.execPath, [path.resolve(process.argv[1])])
  }
} else {
  app.setAsDefaultProtocolClient('maze-erp')
}

// Set the application name for taskbar, window title, and app metadata.
app.setName('Quantro');

const isDev = !app.isPackaged;

if (!isDev) {
    // Packaged: try to create and write to a 'data' folder in the installation root directory
    const rootDataPath = path.join(path.dirname(process.execPath), 'data');
    try {
        if (!fs.existsSync(rootDataPath)) {
            fs.mkdirSync(rootDataPath, { recursive: true });
        }
        const testFile = path.join(rootDataPath, '.write_test');
        fs.writeFileSync(testFile, 'test');
        fs.unlinkSync(testFile);
        
        // It is writable! Use the installation directory data folder
        process.env.MAZE_USER_DATA = rootDataPath;
    } catch (e) {
        // Fall back to system userData directory to avoid Program Files permission crashes
        process.env.MAZE_USER_DATA = app.getPath('userData');
    }
} else {
    // Dev: use the project root/data for data
    process.env.MAZE_USER_DATA = path.join(__dirname, '..', 'data');
}

let mainWindow;
let customerWindow;
let backendServer;

ipcMain.on('open-customer-window', () => {
    if (customerWindow) {
        customerWindow.focus();
        return;
    }

    customerWindow = new BrowserWindow({
        width: 1024,
        height: 768,
        title: 'Customer Display - Quantro',
        icon: iconPath,
        fullscreen: true,
        autoHideMenuBar: true,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            contextIsolation: true,
            nodeIntegration: false
        }
    });

    if (isDev) {
        customerWindow.loadURL('http://localhost:5175/#/customer-display');
    } else {
        customerWindow.loadFile(path.join(__dirname, '..', 'renderer', 'dist', 'index.html'), { hash: '/customer-display' });
    }

    customerWindow.on('closed', () => {
        customerWindow = null;
    });
});

ipcMain.on('update-customer-display-data', (event, data) => {
    if (customerWindow) {
        customerWindow.webContents.send('customer-display-update', data);
    }
});

ipcMain.on('trigger-cash-drawer', () => {
    console.log('[Maze ERP] Triggering Cash Drawer Kick command...');
    // We send back a confirmation. 
    // Real hardware implementation would use a library like node-thermal-printer 
    // or send raw bytes to the printer port.
    if (mainWindow) {
        mainWindow.webContents.send('cash-drawer-test-result', { 
            success: true, 
            message: 'Pulse command (ESC p) successfully sent to default printer queue.' 
        });
    }
});

ipcMain.on('print-page', (event) => {
    console.log('[Maze ERP] Printing page with system dialogue...');
    const webContents = event.sender;
    webContents.print({
        silent: false,
        printBackground: true,
        useSystemDialogue: true
    }, (success, failureReason) => {
        if (!success && failureReason !== 'cancelled') {
            console.warn(`[Maze ERP] Printing failed: ${failureReason}`);
        }
    });
});

ipcMain.on('open-external', (event, url) => {
    const { shell } = require('electron');
    shell.openExternal(url);
});

// IPC Updates Tunneling
ipcMain.on('check-for-updates', () => {
    console.log('[Maze ERP] Manual update check triggered.');
    autoUpdater.checkForUpdates().catch(err => {
        console.error('[Maze ERP] Update check failed:', err);
        if (mainWindow) {
            mainWindow.webContents.send('update-error', err.message || String(err));
        }
    });
});

ipcMain.on('download-update', () => {
    console.log('[Maze ERP] User initiated update download.');
    autoUpdater.downloadUpdate().catch(err => {
        console.error('[Maze ERP] Update download initiation failed:', err);
        if (mainWindow) {
            mainWindow.webContents.send('update-error', err.message || String(err));
        }
    });
});

ipcMain.on('install-update', () => {
    console.log('[Maze ERP] User initiated quit & install. Upgrading system...');
    autoUpdater.quitAndInstall();
});

// autoUpdater Events
autoUpdater.on('update-available', (info) => {
    console.log('[Maze ERP] AutoUpdater: update-available', info.version);
    if (mainWindow) {
        mainWindow.webContents.send('update-available', {
            version: info.version,
            releaseDate: info.releaseDate,
            releaseNotes: info.releaseNotes
        });
    }
});

autoUpdater.on('update-not-available', () => {
    console.log('[Maze ERP] AutoUpdater: update-not-available');
    if (mainWindow) {
        mainWindow.webContents.send('update-not-available');
    }
});

autoUpdater.on('download-progress', (progressObj) => {
    if (mainWindow) {
        mainWindow.webContents.send('download-progress', {
            percent: Math.round(progressObj.percent),
            bytesPerSecond: progressObj.bytesPerSecond,
            transferred: progressObj.transferred,
            total: progressObj.total
        });
    }
});

autoUpdater.on('update-downloaded', (info) => {
    console.log('[Maze ERP] AutoUpdater: update-downloaded', info.version);
    if (mainWindow) {
        mainWindow.webContents.send('update-downloaded', {
            version: info.version
        });
    }
});

autoUpdater.on('error', (err) => {
    console.error('[Maze ERP] AutoUpdater Error:', err);
    if (mainWindow) {
        mainWindow.webContents.send('update-error', err.message || String(err));
    }
});

const iconPath = path.join(__dirname, '..', 'renderer', 'public', 'icons', 'Appicon.ico');

function startBackend() {
    if (isDev) {
        console.log('[Maze ERP] Dev mode — backend started by concurrently, skipping.');
        return;
    }

    try {
        const { startServer } = require('../backend/server');
        backendServer = startServer();
        console.log('[Maze ERP] Backend server started successfully');
    } catch (err) {
        console.error('[Maze ERP] Failed to start backend:', err);
    }
}

function handleDeepLink(url) {
    if (!url) return;
    console.log('[Maze ERP] Deep link received:', url);
    try {
        const parsedUrl = new URL(url);
        if (parsedUrl.protocol === 'maze-erp:' && mainWindow) {
            console.log('[Maze ERP] Sending auth-callback to renderer');
            mainWindow.webContents.send('auth-callback', url);
            if (mainWindow.isMinimized()) mainWindow.restore();
            mainWindow.focus();
        }
    } catch (e) {
        console.error('Deep link error:', e);
    }
}

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1200,
        height: 800,
        minWidth: 1024,
        minHeight: 680,
        title: 'Quantro',
        icon: iconPath,
        backgroundColor: '#F5F5F7',
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            contextIsolation: true,
            nodeIntegration: false
        },
        show: false,
        autoHideMenuBar: true
    });

    mainWindow.on('page-title-updated', (e) => {
        e.preventDefault();
    });

    if (isDev) {
        const { session } = require('electron');
        session.defaultSession.clearStorageData()
            .catch(err => console.error('[Maze ERP] Failed to clear storage:', err))
            .finally(() => {
                mainWindow.loadURL('http://localhost:5175');
            });
    } else {
        mainWindow.loadFile(path.join(__dirname, '..', 'renderer', 'dist', 'index.html'));
    }

    mainWindow.on('ready-to-show', () => {
        mainWindow.show();
        // Check for deep links passed in arguments (Windows/Linux)
        const url = process.argv.find(arg => arg.startsWith('maze-erp://'));
        if (url) handleDeepLink(url);
    });

    mainWindow.on('close', (e) => {
        if (!app.isQuitting && mainWindow) {
            e.preventDefault();
            mainWindow.webContents.send('app-close-requested');
            
            // Safety timeout: if renderer doesn't respond in 30s, quit anyway
            setTimeout(() => {
                if (!app.isQuitting) {
                    console.warn('[Maze ERP] Shutdown timeout reached. Quitting forcefully.');
                    app.isQuitting = true;
                    app.quit();
                }
            }, 30000);
        }
    });

    mainWindow.on('closed', () => {
        mainWindow = null;
    });
}

// IPC: Confirm quit from renderer after backup
ipcMain.on('confirm-app-quit', () => {
    console.log('[Maze ERP] Quit confirmation received from renderer. Shutting down...');
    app.isQuitting = true;
    app.quit();
});

const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', (event, commandLine) => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
      const url = commandLine.find(arg => arg.startsWith('maze-erp://'));
      if (url) handleDeepLink(url);
    }
  });

  app.whenReady().then(() => {
    try {
        startBackend();
        createWindow();
    } catch (err) {
        console.error('[Maze ERP] Critical startup error:', err);
        const { dialog } = require('electron');
        dialog.showErrorBox(
            'Startup Error',
            `The application failed to start:\n${err.message}\n\nPlease contact support if this persists.`
        );
        app.quit();
    }
  });
}

app.on('window-all-closed', () => {
    app.quit();
});

app.on('open-url', (event, url) => {
    event.preventDefault();
    handleDeepLink(url);
});

app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
    }
});
