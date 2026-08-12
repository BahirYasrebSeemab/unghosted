// src/windowScanner.ts
import koffi, { KoffiFunc } from 'koffi';
import { processes } from 'systeminformation';

const WDA_MONITOR = 0x1
const WDA_EXCLUDEFROMCAPTURE = 0x11 // the one GhostGPT-style overlays set

type HWND = unknown

const WNDENUMPROC = koffi.proto('bool __stdcall WndEnumCallback(void*, intptr)')

function getWindowTitleSafe(hwnd: HWND): string {
  const buf = Buffer.alloc(512)
  const len = GetWindowTextW(hwnd, buf, 256) as number
  if (len === 0) return ''
  return buf.toString('utf16le', 0, len * 2)
}

export type WindowFlagType = 'EXCLUDE_FROM_CAPTURE' | 'MONITOR_ONLY' | 'BLACKLISTED_NAME'

export interface FlaggedWindow {
  title: string
  pid: number
  type: WindowFlagType
  matchedTerm?: string
}

export function scanWindows(blacklist: string[] = []): FlaggedWindow[] {
  if (process.platform !== 'win32') {
    return []
  }

  const user32 = koffi.load('user32.dll')

  const EnumWindows = user32.func('bool EnumWindows(void* lpEnumFunc, intptr lParam)')
  const GetWindowDisplayAffinity = user32.func('bool GetWindowDisplayAffinity(void* hWnd, _Out_ uint32* pdwAffinity)')
  const GetWindowTextW = user32.func('int GetWindowTextW(void* hWnd, _Out_ uint16* lpString, int nMaxCount)')
  const IsWindowVisible = user32.func('bool IsWindowVisible(void* hWnd)')
  const GetWindowThreadProcessId = user32.func('uint32 GetWindowThreadProcessId(void* hWnd, _Out_ uint32* lpdwProcessId)')


  const flagged: FlaggedWindow[] = []
  const lowerBlacklist = blacklist.map((b) => b.toLowerCase())

  const callback = koffi.register((hwnd: HWND): boolean => {
    if (!(IsWindowVisible(hwnd) as boolean)) return true

    const title = getWindowTitleSafe(hwnd, GetWindowTextW)
    const pidOut = [0]

    const affinityOut = [0]
    if (GetWindowDisplayAffinity(hwnd, affinityOut) as boolean) {
      const affinity = affinityOut[0]
      if (affinity === WDA_EXCLUDEFROMCAPTURE || affinity === WDA_MONITOR) {
        GetWindowThreadProcessId(hwnd, pidOut)
        flagged.push({
          title,
          pid: pidOut[0]!,
          type: affinity === WDA_EXCLUDEFROMCAPTURE ? 'EXCLUDE_FROM_CAPTURE' : 'MONITOR_ONLY',
        })
      }
    }

    if (title) {
      const match = lowerBlacklist.find((term) => title.toLowerCase().includes(term))
      if (match) {
        GetWindowThreadProcessId(hwnd, pidOut)
        flagged.push({ title, pid: pidOut[0]!, type: 'BLACKLISTED_NAME', matchedTerm: match })
      }
    }

    return true
  }, koffi.pointer(WNDENUMPROC))

  EnumWindows(callback, 0)
  koffi.unregister(callback)

  return flagged
}

export { WDA_EXCLUDEFROMCAPTURE }
