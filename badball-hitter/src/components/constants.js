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

// 피버 중엔 같은 색의 금테 공 (balls/fever_<name>.png)
export const toFeverBallImage = (src) => src?.replace(/\/balls\/(\w+)\.png$/, '/balls/fever_$1.png') ?? null

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

// 피버 차지 — 정타(파울 포함) 1회당 1씩 참, MAX 도달 시 피버 (아웃 시 절반, 피버 종료 시 0)
export const FEVER_CHARGE_MAX = 40

// 수박 차지 — 파울 제외 정타 1회당 1씩 참, MAX 도달 시 다음 공 WATERMELON_MIN~MAX개가 수박 (아웃 시 0)
export const CYCLE_CHARGE_MAX = 15
export const WATERMELON_MIN = 15
export const WATERMELON_MAX = 20
export const WATERMELON_POINTS = 100
export const WATERMELON_IMAGE = '/assets/balls/watermelon.png'
// 수박 파편 스프라이트 시트 — scripts/cut-melon-shards.py가 깨진 수박 그림에서 잘라 만듦 (조각 위치는 그 출력값)
export const MELON_SHARDS_IMAGE = '/assets/balls/melon_shards.png'
export const MELON_SHARDS_SIZE = [370, 40]
export const MELON_SHARDS = [
  { x: 0, y: 0, w: 39, h: 40, big: true },
  { x: 41, y: 0, w: 36, h: 36, big: true },
  { x: 79, y: 0, w: 29, h: 34, big: true },
  { x: 110, y: 0, w: 29, h: 29, big: true },
  { x: 141, y: 0, w: 28, h: 26, big: true },
  { x: 171, y: 0, w: 19, h: 31, big: true },
  { x: 192, y: 0, w: 23, h: 27, big: true },
  { x: 217, y: 0, w: 20, h: 21, big: false },
  { x: 239, y: 0, w: 16, h: 18, big: false },
  { x: 257, y: 0, w: 15, h: 16, big: false },
  { x: 274, y: 0, w: 16, h: 16, big: false },
  { x: 292, y: 0, w: 15, h: 15, big: false },
  { x: 309, y: 0, w: 14, h: 14, big: false },
  { x: 325, y: 0, w: 14, h: 14, big: false },
  { x: 341, y: 0, w: 13, h: 14, big: false },
  { x: 356, y: 0, w: 14, h: 13, big: false },
]
// 마지막 정타 후 이 시간이 지나면 차지가 서서히 줄어듦 (초당 DECAY_PER_SEC hit)
export const FEVER_CHARGE_DECAY_DELAY_MS = 1000
export const FEVER_CHARGE_DECAY_PER_SEC = 2

// 구종 해금과 같은 hit에 차지가 가득 차면 되돌리는 양 (새 구종을 먼저 보여주기 위해 피버를 미룸)
export const FEVER_UNLOCK_DELAY = 2

// 피버 지속시간 (초) — 준비 시간 뒤 이 안에 꾹 눌렀다 떼서 파워 스윙 한 번 (시간이 다 되면 그 시점 파워로 자동 스윙)
export const FEVER_DURATION = 4

// 파워 스윙 — 누르는 순간 POWER_MIN, 누른 시간만큼 선형으로 차서 POWER_FULL_MS에 가득(가득 차면 바로 스윙)
// 준비 끝나자마자 눌러도 0.3초 여유를 두고 가득 차도록 피버 시간보다 살짝 짧게
export const POWER_FULL_MS = FEVER_DURATION * 1000 - 300
export const POWER_MIN = 0.2
export const POWER_BALLS_MAX = 20
export const POWER_BALL_INTERVAL_MS = 40
// 이보다 짧게 누르고 떼면 스윙 없이 충전 취소 (피버 내내 — 연타하던 손이 실수로 스윙하지 않게)
export const POWER_TAP_IGNORE_MS = 300
// 짧게 누르고 뗐을 때 파워 버튼에 "더 길게 꾹!"을 보여주는 시간
export const SHORT_TAP_HINT_MS = 900
// 피버 시작 후 입력을 무시하는 준비 시간 — 연타하던 손이 바로 스윙해버리지 않게 (충전 시간 4초와 별도)
export const FEVER_READY_MS = 800
// 파워 스윙 후 투수가 숨 고르는 시간, 이후 공을 하나씩 다시 던져 대기열을 채우는 간격
export const PITCHER_REST_MS = 100
export const QUEUE_REFILL_INTERVAL_MS = 60
// 파워(POWER_MIN~1)에 비례해 날아가는 공 수 — 20%=4개 ~ 100%=20개
export const powerBallCount = (power) => Math.round(POWER_BALLS_MAX * Math.max(POWER_MIN, power))

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
export const POWER_BALL_POINTS = 300
export const COMBO_BONUS_PER = 100

// 타율 표기 (.875 / 1.000)
export const formatAvg = (correct, classified) =>
  classified > 0 ? (correct / classified).toFixed(3).replace(/^0/, '') : '.000'

// 결과 스탯표 행 + 최종 점수 (행 점수 합 = 최종 점수)
export const calcFinalBreakdown = ({ score, correct, classified, maxCombo, powerBalls = 0, homeRuns = 0, homeRunPts = 0 }) => {
  const feverPts = powerBalls * POWER_BALL_POINTS
  const rows = [
    {
      id: 'hits', label: 'Hits', value: String(correct),
      avg: formatAvg(correct, classified), pts: score - feverPts - homeRunPts,  // 수박 점수도 Hits에 포함
    },
    { id: 'homerun', label: 'Home Run',  value: String(homeRuns), pts: homeRunPts },
    { id: 'fever', label: 'Power Swing', value: String(powerBalls), pts: feverPts },
    { id: 'combo', label: 'Max Combo',  value: String(maxCombo), pts: maxCombo * COMBO_BONUS_PER },
  ]
  const finalScore = rows.reduce((sum, r) => sum + r.pts, 0)
  return { rows, finalScore }
}
