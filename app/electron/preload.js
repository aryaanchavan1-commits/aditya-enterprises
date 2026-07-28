const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  getAppVersion: () => ipcRenderer.invoke('get-app-version'),
  getDataPath: () => ipcRenderer.invoke('get-data-path'),
  openExternal: (url) => ipcRenderer.invoke('open-external', url),
  showSaveDialog: (options) => ipcRenderer.invoke('show-save-dialog', options),
  platform: process.platform,
  isElectron: true,
});
