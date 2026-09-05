// ─────────────────────────────────────────
// 구종 정의 (text = 공에 표시할 약자)
// dir는 게임 시작·해금 시 랜덤 배정
// ─────────────────────────────────────────
export const PITCHES = {
  fastball:  { id: 'fastball',  label: 'Fastball',  text: '4',  color: '#f59e0b', border: '#d97706' },
  slider:    { id: 'slider',    label: 'Slider',    text: 'S',  color: '#3b82f6', border: '#2563eb' },
  changeup:  { id: 'changeup',  label: 'Changeup',  text: 'C',  color: '#22c55e', border: '#16a34a' },
  forkball:  { id: 'forkball',  label: 'Forkball',  text: 'F',  color: '#a855f7', border: '#9333ea' },
  curve:     { id: 'curve',     label: 'Curve',     text: 'C',  color: '#ef4444', border: '#dc2626' },
  twoseam:   { id: 'twoseam',   label: '2-Seam',    text: '2',  color: '#06b6d4', border: '#0891b2' },
  fourseam:  { id: 'fourseam',  label: '4-Seam',    text: '4',  color: '#f97316', border: '#ea580c' },
  splitter:  { id: 'splitter',  label: 'Splitter',  text: 'S',  color: '#ec4899', border: '#db2777' },
  sinker:    { id: 'sinker',    label: 'Sinker',    text: 'S',  color: '#84cc16', border: '#65a30d' },
  knuckle:   { id: 'knuckle',   label: 'Knuckle',   text: 'N',  color: '#6366f1', border: '#4f46e5' },
  sweeper:   { id: 'sweeper',   label: 'Sweeper',   text: 'SW', color: '#14b8a6', border: '#0d9488' },
}

// 공 이미지 적용 구종 (8구종 중 마지막 2개 제외 → 6개)
export const IMAGE_PITCH_IDS = [
  'fastball', 'slider', 'changeup', 'forkball', 'curve', 'twoseam',
]

export const COLOR_BALL_FILES = ['blue', 'green', 'purple', 'red', 'nurcle']

export const createPitchBallImages = () => {
  const shuffled = [...COLOR_BALL_FILES].sort(() => Math.random() - 0.5)
  const images = {
    fastball: '/assets/balls/white.png',
    fourseam: '/assets/balls/white.png',
  }
  IMAGE_PITCH_IDS.slice(1).forEach((id, i) => {
    images[id] = `/assets/balls/${shuffled[i]}.png`
  })
  return images
}

export const getPitchBallImage = (pitchId, pitchBallImages) =>
  pitchBallImages[pitchId] ?? null

// 콤보 N마다 2구종씩 해금 (개발용: 20콤보)
export const COMBO_UNLOCK_INTERVAL = 20
export const MAX_PITCH_TIER = 4

// 티어별 해금 구종 (2개씩)
export const PITCH_UNLOCK_TIERS = [
  ['fastball', 'slider'],
  ['changeup', 'forkball'],
  ['curve', 'twoseam'],
  ['splitter', 'sinker'],
  ['knuckle', 'sweeper'],
]

// 티어 2(40콤보)부터 직구 → 포심 교체
export const FASTBALL_REPLACED_AT_TIER = 2
export const FASTBALL_REPLACEMENT = 'fourseam'

// 티어당 2구종을 좌/우에 하나씩 배치 (어느 구종이 어느 쪽인지는 랜덤)
export const assignPairDirs = (dirs, idA, idB) => {
  const aNew = !dirs[idA]
  const bNew = !dirs[idB]
  if (aNew && bNew) {
    const aLeft = Math.random() < 0.5
    dirs[idA] = aLeft ? 'left' : 'right'
    dirs[idB] = aLeft ? 'right' : 'left'
  } else if (aNew) {
    dirs[idA] = dirs[idB] === 'left' ? 'right' : 'left'
  } else if (bNew) {
    dirs[idB] = dirs[idA] === 'left' ? 'right' : 'left'
  }
}

export const getPitchDir = (pitchId, pitchDirs) => pitchDirs[pitchId]

export const getPitchTierFromCombo = (combo) =>
  Math.min(Math.floor(combo / COMBO_UNLOCK_INTERVAL), MAX_PITCH_TIER)

export const getUnlockedPitchIds = (tier) => {
  const ids = []
  for (let i = 0; i <= tier; i++) {
    ids.push(...PITCH_UNLOCK_TIERS[i])
  }
  if (tier >= FASTBALL_REPLACED_AT_TIER) {
    const idx = ids.indexOf('fastball')
    if (idx !== -1) ids[idx] = FASTBALL_REPLACEMENT
  }
  return ids
}

export const assignDirsForTier = (tier, existingDirs = {}) => {
  const dirs = { ...existingDirs }
  for (let i = 0; i <= tier; i++) {
    const [idA, idB] = PITCH_UNLOCK_TIERS[i]
    assignPairDirs(dirs, idA, idB)
  }
  if (tier >= FASTBALL_REPLACED_AT_TIER && !dirs[FASTBALL_REPLACEMENT]) {
    dirs[FASTBALL_REPLACEMENT] = dirs.fastball ?? 'left'
  }
  return dirs
}

export const getActivePitches = (tier, pitchDirs) =>
  getUnlockedPitchIds(tier).map((id) => ({
    ...PITCHES[id],
    dir: getPitchDir(id, pitchDirs),
  }))

export const toPitchBall = (id, pitchDirs) => ({
  ...PITCHES[id],
  dir: getPitchDir(id, pitchDirs),
})

// 레인에 표시될 공 대기열 길이
export const QUEUE_SIZE = 8

// 타이머 초기값 (초)
export const TIMER_MAX = 3

// 콤보 점수 공식: 100 + floor(100 * log2(combo+1))
export const calcScore = (combo) => 100 + Math.floor(100 * Math.log2(combo + 1))

// 피버 발동 콤보 간격
export const FEVER_COMBO_INTERVAL = 10

// 피버 지속시간 (초)
export const FEVER_DURATION = 4

// Grade labels
export const GRADES = [
  { minAcc: 90, label: 'S — Elite eye!' },
  { minAcc: 75, label: 'A — Starting lineup!' },
  { minAcc: 55, label: 'B — Needs practice' },
  { minAcc: 0,  label: 'C — Strikeout king...' },
]
