const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const { autoUpdater } = require('electron-updater');
const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: path.resolve(process.cwd(), '.env') });

let win;

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

app.on('ready', () => {
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