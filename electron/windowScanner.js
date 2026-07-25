// electron/windowScanner.js
const koffi = require('koffi')

const user32 = koffi.load('user32.dll')

const EnumWindows = user32.func('bool EnumWindows(void* lpEnumFunc, intptr lParam)')
const GetWindowDisplayAffinity = user32.func('bool GetWindowDisplayAffinity(void* hWnd, _Out_ uint32* pdwAffinity)')
const GetWindowTextW = user32.func('int GetWindowTextW(void* hWnd, _Out_ uint16* lpString, int nMaxCount)')
const GetWindowTextLengthW = user32.func('int GetWindowTextLengthW(void* hWnd)')
const IsWindowVisible = user32.func('bool IsWindowVisible(void* hWnd)')
const GetWindowThreadProcessId = user32.func('uint32 GetWindowThreadProcessId(void* hWnd, _Out_ uint32* lpdwProcessId)')

// Windows constants — see WINDOWS-DISPLAY-AFFINITY docs
const WDA_NONE = 0x0
const WDA_MONITOR = 0x1
const WDA_EXCLUDEFROMCAPTURE = 0x11 // the one GhostGPT-style overlays set

function getWindowTitle(hwnd) {
  const len = GetWindowTextLengthW(hwnd)
  if (len === 0) return ''
  const buf = Buffer.alloc((len + 1) * 2)
  GetWindowTextW(hwnd, buf, len + 1)
  return koffi.decode(buf, 'uint16_t', len) // fallback below is more reliable
}

// koffi's string handling for wide chars is easiest via a helper type;
// simpler alternative: use the 'str16' koffi type directly
const GetWindowTextW16 = user32.func('int GetWindowTextW(void* hWnd, _Out_ str16 lpString, int nMaxCount)')

function getWindowTitleSafe(hwnd) {
  const buf = Buffer.alloc(512)
  const len = GetWindowTextW(hwnd, buf, 256)
  if (len === 0) return ''
  return buf.toString('utf16le', 0, len * 2)
}

function scanForHiddenWindows() {
  const flagged = []

  const enumCallback = koffi.register((hwnd) => {
    if (!IsWindowVisible(hwnd)) return true // continue enumeration

    const affinityOut = [0]
    const ok = GetWindowDisplayAffinity(hwnd, affinityOut)
    if (!ok) return true

    const affinity = affinityOut[0]
    if (affinity === WDA_EXCLUDEFROMCAPTURE || affinity === WDA_MONITOR) {
      const pidOut = [0]
      GetWindowThreadProcessId(hwnd, pidOut)
      flagged.push({
        title: getWindowTitleSafe(hwnd),
        pid: pidOut[0],
        affinity: affinity === WDA_EXCLUDEFROMCAPTURE ? 'EXCLUDE_FROM_CAPTURE' : 'MONITOR_ONLY',
      })
    }
    return true // return true to keep enumerating, false to stop
  }, koffi.pointer('WNDENUMPROC', koffi.proto('bool __stdcall(void*, intptr)')))

  EnumWindows(enumCallback, 0)
  koffi.unregister(enumCallback)

  return flagged
}

module.exports = { scanForHiddenWindows, WDA_EXCLUDEFROMCAPTURE }
