const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  isElectron: true,
  openBoardWindow: () => ipcRenderer.invoke('open-board-window'),
  closeBoardWindow: () => ipcRenderer.invoke('close-board-window'),
  getDisplays: () => ipcRenderer.invoke('get-displays'),
  onUpdateStatus: (cb) => ipcRenderer.on('update-status', (_e, payload) => cb(payload)),
  restartToUpdate: () => ipcRenderer.invoke('restart-to-update'),
});
