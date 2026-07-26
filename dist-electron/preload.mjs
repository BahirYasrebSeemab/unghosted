"use strict";
const electron = require("electron");
electron.contextBridge.exposeInMainWorld("ipcRenderer", {
  on(...args) {
    const [channel, listener] = args;
    return electron.ipcRenderer.on(channel, (event, ...args2) => listener(event, ...args2));
  },
  off(...args) {
    const [channel, ...omit] = args;
    return electron.ipcRenderer.off(channel, ...omit);
  },
  send(...args) {
    const [channel, ...omit] = args;
    return electron.ipcRenderer.send(channel, ...omit);
  },
  invoke(...args) {
    const [channel, ...omit] = args;
    return electron.ipcRenderer.invoke(channel, ...omit);
  },
  onWindowScan: (callback) => {
    const listener = (_e, flagged) => callback(flagged);
    electron.ipcRenderer.on("window-scan", listener);
    return () => electron.ipcRenderer.removeListener("window-scan", listener);
  },
  onWindowScanStatus: (callback) => {
    const listener = (_e, status) => callback(status);
    electron.ipcRenderer.on("window-scan-status", listener);
    return () => electron.ipcRenderer.removeListener("window-scan-status", listener);
  },
  startSessionScan: () => electron.ipcRenderer.send("session-start"),
  enterKioskMode: () => electron.ipcRenderer.send("enter-kiosk"),
  exitKioskMode: () => electron.ipcRenderer.send("exit-kiosk")
  // You can expose other APTs you need here.
  // ...
});
