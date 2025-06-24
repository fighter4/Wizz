const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const { autoUpdater } = require('electron-updater');

const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: path.resolve(process.cwd(), '.env') });

let store;

let win;
let settingsWin;

function createWindow() {
  win = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  const VITE_DEV_SERVER_URL = process.env['VITE_DEV_SERVER_URL'];
  if (VITE_DEV_SERVER_URL) {
    win.loadURL(VITE_DEV_SERVER_URL);
  } else {
    win.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));
  }
}

app.whenReady().then(async () => {
  const { default: Store } = await import('electron-store');
  store = new Store();

  createWindow();
  autoUpdater.checkForUpdatesAndNotify();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (win === null) {
    createWindow();
  }
});

// IPC Handlers
ipcMain.handle('get-api-key', () => {
  return process.env.GEMINI_API_KEY;
});

ipcMain.handle('open-file', async () => {
  const { canceled, filePaths } = await dialog.showOpenDialog();
  if (canceled) {
    return;
  }
  const filePath = filePaths[0];
  const content = fs.readFileSync(filePath, 'utf-8');
  return { filePath, content };
});

ipcMain.handle('save-file', async (event, { filePath, content }) => {
  if (!filePath) {
    const { canceled, filePath: newFilePath } = await dialog.showSaveDialog();
    if (canceled) {
      return;
    }
    filePath = newFilePath;
  }
  fs.writeFileSync(filePath, content);
  return { filePath };
});

ipcMain.handle('open-directory', async () => {
    const { canceled, filePaths } = await dialog.showOpenDialog({
        properties: ['openDirectory']
    });
    if (canceled) {
        return;
    }
    const dirPath = filePaths[0];
    const ignoreList = ['node_modules', '.git', '.vscode'];

    function readDirRecursive(dir) {
        const dirents = fs.readdirSync(dir, { withFileTypes: true });
        const item = {
            name: path.basename(dir),
            path: dir,
            children: []
        };
        for (const dirent of dirents) {
            if (ignoreList.includes(dirent.name)) {
                continue;
            }
            const res = path.resolve(dir, dirent.name);
            if (dirent.isDirectory()) {
                item.children.push(readDirRecursive(res));
            } else {
                item.children.push({ name: dirent.name, path: res });
            }
        }
        return item;
    }
    return readDirRecursive(dirPath);
});

ipcMain.handle('read-file', async (event, filePath) => {
    try {
        const content = fs.readFileSync(filePath, 'utf-8');
        return { filePath, content };
    } catch (error) {
        console.error('Failed to read file:', error);
        return null;
    }
});

function createSettingsWindow() {
  settingsWin = new BrowserWindow({
    width: 800,
    height: 600,
    parent: win,
    modal: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  const VITE_DEV_SERVER_URL = process.env['VITE_DEV_SERVER_URL'];
  if (VITE_DEV_SERVER_URL) {
    settingsWin.loadURL(`${VITE_DEV_SERVER_URL}/settings.html`);
  } else {
    settingsWin.loadFile(path.join(__dirname, '..', 'dist', 'settings.html'));
  }

  settingsWin.on('closed', () => {
    settingsWin = null;
  });
}

// IPC Handlers for settings
ipcMain.handle('open-settings-window', () => {
  if (!settingsWin) {
    createSettingsWindow();
  }
});

ipcMain.handle('get-setting', async (event, key) => {
  return store.get(key);
});

ipcMain.handle('set-setting', async (event, { key, value }) => {
  store.set(key, value);
});

ipcMain.on('theme-updated', (event, theme) => {
  win.webContents.send('theme-changed', theme);
});