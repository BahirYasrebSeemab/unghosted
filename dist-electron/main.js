import { app, BrowserWindow, globalShortcut, session } from "electron";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import path from "node:path";
createRequire(import.meta.url);
const __dirname$1 = path.dirname(fileURLToPath(import.meta.url));
process.env.APP_ROOT = path.join(__dirname$1, "..");
const VITE_DEV_SERVER_URL = process.env["VITE_DEV_SERVER_URL"];
const MAIN_DIST = path.join(process.env.APP_ROOT, "dist-electron");
const RENDERER_DIST = path.join(process.env.APP_ROOT, "dist");
process.env.VITE_PUBLIC = VITE_DEV_SERVER_URL ? path.join(process.env.APP_ROOT, "public") : RENDERER_DIST;
let win;
function createWindow() {
  win = new BrowserWindow({
    icon: path.join(process.env.VITE_PUBLIC, "electron-vite.svg"),
    webPreferences: {
      preload: path.join(__dirname$1, "preload.mjs")
    },
    kiosk: true,
    fullscreen: true,
    resizable: false,
    maximizable: false,
    minimizable: false,
    closable: false,
    autoHideMenuBar: false,
    alwaysOnTop: true
  });
  win.setMenuBarVisibility(false);
  win.setKiosk(true);
  win.setFullScreen(true);
  const shortcuts = [
    "Alt+F4",
    "CommandOrControl+W",
    "CommandOrControl+R",
    "F11",
    "Escape"
  ];
  for (const key of shortcuts) {
    globalShortcut.register(key, () => {
    });
  }
  globalShortcut.register("Ctrl+Shift+Q", () => {
    app.quit();
  });
  win.webContents.on("did-finish-load", () => {
    win == null ? void 0 : win.webContents.send("main-process-message", (/* @__PURE__ */ new Date()).toLocaleString());
  });
  if (VITE_DEV_SERVER_URL) {
    win.loadURL(VITE_DEV_SERVER_URL);
  } else {
    win.loadFile(path.join(RENDERER_DIST, "index.html"));
  }
  win.on("leave-full-screen", () => win == null ? void 0 : win.setFullScreen(true));
  win.on("blur", () => win.focus());
}
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
    win = null;
  }
});
app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
app.on("will-quit", () => {
  globalShortcut.unregisterAll();
});
app.whenReady().then(() => {
  session.defaultSession.setPermissionRequestHandler((webContents2, permission, callback) => {
    if (permission === "media") {
      callback(true);
      return;
    }
    callback(false);
  });
  session.defaultSession.setPermissionCheckHandler((webContents2, permission) => {
    return permission === "media";
  });
  createWindow();
  win.on("close", (e) => {
    e.preventDefault();
    win.show();
    win.focus();
  });
});
export {
  MAIN_DIST,
  RENDERER_DIST,
  VITE_DEV_SERVER_URL
};
