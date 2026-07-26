import type { IpcRenderer } from 'electron'
import type { FlaggedWindow } from '../electron/windowScanner'

export {}

declare global {
  interface Window {
    ipcRenderer: Pick<IpcRenderer, 'on' | 'off' | 'send' | 'invoke'> & {
      onWindowScan: (callback: (flagged: FlaggedWindow[]) => void) => () => void,
      onWindowScan: (callback: (flagged: FlaggedWindow[]) => void) => () => void
    }
  }
}
