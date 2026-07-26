import { app, BrowserWindow, session, webContents, globalShortcut, desktopCapturer, ipcMain } from 'electron'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { scanWindows, type FlaggedWindow } from './windowScanner'

const require = createRequire(import.meta.url)
const __dirname = path.dirname(fileURLToPath(import.meta.url))

// The built directory structure
//
// ├─┬─┬ dist
// │ │ └── index.html
// │ │
// │ ├─┬ dist-electron
// │ │ ├── main.js
// │ │ └── preload.mjs
// │
process.env.APP_ROOT = path.join(__dirname, '..')

// 🚧 Use ['ENV_NAME'] avoid vite:define plugin - Vite@2.x
export const VITE_DEV_SERVER_URL = process.env['VITE_DEV_SERVER_URL']
export const MAIN_DIST = path.join(process.env.APP_ROOT, 'dist-electron')
export const RENDERER_DIST = path.join(process.env.APP_ROOT, 'dist')

process.env.VITE_PUBLIC = VITE_DEV_SERVER_URL ? path.join(process.env.APP_ROOT, 'public') : RENDERER_DIST

const BLACK_LISTED_NAMES = [
  'metop vpn mini',
  'ghostgpt'
]

function flagKey(w: FlaggedWindow): string {
  return `${w.pid}:${w.type}`
}

const currentlyFlagged = new Set<string>();

let win: BrowserWindow | null
let isQuittable = false;

function createWindow() {
  win = new BrowserWindow({
    icon: path.join(process.env.VITE_PUBLIC, 'electron-vite.svg'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.mjs'),
    },
    kiosk: true,
    fullscreen: true,
    resizable: false,
    maximizable: false,
    minimizable: false,
    closable: false,
    autoHideMenuBar: false,
    alwaysOnTop: true
  })

  win.setMenuBarVisibility(false)
  win.setKiosk(true);
  win.setFullScreen(true);


  // Test active push message to Renderer-process.
  win.webContents.on('did-finish-load', () => {
    win?.webContents.send('main-process-message', (new Date).toLocaleString())
  })

  setInterval(() => {
    const flagged = scanWindows(BLACK_LISTED_NAMES)
    const flaggedKeys = new Set(flagged.map(flagKey))

    // only the ones not already being tracked are genuinely new
    const newlyFlagged = flagged.filter((w) => !currentlyFlagged.has(flagKey(w)))
    
      console.log('[scan] found:', flagged.length, '| already tracked:', currentlyFlagged.size, '| new:', newlyFlagged.length)
    

    // drop anything from tracking that's no longer present this tick
    // (window closed, or stopped matching) so it can re-flag if it returns
    for (const key of currentlyFlagged) {
      if (!flaggedKeys.has(key)) currentlyFlagged.delete(key)
    }
  flaggedKeys.forEach((key) => currentlyFlagged.add(key))

  if (newlyFlagged.length > 0) {
	  console.log('[main] sending window-scan:', newlyFlagged.length);
    win.webContents.send('window-scan', newlyFlagged)
  }

  // separately, let the renderer know the current total count for the
  // status card, without it driving new events/risk each tick
  win.webContents.send('window-scan-status', { activeCount: flagged.length })
  }, 3000)


  if (VITE_DEV_SERVER_URL) {
    win.loadURL(VITE_DEV_SERVER_URL)
  } else {
    // win.loadFile('dist/index.html')
    win.loadFile(path.join(RENDERER_DIST, 'index.html'))
  }

  win.on('leave-full-screen', () => win?.setFullScreen(true));
  win.on('blur', () => win.focus());
}

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
    win = null
  }
})

app.on('activate', () => {
  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow()
  }
})

app.on('will-quit', () => {
	globalShortcut.unregisterAll();
});

app.whenReady().then(() => { 
  session.defaultSession.setPermissionRequestHandler((webContents, permission, callback) => {
    if (permission === 'media') {
      callback(true)
      return
    }
    callback(false)
  })

  session.defaultSession.setPermissionCheckHandler((webContents, permission) => {
    return permission === 'media'
  })

  session.defaultSession.setDisplayMediaRequestHandler(async (request, callback) => {
  const sources = await desktopCapturer.getSources({ types: ['screen'] })
  // auto-select the primary screen — no picker UI, since this is a
  // proctoring context where you generally want "capture their screen",
  // not "let them choose which window to share"
  callback({ video: sources[0], audio: 'loopback' })
  })

  createWindow ()

  const shortcuts = [
    'Alt+F4',
    'CommandOrControl+W',
    'CommandOrControl+R',
    'F11',
    'Escape'
  ]

  for (const key of shortcuts) {
    globalShortcut.register(key, () => {});
  }

  const registered = globalShortcut.register('Ctrl+Shift+Q', () => { 
	  isQuittable = true;
	  app.quit(); 
	  win.close()
	  console.log("FIRED")
  });
  console.log('[shortcut] registered:', registered)
  
  win.on('close', (e) => {
	  if (isQuittable) return
	 e.preventDefault();
	 win.show();
	 win.focus();
	})

})

app.on('before-quit', () => {
	isQuittable = true;
})

ipcMain.on('session-start', () => {
  currentlyFlagged.clear()
})
