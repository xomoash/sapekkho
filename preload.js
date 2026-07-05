const { contextBridge, ipcRenderer } = require('electron');

// Expose safe APIs to the renderer (index.html)
contextBridge.exposeInMainWorld('electronAPI', {
  // Send a native Windows notification via the main process
  showNotification: (title, body, tag) => {
    ipcRenderer.send('show-notification', { title, body, tag });
  },
  // Update native window theme colors
  setTheme: (theme) => {
    ipcRenderer.send('set-theme', theme);
  },
  // Listen for Quick Add global shortcut
  onQuickAdd: (callback) => {
    ipcRenderer.on('open-quick-add', () => callback());
  },
  // Update system tray with high priority tasks
  updateTrayTasks: (tasks) => {
    ipcRenderer.send('update-tray-tasks', tasks);
  },
  // Set Auto Launch
  setAutoLaunch: (enable) => {
    ipcRenderer.send('set-auto-launch', enable);
  },
  // Set Global Shortcut
  setGlobalShortcut: (accelerator) => {
    ipcRenderer.send('set-global-shortcut', accelerator);
  },
  // Check if running inside Electron
  isElectron: true,
  // Platform info
  platform: process.platform,
});
