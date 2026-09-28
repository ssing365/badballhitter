// ─────────────────────────────────────────
// 구종 정의 (text = 공에 표시할 약자)
// dir는 게임 시작·해금 시 랜덤 배정
// ─────────────────────────────────────────
export const PITCHES = {
  fastball:  { id: 'fastball',  label: '직구',     text: '직', color: '#f59e0b', border: '#d97706' },
  slider:    { id: 'slider',    label: '슬라이더', text: '슬', color: '#3b82f6', border: '#2563eb' },
  changeup:  { id: 'changeup',  label: '체인지업', text: '체', color: '#22c55e', border: '#16a34a' },
  forkball:  { id: 'forkball',  label: '포크볼',   text: '포', color: '#a855f7', border: '#9333ea' },
  curve:     { id: 'curve',     label: '커브',     text: '커', color: '#ef4444', border: '#dc2626' },
  sweeper:   { id: 'sweeper',   label: '스위퍼',   text: '스', color: '#14b8a6', border: '#0d9488' },
}

// 공 이미지 적용 구종 (전 구종)
export const IMAGE_PITCH_IDS = [
  'fastball', 'slider', 'changeup', 'forkball', 'curve', 'sweeper',
]

export const COLOR_BALL_FILES = ['blue', 'green', 'purple', 'red', 'nurcle']

export const createPitchBallImages = () => {
  const shuffled = [...COLOR_BALL_FILES].sort(() => Math.random() - 0.5)
  const images = {
    fastball: '/assets/balls/white.png',
    }
  IMAGE_PITCH_IDS.slice(1).forEach((id, i) => {
    images[id] = `/assets/balls/${shuffled[i]}.png`
  })
  return images
}

export const getPitchBallImage = (pitchId, pitchBallImages) =>
  pitchBallImages[pitchId] ?? null

// 시작 구종 2개 — 좌/우 하나씩 랜덤 배치
export const BASE_PITCHES = ['fastball', 'slider']

// 이후 1구종씩 해금 — 현재 콤보 AND 누적 점수 조건 (순서대로만 해금)
export const PITCH_UNLOCKS = [
  { id: 'changeup', combo: 20, score: 0 },
  { id: 'forkball', combo: 10, score: 30000 },
  { id: 'curve',    combo: 15, score: 50000 },
  { id: 'sweeper',  combo: 20, score: 80000 },
]
export const PITCH_UNLOCK_ORDER = PITCH_UNLOCKS.map((u) => u.id)

// 두 구종을 좌/우에 하나씩 배치 (어느 구종이 어느 쪽인지는 랜덤)
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

const isUnlockReached = (unlock, combo, score) =>
  combo >= unlock.combo && score >= unlock.score

// 현재 단계에서 이어서 조건을 만족한 만큼 해금 단계 증가 (0 = 시작 구종만)
export const getUnlockStep = (curStep, combo, score) => {
  let step = curStep
  while (step < PITCH_UNLOCKS.length && isUnlockReached(PITCH_UNLOCKS[step], combo, score)) {
    step++
  }
  return step
}

export const getUnlockedPitchIds = (step) => [...BASE_PITCHES, ...PITCH_UNLOCK_ORDER.slice(0, step)]

// 새 구종은 개수가 적은 쪽에 배치, 동률이면 왼쪽
export const assignDirsForStep = (step, existingDirs = {}) => {
  const dirs = { ...existingDirs }
  assignPairDirs(dirs, ...BASE_PITCHES)
  const placed = [...BASE_PITCHES]
  PITCH_UNLOCK_ORDER.slice(0, step).forEach((id) => {
    if (!dirs[id]) {
      const leftCount = placed.filter((p) => dirs[p] === 'left').length
      dirs[id] = leftCount <= placed.length - leftCount ? 'left' : 'right'
    }
    placed.push(id)
  })
  return dirs
}

export const getActivePitches = (step, pitchDirs) =>
  getUnlockedPitchIds(step).map((id) => ({
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

// 타격 등급 — 공 준비 후 정타까지 걸린 시간(ms)으로 판정, 점수 = calcScore × mult
// 타이머 3초 기준: 0.3초 이내 홈런 / 2.1초 이상 남기면 2루타 / 0.7초 초과 남기면 안타 / 마지막 0.7초는 파울(콤보 유지)
export const HIT_GRADES = [
  { id: 'homerun', label: 'HOME RUN!', maxMs: 300,      mult: 2 },
  { id: 'double',  label: 'DOUBLE!',   maxMs: 900,      mult: 1.2 },
  { id: 'single',  label: 'SINGLE!',   maxMs: 2300,     mult: 1 },
  { id: 'foul',    label: 'FOUL',      maxMs: Infinity, mult: 0.7 },
]
export const getHitGrade = (reactionMs) => HIT_GRADES.find((g) => reactionMs <= g.maxMs)

// 피버 차지 — 정타 1회당 1씩 참, MAX 도달 시 피버 (아웃·피버 종료 시 0)
export const FEVER_CHARGE_MAX = 15
// 마지막 정타 후 이 시간이 지나면 차지가 서서히 줄어듦 (초당 DECAY_PER_SEC hit)
export const FEVER_CHARGE_DECAY_DELAY_MS = 1000
export const FEVER_CHARGE_DECAY_PER_SEC = 2

// 구종 해금과 같은 hit에 차지가 가득 차면 되돌리는 양 (새 구종을 먼저 보여주기 위해 피버를 미룸)
export const FEVER_UNLOCK_DELAY = 2

// 피버 지속시간 (초)
export const FEVER_DURATION = 4

// 게임 종료 시 해금 단계(표시 구종 수) 기준 등급
export const GRADES = [
  { step: 4, grade: 'SSS', title: 'Hall of Famer',   color: '#facc15' }, // 공 6개
  { step: 3, grade: 'S',   title: 'All-Star',        color: '#fb923c' }, // 5개
  { step: 2, grade: 'A',   title: 'Starting Lineup', color: '#4ade80' }, // 4개
  { step: 1, grade: 'B',   title: 'Bench Warmer',    color: '#60a5fa' }, // 3개
  { step: 0, grade: 'C',   title: 'Minor Leaguer',   color: '#94a3b8' }, // 2개
]
export const getGrade = (unlockStep) => GRADES.find((g) => unlockStep >= g.step)

// ─────────────────────────────────────────
// 결과 화면 보너스
// ─────────────────────────────────────────
export const FEVER_TAP_POINTS = 100
export const COMBO_BONUS_PER = 100

// 타율 표기 (.875 / 1.000)
export const formatAvg = (correct, classified) =>
  classified > 0 ? (correct / classified).toFixed(3).replace(/^0/, '') : '.000'

// 결과 스탯표 행 + 최종 점수 (행 점수 합 = 최종 점수)
export const calcFinalBreakdown = ({ score, correct, classified, maxCombo, feverTaps, homeRuns = 0, homeRunPts = 0 }) => {
  const feverPts = feverTaps * FEVER_TAP_POINTS
  const rows = [
    {
      id: 'hits', label: 'Hits', value: String(correct),
      avg: formatAvg(correct, classified), pts: score - feverPts - homeRunPts,
    },
    { id: 'homerun', label: 'Home Run',  value: String(homeRuns), pts: homeRunPts },
    { id: 'fever', label: 'Fever Taps', value: String(feverTaps), pts: feverPts },
    { id: 'combo', label: 'Max Combo',  value: String(maxCombo), pts: maxCombo * COMBO_BONUS_PER },
  ]
  const finalScore = rows.reduce((sum, r) => sum + r.pts, 0)
  return { rows, finalScore }
}
