import type { IpcRenderer } from 'electron'
import type { FlaggedWindow } from '../electron/windowScanner'
import type { JoinRoomResult } from '@unghosted/shared'

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
    }
  }
}
