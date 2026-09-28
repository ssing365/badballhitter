import { Device } from '@apps-in-toss/web-framework'

// 햅틱 — 토스 앱에서만 동작, 토스 밖(웹 배포)에서는 SDK가 throw하므로 no-op
// 진동 on/off는 사운드 음소거(bgmMuted)와 같은 방식으로 localStorage에 저장

const HAPTIC_OFF_KEY = 'hapticOff'
const MIN_INTERVAL_MS = 50  // 피버 연타처럼 몰릴 때 진동이 뭉개지지 않게 최소 간격

// 토스 앱 웹뷰 안인지 (토글 버튼 노출 여부 판단용) — SDK의 웹뷰 환경 검사와 같은 조건
const detectSupported = () => typeof window !== 'undefined' && window.ReactNativeWebView != null

const loadOff = () => {
  try {
    return localStorage.getItem(HAPTIC_OFF_KEY) === '1'
  } catch {
    return false
  }
}

let off = loadOff()
let lastAt = 0

export const isHapticSupported = detectSupported

export const isHapticOn = () => !off

export const setHapticOn = (on) => {
  off = !on
  try {
    localStorage.setItem(HAPTIC_OFF_KEY, off ? '1' : '0')
  } catch {
    // storage 차단 환경에서는 저장만 생략
  }
}

// type: 'tickWeak' | 'tap' | 'success' | 'error' 등 (HapticFeedbackType)
export const haptic = (type) => {
  if (off || !detectSupported()) return
  const now = performance.now()
  if (now - lastAt < MIN_INTERVAL_MS) return
  lastAt = now
  try {
    Device.triggerHaptic({ type }).catch(() => {})
  } catch {
    // 미지원 버전 등은 무시
  }
}
