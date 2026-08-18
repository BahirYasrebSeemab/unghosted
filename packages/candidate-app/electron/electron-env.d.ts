/// <reference types="vite-plugin-electron/electron-env" />

declare namespace NodeJS {
  interface ProcessEnv {
    /**
     * The built directory structure
     *
     * ```tree
     * ├─┬─┬ dist
     * │ │ └── index.html
     * │ │
     * │ ├─┬ dist-electron
     * │ │ ├── main.js
     * │ │ └── preload.js
     * │
     * ```
     */
    APP_ROOT: string
    /** /dist/ or /public/ */
    VITE_PUBLIC: string
  }
}

// Window.ipcRenderer's real shape is declared in electron-api.d.ts — a second, narrower
// `interface Window { ipcRenderer: ... }` here silently wins during merging and hides the
// augmented methods (this was CLAUDE.md's documented "window.ipcRenderer resolves to Electron's
// built-in IpcRenderer type" rough edge; the vite-plugin-electron template generates this file
// with its own Window augmentation, which is what was shadowing it).
