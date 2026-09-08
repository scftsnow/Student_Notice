const { app, BrowserWindow, ipcMain, screen } = require('electron');
const path = require('path');
const { spawn } = require('child_process');
const http = require('http');

const isDev = process.env.NODE_ENV !== 'production' && !app.isPackaged;
const DEFAULT_PORT = process.env.PORT || 3001;
let serverProcess = null;
let mainWindow = null;
let boardWindow = null;

// Wait for HTTP server to respond
function waitForServer(url, timeoutMs = 30000) {
  const startTime = Date.now();
  return new Promise((resolve, reject) => {
    function check() {
      http.get(url, (res) => {
        resolve();
      }).on('error', (err) => {
        if (Date.now() - startTime > timeoutMs) {
          reject(new Error(`Server at ${url} failed to respond within ${timeoutMs}ms: ${err.message}`));
        } else {
          setTimeout(check, 500);
        }
      });
    }
    check();
  });
}

// Start standalone Next.js server in production
function startStandaloneServer() {
  if (isDev) return Promise.resolve(`http://localhost:${DEFAULT_PORT}`);

  return new Promise((resolve, reject) => {
    const standaloneServerPath = path.join(process.resourcesPath || __dirname, 'standalone', 'server.js');
    console.log('[Electron Main] Starting standalone server at:', standaloneServerPath);

    // Set production environment variables
    const env = {
      ...process.env,
      PORT: String(DEFAULT_PORT),
      NODE_ENV: 'production',
      DATABASE_URL: process.env.DATABASE_URL || `file:${path.join(app.getPath('userData'), 'classroom.db')}`,
    };

    serverProcess = spawn(process.execPath, [standaloneServerPath], {
      env,
      stdio: 'inherit',
    });

    serverProcess.on('error', (err) => {
      console.error('[Electron Main] Failed to spawn standalone server:', err);
      reject(err);
    });

    const serverUrl = `http://localhost:${DEFAULT_PORT}`;
    waitForServer(serverUrl)
      .then(() => resolve(serverUrl))
      .catch(reject);
  });
}

function createMainWindow(baseUrl) {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 850,
    minWidth: 900,
    minHeight: 600,
    title: '햇살 6학년 2반 - 학급 경영 OS',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  mainWindow.loadURL(baseUrl);

  mainWindow.on('closed', () => {
    mainWindow = null;
    if (boardWindow) {
      boardWindow.close();
    }
  });
}

function openOrFocusBoardWindow(baseUrl) {
  if (boardWindow && !boardWindow.isDestroyed()) {
    boardWindow.focus();
    return;
  }

  const displays = screen.getAllDisplays();
  // Find external projector or secondary display
  const externalDisplay = displays.find((d) => d.bounds.x !== 0 || d.bounds.y !== 0);

  const windowOptions = {
    title: '햇살 6학년 2반 - 학생 전자칠판',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      nodeIntegration: false,
      contextIsolation: true,
    },
  };

  if (externalDisplay) {
    // Automatically place on projector/secondary monitor in fullscreen
    windowOptions.x = externalDisplay.bounds.x;
    windowOptions.y = externalDisplay.bounds.y;
    windowOptions.width = externalDisplay.bounds.width;
    windowOptions.height = externalDisplay.bounds.height;
    windowOptions.fullscreen = true;
  } else {
    // Single monitor: open as comfortable preview window
    windowOptions.width = 1100;
    windowOptions.height = 750;
  }

  boardWindow = new BrowserWindow(windowOptions);
  boardWindow.loadURL(`${baseUrl}/board`);

  boardWindow.on('closed', () => {
    boardWindow = null;
  });
}

app.whenReady().then(async () => {
  try {
    const baseUrl = isDev ? `http://localhost:${DEFAULT_PORT}` : await startStandaloneServer();
    createMainWindow(baseUrl);

    // IPC Handlers
    ipcMain.handle('open-board-window', () => {
      openOrFocusBoardWindow(baseUrl);
      return { success: true };
    });

    ipcMain.handle('close-board-window', () => {
      if (boardWindow && !boardWindow.isDestroyed()) {
        boardWindow.close();
      }
      return { success: true };
    });

    ipcMain.handle('get-displays', () => {
      return screen.getAllDisplays().map((d) => ({
        id: d.id,
        bounds: d.bounds,
        isPrimary: d.bounds.x === 0 && d.bounds.y === 0,
      }));
    });
  } catch (err) {
    console.error('[Electron Main] Startup error:', err);
    app.quit();
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('will-quit', () => {
  if (serverProcess) {
    console.log('[Electron Main] Terminating standalone server process...');
    serverProcess.kill();
  }
});
