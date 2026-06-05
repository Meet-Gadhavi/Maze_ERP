const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('maze', {
    platform: process.platform,
    version: '1.0.1',
    onAuthCallback: (callback) => ipcRenderer.on('auth-callback', (_event, url) => callback(url)),
    openCustomerDisplay: () => ipcRenderer.send('open-customer-window'),
    updateCustomerDisplay: (data) => ipcRenderer.send('update-customer-display-data', data),
    onCustomerDisplayUpdate: (callback) => {
        const listener = (_event, data) => callback(data);
        ipcRenderer.on('customer-display-update', listener);
        return () => ipcRenderer.removeListener('customer-display-update', listener);
    },
    triggerCashDrawer: () => ipcRenderer.send('trigger-cash-drawer'),
    printPage: () => ipcRenderer.send('print-page'),
    onCashDrawerResult: (callback) => {
        const listener = (_event, result) => callback(result);
        ipcRenderer.on('cash-drawer-test-result', listener);
        return () => ipcRenderer.removeListener('cash-drawer-test-result', listener);
    },
    onAppCloseRequested: (callback) => ipcRenderer.on('app-close-requested', () => callback()),
    confirmAppQuit: () => ipcRenderer.send('confirm-app-quit'),
    openExternal: (url) => ipcRenderer.send('open-external', url),
    updates: {
        check: () => ipcRenderer.send('check-for-updates'),
        download: () => ipcRenderer.send('download-update'),
        install: () => ipcRenderer.send('install-update'),
        onAvailable: (callback) => {
            const listener = (_event, info) => callback(info);
            ipcRenderer.on('update-available', listener);
            return () => ipcRenderer.removeListener('update-available', listener);
        },
        onNotAvailable: (callback) => {
            const listener = () => callback();
            ipcRenderer.on('update-not-available', listener);
            return () => ipcRenderer.removeListener('update-not-available', listener);
        },
        onProgress: (callback) => {
            const listener = (_event, progressObj) => callback(progressObj);
            ipcRenderer.on('download-progress', listener);
            return () => ipcRenderer.removeListener('download-progress', listener);
        },
        onDownloaded: (callback) => {
            const listener = (_event, info) => callback(info);
            ipcRenderer.on('update-downloaded', listener);
            return () => ipcRenderer.removeListener('update-downloaded', listener);
        },
        onError: (callback) => {
            const listener = (_event, err) => callback(err);
            ipcRenderer.on('update-error', listener);
            return () => ipcRenderer.removeListener('update-error', listener);
        }
    }
});
