const { app, BrowserWindow, ipcMain, screen, Menu, dialog } = require('electron');
const { autoUpdater } = require('electron-updater');
const path = require('path');
const fs = require('fs');
const net = require('net');
const { spawn } = require('child_process');
const http = require('http');

const isDev = process.env.NODE_ENV !== 'production' && !app.isPackaged;
const DEFAULT_PORT = process.env.PORT || 3001;
const APP_ICON = isDev
  ? path.join(__dirname, '..', 'build', 'icon.ico')
  : path.join(process.resourcesPath || __dirname, 'icon.ico');
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

// 설치 패키지 첫 실행 시 스키마가 적용된 빈 DB를 userData에 복사한다.
// 기존 사용자 DB가 있으면 절대 건드리지 않는다.
function ensureDatabase() {
  const userDbPath = path.join(app.getPath('userData'), 'classroom.db');
  if (fs.existsSync(userDbPath)) return userDbPath;
  try {
    fs.mkdirSync(path.dirname(userDbPath), { recursive: true });
    const templatePath = path.join(process.resourcesPath || __dirname, 'db-template', 'classroom-template.db');
    if (fs.existsSync(templatePath)) {
      fs.copyFileSync(templatePath, userDbPath);
      console.log('[Electron Main] Copied DB template to:', userDbPath);
    } else {
      console.error('[Electron Main] DB template not found at:', templatePath);
    }
  } catch (err) {
    console.error('[Electron Main] Failed to prepare database:', err);
  }
  return userDbPath;
}

// 3001부터 순서대로 빈 포트 탐색 (개발 서버와 충돌 방지, 최대 20개 시도)
// Windows는 SO_REUSEADDR 때문에 bind 탐지가 소용없으므로 접속 시도로 판정한다.
function isPortFree(port) {
  return new Promise((resolve) => {
    let done = false;
    const finish = (free) => {
      if (done) return;
      done = true;
      try { socket.destroy(); } catch {}
      resolve(free);
    };
    const socket = net.createConnection({ port, host: '127.0.0.1' });
    const timer = setTimeout(() => finish(false), 1000);
    socket.once('connect', () => {
      clearTimeout(timer);
      try { socket.end(); } catch {}
      finish(false); // 접속됨 = 사용 중
    });
    socket.once('error', () => {
      clearTimeout(timer);
      finish(true); // 거부됨 = 빈 포트
    });
  });
}

async function findFreePort(start, end) {
  for (let port = start; port <= end; port++) {
    if (await isPortFree(port)) return port;
  }
  throw new Error(`No free port in range ${start}-${end}`);
}

// Start standalone Next.js server in production
async function startStandaloneServer() {
  if (isDev) return `http://localhost:${DEFAULT_PORT}`;

  const portFile = path.join(app.getPath('userData'), 'port.txt');
  let port = null;

  // 1) 설치/첫 실행 시 정해둔 포트가 있으면 그대로 사용 (데이터 origin 안정화)
  try {
    if (fs.existsSync(portFile)) {
      const saved = Number(fs.readFileSync(portFile, 'utf8').trim());
      if (Number.isInteger(saved) && saved >= 1024 && saved <= 65535) {
        port = saved;
      }
    }
  } catch {}

  // 2) 포트 파일이 없으면 (첫 실행) 빈 포트를 하나 골라 저장
  if (!port) {
    port = await findFreePort(3002, 3021);
    try { fs.writeFileSync(portFile, String(port), 'utf8'); } catch {}
  }

  // 3) 저장된 포트가 이미 사용 중이면 앱을 띄우지 않는다 (origin 변경으로 인한 데이터 유실 방지)
  if (!(await isPortFree(port))) {
    throw new Error(`Saved port ${port} is already in use. Close the conflicting app and retry.`);
  }

  return new Promise((resolve, reject) => {
    const standaloneServerPath = path.join(process.resourcesPath || __dirname, 'standalone', 'server.js');
    console.log('[Electron Main] Starting standalone server at:', standaloneServerPath);

    // Set production environment variables
    const env = {
      ...process.env,
      // Electron 바이너리로 서버 스크립트를 실행하므로 순수 Node로 동작 지정.
      // 없으면 자식 프로세스가 앱 메인(main.cjs)을 다시 실행해 무한 분기한다.
      ELECTRON_RUN_AS_NODE: '1',
      PORT: String(port),
      NODE_ENV: 'production',
      DATABASE_URL: process.env.DATABASE_URL || `file:${ensureDatabase()}`,
    };

    serverProcess = spawn(process.execPath, [standaloneServerPath], {
      env,
      // 서버 콘솔창이 뜨지 않게 백그라운드로 실행 (로그는 버림)
      stdio: 'ignore',
      windowsHide: true,
    });

    try {
      fs.appendFileSync(
        path.join(app.getPath('userData'), 'server.log'),
        `[spawn] pid=${serverProcess.pid} at=${new Date().toISOString()}\n`
      );
    } catch {}
    serverProcess.on('exit', (code, signal) => {
      try {
        fs.appendFileSync(
          path.join(app.getPath('userData'), 'server.log'),
          `[exit] code=${code} signal=${signal} at=${new Date().toISOString()}\n`
        );
      } catch {}
    });

    serverProcess.on('error', (err) => {
      console.error('[Electron Main] Failed to spawn standalone server:', err);
      reject(err);
    });

    const serverUrl = `http://localhost:${port}`;
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
    title: 'Teacher Helper-학급 운영',
    icon: APP_ICON,
    autoHideMenuBar: true,
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
    title: 'Teacher Helper-학급 운영 - 학생 전자칠판',
    icon: APP_ICON,
    autoHideMenuBar: true,
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

// 자동 업데이트 설정 (설치 버전에서만 동작)
autoUpdater.autoDownload = true;
autoUpdater.autoInstallOnAppQuit = true;
autoUpdater.on('error', (err) => {
  try { fs.appendFileSync(path.join(app.getPath('userData'), 'server.log'), `[updater] error: ${err && err.message ? err.message : err}\n`); } catch {}
});
autoUpdater.on('update-available', (info) => {
  try { fs.appendFileSync(path.join(app.getPath('userData'), 'server.log'), `[updater] update available: ${info.version}\n`); } catch {}
  // 일부 환경에서 자동 다운로드가 시작되지 않는 경우를 대비해 명시적으로 다운로드
  autoUpdater.downloadUpdate().catch((err) => {
    try { fs.appendFileSync(path.join(app.getPath('userData'), 'server.log'), `[updater] download start failed: ${err && err.message ? err.message : err}\n`); } catch {}
  });
});

autoUpdater.on('download-progress', (progress) => {
  try { fs.appendFileSync(path.join(app.getPath('userData'), 'server.log'), `[updater] progress: ${Math.round(progress.percent)}%\n`); } catch {}
});
autoUpdater.on('update-downloaded', (info) => {
  try { fs.appendFileSync(path.join(app.getPath('userData'), 'server.log'), `[updater] downloaded: ${info.version}\n`); } catch {}
  if (mainWindow) {
    dialog.showMessageBox(mainWindow, {
      type: 'info',
      title: '업데이트',
      message: `새 버전 ${info.version}이 다운로드되었습니다. 지금 재시작하여 설치할까요?`,
      buttons: ['지금 재시작', '나중에'],
      defaultId: 0,
    }).then(({ response }) => {
      if (response === 0) autoUpdater.quitAndInstall();
    });
  }
});

app.whenReady().then(async () => {
  // 설치형 상단 메뉴바(File·Edit·View…) 제거
  Menu.setApplicationMenu(null);
  try {
    const baseUrl = isDev ? `http://localhost:${DEFAULT_PORT}` : await startStandaloneServer();
    createMainWindow(baseUrl);

    // 설치 버전에서만 자동 업데이트 확인
    if (!isDev) {
      autoUpdater.checkForUpdatesAndNotify().catch((err) => {
        try { fs.appendFileSync(path.join(app.getPath('userData'), 'server.log'), `[updater] check failed: ${err && err.message ? err.message : err}\n`); } catch {}
      });
    }

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
