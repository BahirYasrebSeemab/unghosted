import type { IpcRenderer } from 'electron'
import type { BackendRoom, CreateRoomInput, LoginResult } from '@unghosted/shared'

export {}

declare global {
  interface Window {
    ipcRenderer: Pick<IpcRenderer, 'on' | 'off' | 'send' | 'invoke'> & {
      login: (email: string, password: string) => Promise<LoginResult>
      sendCode: (name: string, email: string, password: string) => Promise<void>
      register: (email: string, code: number) => Promise<void>
      refresh: () => Promise<string>
      createRoom: (token: string, input: CreateRoomInput) => Promise<BackendRoom>
      listRooms: (token: string) => Promise<BackendRoom[]>
      getRoom: (token: string, roomId: string) => Promise<BackendRoom>
      acceptJoin: (token: string, roomId: string) => Promise<BackendRoom>
      rejectJoin: (token: string, roomId: string) => Promise<BackendRoom>
    }
  }
}
