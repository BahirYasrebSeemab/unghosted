import { app, BrowserWindow, ipcMain } from 'electron'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { ApiClient, type CreateRoomInput } from '@unghosted/shared'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// All apps/api calls run from here (main process, not the renderer) since apps/api has no CORS
// config yet — a plain fetch/axios from the renderer would be blocked. See CLAUDE.md.
const apiClient = new ApiClient(process.env.API_BASE_URL ?? 'http://localhost:3000')

ipcMain.handle('api:login', (_e, email: string, password: string) => apiClient.login(email, password))
ipcMain.handle('api:sendCode', (_e, name: string, email: string, password: string) => apiClient.sendCode(name, email, password))
ipcMain.handle('api:register', (_e, email: string, code: number) => apiClient.register(email, code))
ipcMain.handle('api:refresh', () => apiClient.refresh())
ipcMain.handle('api:createRoom', (_e, token: string, input: CreateRoomInput) => apiClient.createRoom(token, input))
ipcMain.handle('api:listRooms', (_e, token: string) => apiClient.listRooms(token))
ipcMain.handle('api:getRoom', (_e, token: string, roomId: string) => apiClient.getRoom(token, roomId))

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

export const VITE_DEV_SERVER_URL = process.env['VITE_DEV_SERVER_URL']
export const MAIN_DIST = path.join(process.env.APP_ROOT, 'dist-electron')
export const RENDERER_DIST = path.join(process.env.APP_ROOT, 'dist')

process.env.VITE_PUBLIC = VITE_DEV_SERVER_URL ? path.join(process.env.APP_ROOT, 'public') : RENDERER_DIST

let win: BrowserWindow | null

function createWindow() {
  win = new BrowserWindow({
    icon: path.join(process.env.VITE_PUBLIC, 'electron-vite.svg'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.mjs'),
    },
    width: 1280,
    height: 800,
  })

  win.webContents.on('did-finish-load', () => {
    win?.webContents.send('main-process-message', new Date().toLocaleString())
  })

  if (VITE_DEV_SERVER_URL) {
    win.loadURL(VITE_DEV_SERVER_URL)
  } else {
    win.loadFile(path.join(RENDERER_DIST, 'index.html'))
  }
}

// Unlike the candidate app, the interviewer app is a normal desktop window:
// no kiosk lock, no disabled close/quit shortcuts, no window scanning — it's
// the dashboard/control surface, not the proctored surface.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
    win = null
  }
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow()
  }
})

app.whenReady().then(createWindow)
