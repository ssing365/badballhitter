import { Storage, getUserKeyForGame } from '@apps-in-toss/web-framework'

// 최고 기록 저장소 — 토스 앱에서는 SDK Storage, 일반 브라우저(웹 배포)에서는 SDK가 throw하므로 localStorage
// Storage가 비동기라 앱 시작 시 한 번 읽어 캐시해두고, 화면에서는 동기로 조회
// 토스에서는 게임 사용자 식별키(getUserKeyForGame hash)를 키 앞에 붙여 토스 계정별로 저장 (게임 출시 체크리스트)

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
let keyPrefix = ''

// 식별키 응답이 늦어도 Play 버튼이 계속 잠기지 않게
const USER_KEY_TIMEOUT_MS = 3000

// 토스 계정별 키 접두사 — 식별키를 못 받으면(토스 밖·구버전·오류·시간 초과) 접두사 없이 저장
const loadKeyPrefix = async () => {
  try {
    const timeout = new Promise((resolve) => setTimeout(resolve, USER_KEY_TIMEOUT_MS))
    const result = await Promise.race([getUserKeyForGame(), timeout])
    if (result && typeof result === 'object' && result.type === 'HASH') return `${result.hash}:`
  } catch {
    // 토스 밖(웹 배포)에서는 SDK가 throw
  }
  return ''
}

const readBest = (prefix) => Promise.all([
  readItem(prefix + BEST_SCORE_KEY),
  readItem(prefix + BEST_UNLOCK_STEP_KEY),
])

export const loadBestRecord = async () => {
  keyPrefix = await loadKeyPrefix()
  let [score, unlockStep] = await readBest(keyPrefix)
  // 식별키 도입 전에 접두사 없이 저장한 기록 — 이 계정 키로 옮겨 이어서 사용
  if (score == null && keyPrefix) {
    ;[score, unlockStep] = await readBest('')
    if (score != null) {
      writeItem(keyPrefix + BEST_SCORE_KEY, score)
      if (unlockStep != null) writeItem(keyPrefix + BEST_UNLOCK_STEP_KEY, unlockStep)
    }
  }
  best = { score: toNumber(score), unlockStep: toNumber(unlockStep) }
}

// { score, unlockStep } — 기록 없으면 score null, 등급 저장 이전 기록이면 unlockStep null
export const getBestRecord = () => best

export const saveBestRecord = (score, unlockStep) => {
  best = { score, unlockStep }
  return Promise.all([
    writeItem(keyPrefix + BEST_SCORE_KEY, String(score)),
    writeItem(keyPrefix + BEST_UNLOCK_STEP_KEY, String(unlockStep)),
  ])
}
