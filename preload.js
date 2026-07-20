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
  
  // --- Google Calendar IPC ---
  startGoogleAuth: () => ipcRenderer.send('start-google-auth'),
  onGoogleAuthSuccess: (callback) => {
    ipcRenderer.on('google-auth-success', (event, info) => callback(info));
  },
  disconnectGoogle: () => ipcRenderer.invoke('disconnect-google'),
  getGoogleStatus: () => ipcRenderer.invoke('get-google-status'),
  syncTaskToGCal: (task) => ipcRenderer.invoke('sync-task-to-gcal', task),
  deleteGCalEvent: (eventId) => ipcRenderer.send('delete-gcal-event', eventId),
  listGCalEvents: () => ipcRenderer.invoke('list-gcal-events'),
  
  // --- Startup Behavior IPC ---
  setStartupBehavior: (behavior) => ipcRenderer.send('set-startup-behavior', behavior),
  getStartupBehavior: () => ipcRenderer.invoke('get-startup-behavior'),
  
  // --- Auto Updater IPC ---
  checkForUpdates: () => ipcRenderer.invoke('check-for-updates'),
  onUpdateAvailable: (callback) => {
    ipcRenderer.on('update-available', (event, version) => callback(version));
  },
  onUpdateNotAvailable: (callback) => {
    ipcRenderer.on('update-not-available', () => callback());
  },
  onUpdateDownloaded: (callback) => {
    ipcRenderer.on('update-downloaded', (event, info) => callback(info));
  },
  installUpdate: () => ipcRenderer.send('install-update'),
  openExternal: (url) => ipcRenderer.send('open-external', url),
  
  // Check if running inside Electron
  isElectron: true,
  // Platform info
  platform: process.platform,
});
