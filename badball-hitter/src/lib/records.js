import { Storage } from '@apps-in-toss/web-framework'

// 최고 기록 저장소 — 토스 앱에서는 SDK Storage, 일반 브라우저(웹 배포)에서는 SDK가 throw하므로 localStorage
// Storage가 비동기라 앱 시작 시 한 번 읽어 캐시해두고, 화면에서는 동기로 조회

const BEST_SCORE_KEY = 'bestScore'
// 최고 기록을 세운 판의 해금 단계 — 등급은 여기서 계산 (등급 정의가 바뀌어도 안전)
const BEST_UNLOCK_STEP_KEY = 'bestUnlockStep'

const readItem = async (key) => {
  try {
    return await Storage.getItem(key)
  } catch {
    try {
      return localStorage.getItem(key)
    } catch {
      return null
    }
  }
}

const writeItem = async (key, value) => {
  try {
    await Storage.setItem(key, value)
  } catch {
    try {
      localStorage.setItem(key, value)
    } catch {
      // 저장 실패는 무시 (프라이빗 모드 등)
    }
  }
}

// 저장된 숫자 파싱 (없거나 숫자가 아니면 null)
const toNumber = (raw) => {
  if (raw == null) return null
  const n = Number(raw)
  return Number.isFinite(n) ? n : null
}

let best = { score: null, unlockStep: null }

export const loadBestRecord = async () => {
  const [score, unlockStep] = await Promise.all([
    readItem(BEST_SCORE_KEY),
    readItem(BEST_UNLOCK_STEP_KEY),
  ])
  best = { score: toNumber(score), unlockStep: toNumber(unlockStep) }
}

// { score, unlockStep } — 기록 없으면 score null, 등급 저장 이전 기록이면 unlockStep null
export const getBestRecord = () => best

export const saveBestRecord = (score, unlockStep) => {
  best = { score, unlockStep }
  return Promise.all([
    writeItem(BEST_SCORE_KEY, String(score)),
    writeItem(BEST_UNLOCK_STEP_KEY, String(unlockStep)),
  ])
}
