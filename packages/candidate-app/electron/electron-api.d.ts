import type { IpcRenderer } from 'electron'
import type { FlaggedWindow } from '../electron/windowScanner'
import type { JoinRoomResult, LoginResult } from '@unghosted/shared'

export {}

declare global {
  interface Window {
    ipcRenderer: Pick<IpcRenderer, 'on' | 'off' | 'send' | 'invoke'> & {
      onWindowScan: (callback: (flagged: FlaggedWindow[]) => void) => () => void
      onWindowScanStatus: (callback: (status: { activeCount: number }) => void) => () => void
      startSessionScan: () => void
      enterKioskMode: () => void
      exitKioskMode: () => void
      joinRoom: (joinCode: string) => Promise<JoinRoomResult>
      login: (email: string, password: string) => Promise<LoginResult>
      sendCode: (name: string, email: string, password: string) => Promise<void>
      register: (email: string, code: number) => Promise<void>
    }
  }
}
