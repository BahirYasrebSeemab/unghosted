import { ipcRenderer, contextBridge } from 'electron'
import type { FlaggedWindow } from './windowScanner'

// --------- Expose some API to the Renderer process ---------
contextBridge.exposeInMainWorld('ipcRenderer', {
  on(...args: Parameters<typeof ipcRenderer.on>) {
    const [channel, listener] = args
    return ipcRenderer.on(channel, (event, ...args) => listener(event, ...args))
  },
  off(...args: Parameters<typeof ipcRenderer.off>) {
    const [channel, ...omit] = args
    return ipcRenderer.off(channel, ...omit)
  },
  send(...args: Parameters<typeof ipcRenderer.send>) {
    const [channel, ...omit] = args
    return ipcRenderer.send(channel, ...omit)
  },
  invoke(...args: Parameters<typeof ipcRenderer.invoke>) {
    const [channel, ...omit] = args
    return ipcRenderer.invoke(channel, ...omit)
  },
  onWindowScan: (callback: (flagged: FlaggedWindow[]) => void) => {
    const listener = (_e: Electron.IpcRendererEvent, flagged: FlaggedWindow[]) => callback(flagged)
    ipcRenderer.on('window-scan', listener)
    return () => ipcRenderer.removeListener('window-scan', listener)
  },
  onWindowScanStatus: (callback: (status: { activeCount: number }) => void) => {
    const listener = (_e: Electron.IpcRendererEvent, status: { activeCount: number }) => callback(status)
    ipcRenderer.on('window-scan-status', listener)
    return () => ipcRenderer.removeListener('window-scan-status', listener)
  },
  startSessionScan: () => ipcRenderer.send('session-start'),
  enterKioskMode: () => ipcRenderer.send('enter-kiosk'),
  exitKioskMode: () => ipcRenderer.send('exit-kiosk'),
  joinRoom: (joinCode: string) => ipcRenderer.invoke('api:joinRoom', joinCode)
})
