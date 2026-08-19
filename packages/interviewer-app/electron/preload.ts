import { ipcRenderer, contextBridge } from 'electron'
import type { CreateRoomInput } from '@unghosted/shared'

// --------- Expose some API to the Renderer process ---------
// apps/api calls (login/rooms/etc.) go through IPC to the main process rather than a direct
// renderer-side fetch/axios, because apps/api has no CORS config yet — see CLAUDE.md.
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
  login: (email: string, password: string) => ipcRenderer.invoke('api:login', email, password),
  sendCode: (name: string, email: string, password: string) => ipcRenderer.invoke('api:sendCode', name, email, password),
  register: (email: string, code: number) => ipcRenderer.invoke('api:register', email, code),
  refresh: () => ipcRenderer.invoke('api:refresh'),
  createRoom: (token: string, input: CreateRoomInput) => ipcRenderer.invoke('api:createRoom', token, input),
  listRooms: (token: string) => ipcRenderer.invoke('api:listRooms', token),
  getRoom: (token: string, roomId: string) => ipcRenderer.invoke('api:getRoom', token, roomId),
})
