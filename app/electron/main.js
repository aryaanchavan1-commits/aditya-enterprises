const { app, BrowserWindow, Tray, Menu, dialog, shell, ipcMain, nativeImage } = require('electron');
const path = require('path');
const fs = require('fs');

// Emergency error logger - writes to D drive which is always writable
function emergLog(msg) {
  try {
    const d = new Date().toISOString();
    fs.appendFileSync('D:\\aditya-erp-crash.log', `[${d}] ${msg}\n`);
  } catch(e) {}
}

let express, cors;

try {
  emergLog('Module loading - requiring express...');
  express = require('express');
  emergLog('express OK');
  cors = require('cors');
  emergLog('cors OK');
} catch(e) {
  emergLog('REQUIRE ERROR: ' + e.message + '\n' + (e.stack || ''));
  throw e;
}

let mainWindow = null;
let tray = null;
const PORT = 3000;

let dataDir;
try {
  const userDataPath = app.getPath('userData');
  dataDir = path.join(userDataPath, 'data');
  process.env.DATA_DIR = dataDir;
  fs.mkdirSync(dataDir, { recursive: true });
  emergLog('dataDir created: ' + dataDir);
} catch(e) {
  emergLog('dataDir ERROR: ' + e.message);
}

function appLog(msg) {
  emergLog(msg);
}

function createExpressApp() {
  const server = express();
  server.use(cors());
  server.use(express.json({ limit: '50mb' }));
  server.use(express.urlencoded({ extended: true, limit: '50mb' }));

  const uploadsDir = path.join(dataDir, 'uploads');
  const barcodesDir = path.join(dataDir, 'barcodes');
  const invoicesDir = path.join(dataDir, 'invoices');
  fs.mkdirSync(uploadsDir, { recursive: true });
  fs.mkdirSync(barcodesDir, { recursive: true });
  fs.mkdirSync(invoicesDir, { recursive: true });

  server.get('/api/health', (req, res) => {
    res.json({ status: 'ok', name: 'Aditya Enterprises ERP', version: '2.0.0', time: new Date().toISOString() });
  });

  server.use('/data/uploads', express.static(uploadsDir));
  server.use('/data/barcodes', express.static(barcodesDir));
  server.use('/invoices', express.static(invoicesDir));
  server.use('/uploads', express.static(uploadsDir));
  server.use('/barcodes', express.static(barcodesDir));

  server.use('/api/products', require('../routes/products'));
  server.use('/api/categories', require('../routes/categories'));
  server.use('/api/sales', require('../routes/sales'));
  server.use('/api/barcode', require('../routes/barcode'));
  server.use('/api/gst', require('../routes/gst'));
  server.use('/api/ai', require('../routes/ai'));
  server.use('/api/upload', require('../routes/upload'));
  server.use('/api/settings', require('../routes/settings'));
  server.use('/api/devices', require('../routes/devices'));
  server.use('/api/reports', require('../routes/reports'));

  const clientBuild = path.join(__dirname, '..', 'client', 'dist');
  if (fs.existsSync(clientBuild)) {
    server.use(express.static(clientBuild));
    server.get('*', (req, res) => {
      res.sendFile(path.join(clientBuild, 'index.html'));
    });
  }

  return server;
}

async function startServer() {
  appLog('Loading db module...');
  const { getDb } = require('../db');
  appLog('db module loaded, calling getDb()...');
  await getDb();
  appLog('getDb() completed, creating Express app...');

  const server = createExpressApp();

  return new Promise((resolve, reject) => {
    const listener = server.listen(PORT, '127.0.0.1', () => {
      appLog('Express server listening on port ' + PORT);
      resolve(listener);
    });
    listener.on('error', reject);
  });
}

function createWindow() {
  const iconPath = path.join(__dirname, '..', 'client', 'public', 'logo.jpg');
  const icon = nativeImage.createFromPath(iconPath);

  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1024,
    minHeight: 700,
    title: 'Aditya Enterprises ERP 2026',
    icon,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
    },
    show: false,
    backgroundColor: '#f0f2f5',
    autoHideMenuBar: true,
  });

  mainWindow.setMenuBarVisibility(false);
  mainWindow.loadURL(`http://127.0.0.1:${PORT}`);

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    mainWindow.maximize();
  });

  mainWindow.on('close', (e) => {
    if (tray) {
      e.preventDefault();
      mainWindow.hide();
      return;
    }
    mainWindow = null;
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });
}

function createTray() {
  try {
    const iconPath = path.join(__dirname, '..', 'client', 'public', 'logo.jpg');
    const trayIcon = nativeImage.createFromPath(iconPath).resize({ width: 16, height: 16 });
    tray = new Tray(trayIcon);

    const contextMenu = Menu.buildFromTemplate([
      { label: 'Show Aditya ERP', click: () => { if (mainWindow) { mainWindow.show(); mainWindow.focus(); } else { createWindow(); } } },
      { type: 'separator' },
      { label: 'Open in Browser', click: () => shell.openExternal(`http://localhost:${PORT}`) },
      { type: 'separator' },
      { label: 'Quit', click: () => { tray = null; app.isQuitting = true; app.quit(); } },
    ]);

    tray.setToolTip('Aditya Enterprises ERP 2026');
    tray.setContextMenu(contextMenu);
    tray.on('double-click', () => { if (mainWindow) { mainWindow.isVisible() ? mainWindow.hide() : mainWindow.show(); } else { createWindow(); } });
  } catch (e) { /* tray optional */ }
}

// IPC handlers
ipcMain.handle('get-app-version', () => app.getVersion());
ipcMain.handle('get-data-path', () => app.getPath('userData'));
ipcMain.handle('open-external', (event, url) => shell.openExternal(url));
ipcMain.handle('show-save-dialog', async (event, options) => dialog.showSaveDialog(mainWindow, options));

app.whenReady().then(async () => {
  try {
    await startServer();
  } catch (err) {
    fs.mkdirSync(dataDir, { recursive: true });
    const errLog = path.join(dataDir, 'startup-error.log');
    fs.writeFileSync(errLog, `${new Date().toISOString()}\n${err.stack || err.message}\n`);
    dialog.showErrorBox('Startup Error', `Failed to start: ${err.message}\n\nLog saved to: ${errLog}`);
    app.quit();
    return;
  }
  createWindow();
  createTray();
});

app.on('window-all-closed', () => { /* stay alive in tray */ });

app.on('before-quit', () => {
  app.isQuitting = true;
});

app.on('activate', () => {
  if (mainWindow === null) { createWindow(); } else { mainWindow.show(); }
});

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
