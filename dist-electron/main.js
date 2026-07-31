import { app, BrowserWindow, globalShortcut, session, desktopCapturer, ipcMain } from "electron";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import path from "node:path";
import util from "node:util";
import fs from "node:fs";
const require$1 = createRequire(import.meta.url);
function loadStatic(pkg2) {
  let native2 = null;
  if (pkg2 == "linux-arm64") {
    try {
      native2 = require$1("@koromix/koffi-linux-arm64");
    } catch (err) {
    }
  }
  if (pkg2 == "linux-ia32") {
    try {
      native2 = require$1("@koromix/koffi-linux-ia32");
    } catch (err) {
    }
  }
  if (pkg2 == "linux-x64") {
    try {
      native2 = require$1("@koromix/koffi-linux-x64");
    } catch (err) {
    }
  }
  if (pkg2 == "linux-riscv64") {
    try {
      native2 = require$1("@koromix/koffi-linux-riscv64");
    } catch (err) {
    }
  }
  if (pkg2 == "freebsd-ia32") {
    try {
      native2 = require$1("@koromix/koffi-freebsd-ia32");
    } catch (err) {
    }
  }
  if (pkg2 == "freebsd-x64") {
    try {
      native2 = require$1("@koromix/koffi-freebsd-x64");
    } catch (err) {
    }
  }
  if (pkg2 == "freebsd-arm64") {
    try {
      native2 = require$1("@koromix/koffi-freebsd-arm64");
    } catch (err) {
    }
  }
  if (pkg2 == "openbsd-ia32") {
    try {
      native2 = require$1("@koromix/koffi-openbsd-ia32");
    } catch (err) {
    }
  }
  if (pkg2 == "openbsd-x64") {
    try {
      native2 = require$1("@koromix/koffi-openbsd-x64");
    } catch (err) {
    }
  }
  if (pkg2 == "win32-ia32") {
    try {
      native2 = require$1("@koromix/koffi-win32-ia32");
    } catch (err) {
    }
  }
  if (pkg2 == "win32-x64") {
    try {
      native2 = require$1("@koromix/koffi-win32-x64");
    } catch (err) {
    }
  }
  if (pkg2 == "win32-arm64") {
    try {
      native2 = require$1("@koromix/koffi-win32-arm64");
    } catch (err) {
    }
  }
  if (pkg2 == "darwin-x64") {
    try {
      native2 = require$1("@koromix/koffi-darwin-x64");
    } catch (err) {
    }
  }
  if (pkg2 == "darwin-arm64") {
    try {
      native2 = require$1("@koromix/koffi-darwin-arm64");
    } catch (err) {
    }
  }
  if (pkg2 == "linux-loong64") {
    try {
      native2 = require$1("@koromix/koffi-linux-loong64");
    } catch (err) {
    }
  }
  return native2;
}
function determineAbi() {
  let abi = process.arch.toString();
  if (abi == "riscv32" || abi == "riscv64") {
    let buf = readFileHeader(process.execPath, 512);
    let header = decodeElfHeader(buf);
    let float_abi = header.e_flags & 6;
    switch (float_abi) {
      case 0:
        break;
      case 2:
        {
          abi += "f";
        }
        break;
      case 4:
        {
          abi += "d";
        }
        break;
      case 6:
        {
          abi += "q";
        }
        break;
    }
  } else if (abi == "arm") {
    let buf = readFileHeader(process.execPath, 512);
    let header = decodeElfHeader(buf);
    if (header.e_flags & 1024) {
      abi += "hf";
    } else if (header.e_flags & 512) {
      abi += "sf";
    } else {
      throw new Error("Unknown ARM floating-point ABI");
    }
  }
  return abi;
}
function readFileHeader(filename, read) {
  try {
    let fd2 = fs.openSync(filename);
    let buf = Buffer.allocUnsafe(read);
    let len = fs.readSync(fd2, buf);
    return buf.subarray(0, len);
  } finally {
  }
}
function decodeElfHeader(buf) {
  let header = {};
  if (buf.length < 16)
    throw new Error("Truncated header");
  if (buf[0] != 127 || buf[1] != 69 || buf[2] != 76 || buf[3] != 70)
    throw new Error("Invalid magic number");
  if (buf[6] != 1)
    throw new Error("Invalid ELF version");
  if (buf[5] != 1)
    throw new Error("Big-endian architectures are not supported");
  header.e_machine = buf.readUInt16LE(18);
  switch (buf[4]) {
    case 1:
      {
        buf = buf.subarray(0, 68);
        if (buf.length < 68)
          throw new Error("Truncated ELF header");
        header.ei_class = 32;
        header.e_flags = buf.readUInt32LE(36);
      }
      break;
    case 2:
      {
        buf = buf.subarray(0, 120);
        if (buf.length < 120)
          throw new Error("Truncated ELF header");
        header.ei_class = 64;
        header.e_flags = buf.readUInt32LE(48);
      }
      break;
    default:
      throw new Error("Invalid ELF class");
  }
  return header;
}
var package_default = { name: "koffi", version: "3.1.2", cnoke: { napi: 8 } };
var require2 = createRequire(import.meta.url);
function detectPlatform() {
  if (process.versions.napi == null || process.versions.napi < package_default.cnoke.napi) {
    let major = parseInt(process.versions.node, 10);
    throw new Error(`This engine is based on Node ${process.versions.node}, but ${package_default.name} does not support the Node ${major}.x branch (Node-API < ${package_default.cnoke.napi})`);
  }
  let abi = determineAbi();
  let pkg2 = `${process.platform}-${process.arch}`;
  let triplets2 = [`${process.platform}_${abi}`];
  if (process.platform == "linux")
    triplets2.push(`musl_${abi}`);
  return [package_default.version, pkg2, triplets2];
}
function loadDynamic(dirname, pkg2, triplets2) {
  let suffix = "/../../build/koffi";
  let root = dirname + suffix;
  let roots = [root];
  let native2 = null;
  let err = null;
  if (process["resourcesPath"] != null) {
    let suffixes = [
      "/koffi",
      "/koffi/build",
      "/node_modules/koffi/build"
    ];
    for (let suffix2 of suffixes)
      roots.push(process["resourcesPath"] + suffix2);
  }
  let names = [
    `${import.meta.dirname}/../../../@koromix/koffi-${pkg2}`,
    ...triplets2.flatMap((triplet) => roots.map((dir) => `${dir}/${triplet}/koffi.node`))
  ];
  for (let name of names) {
    if (!fs.existsSync(name))
      continue;
    try {
      native2 = require2(name);
      break;
    } catch (e) {
      err ?? (err = e);
    }
  }
  if (native2 == null && err != null)
    throw err;
  return native2;
}
function wrapNative(native2, version2) {
  if (native2 == null)
    throw new Error("Cannot find the native Koffi module; did you bundle it correctly?");
  if (native2.version != version2)
    throw new Error("Mismatched native Koffi modules");
  let load = native2.load;
  let register = native2.register;
  let introspect = native2.introspect ?? native2.type;
  native2.sizeof = (spec) => introspect(spec).size;
  native2.alignof = (spec) => introspect(spec).alignment;
  native2.offsetof = (spec, name) => {
    let info = introspect(spec);
    if (info.primitive != "Record")
      throw new TypeError("The offsetof() function can only be used with record types");
    let member = info.members[name];
    if (member == null)
      throw new Error(`Record type ${info.name} does not have member '${name}'`);
    return member.offset;
  };
  native2.register = (...args) => {
    if (args.length >= 3 && typeof args[1] == "function") {
      process.emitWarning("Using koffi.register() with a custom this value was deprecated in Koffi 2.17, use function.bind() instead", "DeprecationWarning", "KOFFI009");
      args[1] = args[1].bind(args[0]);
      args = args.slice(1);
    }
    return register(...args);
  };
  native2.load = (...args) => {
    let lib = load(...args);
    lib.cdecl = util.deprecate((...args2) => lib.func("__cdecl", ...args2), "The koffi.cdecl() function was deprecated in Koffi 2.7, use koffi.func(...) instead", "KOFFI003");
    lib.stdcall = util.deprecate((...args2) => lib.func("__stdcall", ...args2), 'The koffi.stdcall() function was deprecated in Koffi 2.7, use koffi.func("__stdcall", ...) instead', "KOFFI004");
    lib.fastcall = util.deprecate((...args2) => lib.func("__fastcall", ...args2), 'The koffi.fastcall() function was deprecated in Koffi 2.7, use koffi.func("__fastcall", ...) instead', "KOFFI005");
    lib.thiscall = util.deprecate((...args2) => lib.func("__thiscall", ...args2), 'The koffi.thiscall() function was deprecated in Koffi 2.7, use koffi.func("__thiscall", ...) instead', "KOFFI006");
    return lib;
  };
  if (native2.introspect == null) {
    native2.resolve = util.deprecate(native2.type, "The koffi.resolve() function was deprecated in Koffi 3.0, use koffi.type() instead", "KOFFI007");
    native2.introspect = util.deprecate(native2.type, "The koffi.introspect() function was deprecated in Koffi 3.0, use koffi.type() instead", "KOFFI008");
  } else {
    native2.resolve = native2.type;
  }
}
var [version, pkg, triplets] = detectPlatform();
var native = loadStatic(pkg) ?? loadDynamic(import.meta.dirname, pkg, triplets);
wrapNative(native, version);
native.LibraryHandle;
native.TypeObject;
native.Union;
native.address;
native.alias;
native.alignof;
native.alloc;
native.array;
native.as;
native.call;
native.config;
native.decode;
native.disposable;
native.encode;
native.enumeration;
native.errno;
native.extension;
native.free;
native.in;
native.inout;
native.introspect;
native.load;
native.node;
native.offsetof;
native.opaque;
native.os;
native.out;
native.pack;
native.pointer;
native.proto;
native.register;
native.reset;
native.resolve;
native.sizeof;
native.stats;
native.struct;
native.type;
native.types;
native.union;
native.unregister;
native.version;
native.view;
var index_default = native;
const WDA_MONITOR = 1;
const WDA_EXCLUDEFROMCAPTURE = 17;
const WNDENUMPROC = index_default.proto("bool __stdcall WndEnumCallback(void*, intptr)");
function getWindowTitleSafe(hwnd) {
  const buf = Buffer.alloc(512);
  const len = GetWindowTextW(hwnd, buf, 256);
  if (len === 0) return "";
  return buf.toString("utf16le", 0, len * 2);
}
function scanWindows(blacklist = []) {
  if (process.platform !== "win32") {
    return [];
  }
  const user32 = index_default.load("user32.dll");
  const EnumWindows = user32.func("bool EnumWindows(void* lpEnumFunc, intptr lParam)");
  const GetWindowDisplayAffinity = user32.func("bool GetWindowDisplayAffinity(void* hWnd, _Out_ uint32* pdwAffinity)");
  user32.func("int GetWindowTextW(void* hWnd, _Out_ uint16* lpString, int nMaxCount)");
  const IsWindowVisible = user32.func("bool IsWindowVisible(void* hWnd)");
  const GetWindowThreadProcessId = user32.func("uint32 GetWindowThreadProcessId(void* hWnd, _Out_ uint32* lpdwProcessId)");
  const flagged = [];
  const lowerBlacklist = blacklist.map((b) => b.toLowerCase());
  const callback = index_default.register((hwnd) => {
    if (!IsWindowVisible(hwnd)) return true;
    const title = getWindowTitleSafe(hwnd);
    const pidOut = [0];
    const affinityOut = [0];
    if (GetWindowDisplayAffinity(hwnd, affinityOut)) {
      const affinity = affinityOut[0];
      if (affinity === WDA_EXCLUDEFROMCAPTURE || affinity === WDA_MONITOR) {
        GetWindowThreadProcessId(hwnd, pidOut);
        flagged.push({
          title,
          pid: pidOut[0],
          type: affinity === WDA_EXCLUDEFROMCAPTURE ? "EXCLUDE_FROM_CAPTURE" : "MONITOR_ONLY"
        });
      }
    }
    if (title) {
      const match = lowerBlacklist.find((term) => title.toLowerCase().includes(term));
      if (match) {
        GetWindowThreadProcessId(hwnd, pidOut);
        flagged.push({ title, pid: pidOut[0], type: "BLACKLISTED_NAME", matchedTerm: match });
      }
    }
    return true;
  }, index_default.pointer(WNDENUMPROC));
  EnumWindows(callback, 0);
  index_default.unregister(callback);
  return flagged;
}
createRequire(import.meta.url);
const __dirname$1 = path.dirname(fileURLToPath(import.meta.url));
process.env.APP_ROOT = path.join(__dirname$1, "..");
const VITE_DEV_SERVER_URL = process.env["VITE_DEV_SERVER_URL"];
const MAIN_DIST = path.join(process.env.APP_ROOT, "dist-electron");
const RENDERER_DIST = path.join(process.env.APP_ROOT, "dist");
process.env.VITE_PUBLIC = VITE_DEV_SERVER_URL ? path.join(process.env.APP_ROOT, "public") : RENDERER_DIST;
const BLACK_LISTED_NAMES = [
  "metop vpn mini",
  "ghostgpt"
];
function flagKey(w) {
  return `${w.pid}:${w.type}`;
}
const currentlyFlagged = /* @__PURE__ */ new Set();
let win;
let isQuittable = true;
function enterKioskMode() {
  if (!win) return;
  win.setKiosk(true);
  win.setFullScreen(true);
  win.setResizable(true);
  win.setMaximizable(true);
  win.setMinimizable(true);
  win.setClosable(true);
  win.setMenuBarVisibility(false);
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
  const registered = globalShortcut.register("Ctrl+Shift+Q", () => {
    isQuittable = true;
    app.quit();
    win == null ? void 0 : win.close();
    console.log("FIRED");
  });
  console.log("[shortcut] registered:", registered);
}
function exitKioskMode() {
  if (!win) return;
  win.setKiosk(false);
  win.setFullScreen(false);
  win.setMaximizable(true);
  win.setClosable(true);
  win.setMinimizable(true);
  globalShortcut.unregisterAll();
}
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
  win.webContents.on("did-finish-load", () => {
    win == null ? void 0 : win.webContents.send("main-process-message", (/* @__PURE__ */ new Date()).toLocaleString());
  });
  setInterval(() => {
    const flagged = scanWindows(BLACK_LISTED_NAMES);
    const flaggedKeys = new Set(flagged.map(flagKey));
    const newlyFlagged = flagged.filter((w) => !currentlyFlagged.has(flagKey(w)));
    console.log("[scan] found:", flagged.length, "| already tracked:", currentlyFlagged.size, "| new:", newlyFlagged.length);
    for (const key of currentlyFlagged) {
      if (!flaggedKeys.has(key)) currentlyFlagged.delete(key);
    }
    flaggedKeys.forEach((key) => currentlyFlagged.add(key));
    if (newlyFlagged.length > 0) {
      console.log("[main] sending window-scan:", newlyFlagged.length);
      win == null ? void 0 : win.webContents.send("window-scan", newlyFlagged);
    }
    win == null ? void 0 : win.webContents.send("window-scan-status", { activeCount: flagged.length });
  }, 3e3);
  if (VITE_DEV_SERVER_URL) {
    win.loadURL(VITE_DEV_SERVER_URL);
  } else {
    win.loadFile(path.join(RENDERER_DIST, "index.html"));
  }
  win.on("leave-full-screen", () => win == null ? void 0 : win.setFullScreen(true));
  win == null ? void 0 : win.on("blur", () => win.focus());
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
  session.defaultSession.setDisplayMediaRequestHandler(async (request, callback) => {
    const sources = await desktopCapturer.getSources({ types: ["screen"] });
    callback({ video: sources[0], audio: "loopback" });
  });
  createWindow();
  win.on("close", (e) => {
    if (isQuittable) return;
    e.preventDefault();
    win.show();
    win.focus();
  });
});
app.on("before-quit", () => {
  isQuittable = true;
});
ipcMain.on("session-start", () => {
  currentlyFlagged.clear();
});
ipcMain.on("enter-kiosk", () => {
  enterKioskMode();
});
ipcMain.on("exit-kiosk", () => {
  exitKioskMode();
});
export {
  MAIN_DIST,
  RENDERER_DIST,
  VITE_DEV_SERVER_URL
};
