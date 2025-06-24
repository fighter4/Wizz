const { contextBridge, ipcRenderer } = require('electron');

// Expose a secure API to the renderer process (your index.html script)
contextBridge.exposeInMainWorld('electronAPI', {
  getApiKey: () => ipcRenderer.invoke('get-api-key'),
  openFile: () => ipcRenderer.invoke('open-file'),
  saveFile: (filePath, content) => ipcRenderer.invoke('save-file', { filePath, content }),
  openDirectory: () => ipcRenderer.invoke('open-directory'),
  readFile: (filePath) => ipcRenderer.invoke('read-file', filePath),
});
