const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  isElectron: true,
  openBoardWindow: () => ipcRenderer.invoke('open-board-window'),
  closeBoardWindow: () => ipcRenderer.invoke('close-board-window'),
  getDisplays: () => ipcRenderer.invoke('get-displays'),
});
