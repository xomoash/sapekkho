const { app, BrowserWindow, Tray, Menu, nativeImage, ipcMain, Notification, shell, globalShortcut, dialog } = require('electron');
const path = require('path');
const { autoUpdater } = require('electron-updater');
const Store = require('electron-store');
const googleCalendar = require('./google-calendar');

const store = new Store();
let mainWindow = null;
let tray = null;

// Single instance lock — prevent multiple windows
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.show();
      mainWindow.focus();
    }
  });
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 900,
    height: 600,
    minWidth: 600,
    minHeight: 500,
    title: 'Sapekkho',
    icon: path.join(__dirname, 'logo.png'),
    titleBarStyle: 'hidden',
    titleBarOverlay: {
      color: '#f3f4f6',
      symbolColor: '#111827',
      height: 38
    },
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
    backgroundColor: '#f3f4f6',
    show: true,
  });

  mainWindow.webContents.openDevTools();

  // Capture renderer crashes and console errors for debugging
  mainWindow.webContents.on('render-process-gone', (event, details) => {
    console.error('[RENDERER CRASH]', details);
  });
  mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
    console.error('[LOAD FAILED]', errorCode, errorDescription);
  });
  mainWindow.webContents.on('console-message', (event, level, message, line, sourceId) => {
    const levels = ['verbose', 'info', 'warning', 'error'];
    console.log(`[RENDERER ${levels[level] || level}] ${message} (${sourceId}:${line})`);
  });

  mainWindow.loadFile('index.html');

  mainWindow.once('ready-to-show', () => {
    // Always show on ready-to-show (debug: bypass startup-behavior)
    mainWindow.show();
    mainWindow.focus();
  });

  // Minimise to tray instead of closing
  mainWindow.on('close', (event) => {
    if (!app.isQuitting) {
      event.preventDefault();
      mainWindow.hide();
    }
  });
}

function createTray() {
  // Use logo.png for the tray icon
  const icon = nativeImage.createFromPath(path.join(__dirname, 'logo.png'));
  const trayIcon = icon.resize({ width: 16, height: 16 });
  tray = new Tray(trayIcon);
  tray.setToolTip('Sapekkho');

  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Open Sapekkho',
      click: () => {
        mainWindow.show();
        mainWindow.focus();
      }
    },
    { type: 'separator' },
    {
      label: 'Quit',
      click: () => {
        app.isQuitting = true;
        app.quit();
      }
    }
  ]);

  tray.setContextMenu(contextMenu);

  tray.on('click', () => {
    if (mainWindow.isVisible()) {
      mainWindow.hide();
    } else {
      mainWindow.show();
      mainWindow.focus();
    }
  });
}

// Handle native notification requests from the renderer (web page)
ipcMain.on('show-notification', (event, { title, body, tag }) => {
  if (Notification.isSupported()) {
    const notification = new Notification({
      title,
      body,
      icon: path.join(__dirname, 'notification-bell.png'),
      silent: false,
    });
    notification.on('click', () => {
      mainWindow.show();
      mainWindow.focus();
    });
    notification.show();
  }
});

ipcMain.on('set-theme', (event, theme) => {
  if (mainWindow) {
    if (theme === 'dark') {
      mainWindow.setTitleBarOverlay({
        color: '#202020',
        symbolColor: '#ffffff'
      });
      mainWindow.setBackgroundColor('#202020');
    } else {
      mainWindow.setTitleBarOverlay({
        color: '#f3f4f6',
        symbolColor: '#111827'
      });
      mainWindow.setBackgroundColor('#f3f4f6');
    }
  }
});

// Handle open-external links from the renderer
ipcMain.on('open-external', (event, url) => {
  shell.openExternal(url);
});

ipcMain.on('update-tray-tasks', (event, tasks) => {
  if (!tray) return;

  let menuTemplate = [
    {
      label: 'Open Sapekkho',
      click: () => {
        mainWindow.show();
        mainWindow.focus();
      }
    },
    { type: 'separator' }
  ];

  if (tasks && tasks.length > 0) {
    menuTemplate.push({ label: 'High Priority Tasks', enabled: false });
    tasks.forEach(task => {
      menuTemplate.push({
        label: `• ${task.title}`,
        click: () => {
          mainWindow.show();
          mainWindow.focus();
        }
      });
    });
    menuTemplate.push({ type: 'separator' });
  }

  menuTemplate.push({
    label: 'Quit',
    click: () => {
      app.isQuitting = true;
      app.quit();
    }
  });

  tray.setContextMenu(Menu.buildFromTemplate(menuTemplate));
});

let currentShortcut = 'CommandOrControl+T';

ipcMain.on('set-global-shortcut', (event, accelerator) => {
  if (currentShortcut) {
    globalShortcut.unregister(currentShortcut);
  }
  currentShortcut = accelerator;
  if (accelerator) {
    globalShortcut.register(accelerator, () => {
      if (mainWindow) {
        if (!mainWindow.isVisible()) mainWindow.show();
        if (mainWindow.isMinimized()) mainWindow.restore();
        mainWindow.focus();
        mainWindow.webContents.send('open-quick-add');
      }
    });
  }
});

ipcMain.on('set-auto-launch', (event, enable) => {
  app.setLoginItemSettings({
    openAtLogin: enable,
    path: app.getPath('exe')
  });
});

// --- Google Calendar Sync IPC ---
ipcMain.on('start-google-auth', (event) => {
  const url = googleCalendar.getAuthUrl();
  if (url) {
    googleCalendar.startAuthServer((err, info) => {
      if (!err && mainWindow) {
        mainWindow.webContents.send('google-auth-success', info);
        if (mainWindow.isMinimized()) mainWindow.restore();
        mainWindow.show();
        mainWindow.focus();
      }
    });
    shell.openExternal(url);
  }
});

ipcMain.handle('disconnect-google', async (event) => {
  return await googleCalendar.disconnectAccount();
});

ipcMain.handle('get-google-status', (event) => {
  return {
    connected: googleCalendar.isAuthenticated(),
    email: googleCalendar.getUserEmail()
  };
});

ipcMain.handle('sync-task-to-gcal', async (event, task) => {
  return await googleCalendar.syncTaskToCalendar(task);
});

ipcMain.on('delete-gcal-event', (event, eventId) => {
  googleCalendar.deleteCalendarEvent(eventId);
});

ipcMain.handle('list-gcal-events', async (event) => {
  return await googleCalendar.listCalendarEvents();
});

// --- Startup Behavior IPC ---
ipcMain.on('set-startup-behavior', (event, behavior) => {
  store.set('startup-behavior', behavior);
});

ipcMain.handle('get-startup-behavior', (event) => {
  return store.get('startup-behavior', 'normal');
});

// --- Auto Updater IPC ---
ipcMain.handle('check-for-updates', async () => {
  try {
    const result = await autoUpdater.checkForUpdates();
    // result.updateInfo contains version if available, but if it's the same, it might still return it.
    // electron-updater will emit 'update-available' or 'update-not-available'
    // But since we are awaiting, we can just return a generic success and let the events handle the UI, 
    // or we can parse the result.
    if (result && result.updateInfo) {
      // It returns UpdateCheckResult
      return { checked: true };
    }
    return { checked: false };
  } catch (error) {
    console.error('Update check error:', error);
    return { error: error.message };
  }
});

app.whenReady().then(() => {
  createWindow();
  createTray();

  // Register default shortcut initially; renderer can override this later.
  globalShortcut.register(currentShortcut, () => {
    if (mainWindow) {
      if (!mainWindow.isVisible()) mainWindow.show();
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
      mainWindow.webContents.send('open-quick-add');
    }
  });

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });

  // ─── Auto Updater ───────────────────────────────────────────────
  // Configure logging
  autoUpdater.autoDownload = true;          // download silently in background
  autoUpdater.autoInstallOnAppQuit = true;  // install when user closes the app

  autoUpdater.on('update-available', (info) => {
    // Notify the renderer so it can show a subtle banner
    if (mainWindow) mainWindow.webContents.send('update-available', info.version);
  });

  autoUpdater.on('update-not-available', () => {
    if (mainWindow) mainWindow.webContents.send('update-not-available');
  });

  autoUpdater.on('update-downloaded', (info) => {
    // Ask the user if they want to restart now or later
    const changelog = info.releaseNotes || 'No changelog available.';
    const cleanChangelog = typeof changelog === 'string' 
      ? changelog.replace(/<[^>]*>/g, '') 
      : changelog;

    dialog.showMessageBox(mainWindow, {
      type: 'info',
      title: 'Update Ready — Sapekkho',
      message: `Sapekkho v${info.version} has been downloaded.`,
      detail: `What's new:\n${cleanChangelog}\n\nRestart now to apply the update, or it will be applied automatically next time you open the app.`,
      buttons: ['Restart Now', 'Later'],
      defaultId: 0
    }).then(({ response }) => {
      if (response === 0) autoUpdater.quitAndInstall();
    });
  });

  autoUpdater.on('error', (err) => {
    console.error('[AutoUpdater] Error:', err.message);
  });

  // Check 5 seconds after launch so the window has time to render first
  setTimeout(() => {
    autoUpdater.checkForUpdatesAndNotify();
  }, 5000);
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
});

app.on('window-all-closed', () => {
  // On Windows/Linux, keep app running in tray
  if (process.platform === 'darwin') app.quit();
});

app.on('before-quit', () => {
  app.isQuitting = true;
});
