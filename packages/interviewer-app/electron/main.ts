import { app, BrowserWindow, ipcMain } from 'electron'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { isAxiosError } from 'axios'
import { ApiClient, type CreateRoomInput } from '@unghosted/shared'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// All apps/api calls run from here (main process, not the renderer) since apps/api has no CORS
// config yet — a plain fetch/axios from the renderer would be blocked. See CLAUDE.md.
const apiClient = new ApiClient(process.env.API_BASE_URL ?? 'http://localhost:3000')

// Electron re-serializes errors thrown from an ipcMain handler across the IPC boundary, keeping
// only the top-level message — axios's response.data (the {code, message} body apps/api sends)
// gets dropped, so the renderer only ever sees "Request failed with status code 500". Unwrap it
// here so the real backend message reaches the renderer.
function handle<Args extends unknown[], Result>(channel: string, fn: (...args: Args) => Promise<Result>) {
  ipcMain.handle(channel, async (_e, ...args: Args) => {
    try {
      return await fn(...args)
    } catch (err) {
      if (isAxiosError(err)) {
        const message = err.response?.data?.message
        if (message) throw new Error(message)
      }
      throw err
    }
  })
}

handle('api:login', (email: string, password: string) => apiClient.login(email, password))
handle('api:sendCode', (name: string, email: string, password: string) => apiClient.sendCode(name, email, password))
handle('api:register', (email: string, code: number) => apiClient.register(email, code))
handle('api:refresh', () => apiClient.refresh())
handle('api:createRoom', (token: string, input: CreateRoomInput) => apiClient.createRoom(token, input))
handle('api:listRooms', (token: string) => apiClient.listRooms(token))
handle('api:getRoom', (token: string, roomId: string) => apiClient.getRoom(token, roomId))
handle('api:acceptJoin', (token: string, roomId: string) => apiClient.acceptJoin(token, roomId))
handle('api:rejectJoin', (token: string, roomId: string) => apiClient.rejectJoin(token, roomId))

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
