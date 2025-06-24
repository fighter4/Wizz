const { contextBridge, ipcRenderer } = require('electron');

// Expose a secure API to the renderer process (your index.html script)
contextBridge.exposeInMainWorld('electronAPI', {
  getApiKey: () => ipcRenderer.invoke('get-api-key'),
  openFile: () => ipcRenderer.invoke('open-file'),
  saveFile: (filePath, content) => ipcRenderer.invoke('save-file', { filePath, content }),
  openDirectory: () => ipcRenderer.invoke('open-directory'),
  readFile: (filePath) => ipcRenderer.invoke('read-file', filePath),
  openSettingsWindow: () => ipcRenderer.invoke('open-settings-window'),
  getSetting: (key) => ipcRenderer.invoke('get-setting', key),
  setSetting: (key, value) => ipcRenderer.invoke('set-setting', { key, value }),
  onThemeChanged: (callback) => ipcRenderer.on('theme-changed', (_event, value) => callback(value)),
  themeUpdated: (theme) => ipcRenderer.send('theme-updated', theme),
});
