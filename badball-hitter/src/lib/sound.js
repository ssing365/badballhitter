import { Howl, Howler } from 'howler'

const BGM_VOLUME = 0.35
const BGM_DUCK_RATIO = 0.35    // 피버·결과 화면 연출 중 BGM 볼륨 배율
const BGM_DUCK_FADE_MS = 400   // 줄어들 때
const BGM_UNDUCK_FADE_MS = 1200 // 원래대로 돌아올 때 (천천히 fade in)
const BGM_MUTED_KEY = 'bgmMuted'

// 재방문 시 BGM on/off 상태 복원 (storage 접근 실패 시 on)
const loadMuted = () => {
  try {
    return localStorage.getItem(BGM_MUTED_KEY) === '1'
  } catch {
    return false
  }
}

let muted = loadMuted()
Howler.mute(muted)

const tracks = {
  normal: new Howl({
    src: [encodeURI('/sounds/Pinball Spring.mp3')],
    loop: true,
    volume: BGM_VOLUME,
    preload: true,
    html5: true,
  }),
  fast: new Howl({
    src: [encodeURI('/sounds/Pinball Spring 160.mp3')],
    loop: true,
    volume: BGM_VOLUME,
    preload: true,
    html5: true,
  }),
}

export const isMuted = () => muted

// BGM·효과음 전체 음소거 (Howler 전역) — 트랙은 계속 재생하고 음소거만 토글
export const setMuted = (next) => {
  muted = next
  Howler.mute(muted)
  try {
    localStorage.setItem(BGM_MUTED_KEY, muted ? '1' : '0')
  } catch {
    // storage 차단 환경에서는 저장만 생략
  }
}

let currentType = null
let ducked = false

// 현재 목표 BGM 볼륨 — 새 트랙 시작·정지 후 복구도 이 값 기준
const bgmVolume = () => (ducked ? BGM_VOLUME * BGM_DUCK_RATIO : BGM_VOLUME)

const GESTURE_EVENTS = ['click', 'keydown', 'touchend']
let waitingGesture = false

// 자동재생 차단(첫 접속 타이틀) 시 html5 audio는 play()가 id를 반환하고 비동기로 playerror만 발생
// → 첫 사용자 입력 때 그 시점의 현재 트랙을 재생
// bubble 단계라 React 클릭 핸들러(playBgm('fast') 등)가 먼저 실행되고, 이미 재생 중이면 건너뜀
const retryOnGesture = () => {
  if (waitingGesture) return
  waitingGesture = true

  const onGesture = () => {
    GESTURE_EVENTS.forEach((ev) => window.removeEventListener(ev, onGesture))
    waitingGesture = false
    const track = currentType && tracks[currentType]
    if (!track || track.playing()) return
    track.off('playerror')
    track.once('playerror', retryOnGesture)
    track.play()
  }

  GESTURE_EVENTS.forEach((ev) => window.addEventListener(ev, onGesture))
}

const stopTrack = (howl) => {
  howl.off('fade')
  howl.stop()
  howl.volume(bgmVolume())
}

export const playBgm = (type) => {
  const nextType = type === 'fast' ? 'fast' : 'normal'
  const next = tracks[nextType]

  if (currentType === nextType && next.playing()) {
    next.volume(bgmVolume())
    return
  }

  // 다른 트랙은 즉시 정지 (fade 레이스로 새 트랙이 같이 멈추는 문제 방지)
  Object.entries(tracks).forEach(([key, howl]) => {
    if (key !== nextType) stopTrack(howl)
  })

  currentType = nextType
  stopTrack(next)

  const start = () => {
    if (currentType !== nextType) return
    next.volume(bgmVolume())
    next.off('playerror') // 이전 play의 미발생 리스너 정리
    next.once('playerror', retryOnGesture)
    next.play()
  }

  if (next.state() === 'loaded') {
    start()
  } else {
    next.once('load', start)
    next.load()
  }
}

export const stopBgm = () => {
  Object.values(tracks).forEach(stopTrack)
  currentType = null
}

// ── 효과음 ──
const HIT_SFX_VOLUME = 0.7

// Web Audio(기본값)로 재생 — html5 audio보다 지연이 짧고 연타 시 겹쳐 재생 가능
const hitSounds = [1, 2, 3].map((n) => new Howl({
  src: [`/sounds/effects/bat-hit-0${n}.wav`],
  volume: HIT_SFX_VOLUME,
  preload: true,
}))

// 정타 시 배트 타격음 3종 중 하나를 랜덤 재생
export const playHitSfx = () => {
  const howl = hitSounds[Math.floor(Math.random() * hitSounds.length)]
  howl.play()
}

const createSfx = (file, volume, options = {}) => new Howl({
  src: [encodeURI(`/sounds/effects/${file}`)],
  volume,
  preload: true,
  ...options,
})

const sfx = {
  swoosh: createSfx('bat-swoosh.wav', 0.8),
  crowdDisappointment: createSfx('crowd disappointment.wav', 0.6),
  fever: createSfx('fevertime.wav', 0.7),
  feverCrowd: createSfx('crowd-cheering.wav', 0.6),
  scoreboard: createSfx('scoreboard.wav', 0.7),
  stamp: createSfx('stamp.mp3', 0.8),
  fanfare: createSfx('fanfare.mp3', 0.8),
}

// 박스 스코어 행 확정음 — 행마다 음이 올라감
const scoreDings = [
  'score-ding.mp3',
  'score-ding_pitch-+2st.wav',
  'score-ding_pitch-+4st.wav',
  'score-ding_pitch-+6st.wav',
].map((file) => createSfx(file, 0.6))
const finalScoreDing = createSfx('score-ding_pitch-+12st.wav', 0.8)

export const playSfx = (name) => {
  sfx[name]?.play()
}

// 일시정지로 멈춘 효과음 이름 (pauseSfx/resumeSfx)
const pausedSfx = new Set()

// 재생 중인 효과음을 페이드아웃 후 정지 (피버 종료 등)
export const stopSfx = (name, fadeMs = 0) => {
  const howl = sfx[name]
  if (pausedSfx.delete(name)) howl.stop() // 일시정지 상태로 남은 소리 정리
  if (!howl || !howl.playing()) return
  if (fadeMs <= 0) {
    howl.stop()
    return
  }
  const vol = howl.volume()
  howl.once('fade', () => {
    howl.stop()
    howl.volume(vol)
  })
  howl.fade(vol, 0, fadeMs)
}

// 일시정지 중 재생 중인 효과음을 멈췄다가 이어서 재생
export const pauseSfx = (name) => {
  const howl = sfx[name]
  if (!howl || !howl.playing()) return
  howl.pause()
  pausedSfx.add(name)
}

export const resumeSfx = (name) => {
  if (!pausedSfx.delete(name)) return
  sfx[name].play() // 일시정지된 소리가 하나면 Howler가 그 소리를 이어서 재생
}

// 피버 연타 타격음 — 연타 겹침 대비 풀 확장
const feverHit = createSfx('bat-hit-03.wav', 0.6, { pool: 16 })

export const playFeverHitSfx = () => {
  feverHit.play()
}

// 헛스윙 아웃 — 스윙 바람 소리 + 관중 탄식
export const playMissSfx = () => {
  sfx.swoosh.play()
  sfx.crowdDisappointment.play()
}

// index번째 행 확정음 (행 수가 더 많으면 마지막 음 반복)
export const playScoreDing = (index) => {
  scoreDings[Math.min(index, scoreDings.length - 1)].play()
}

export const playFinalScoreDing = () => {
  finalScoreDing.play()
}

// 효과음이 잘 들리도록 BGM을 잠시 줄임 — 끌 때는 천천히 원래 볼륨으로 fade in
export const duckBgm = (on) => {
  if (ducked === on) return
  ducked = on
  const track = currentType && tracks[currentType]
  if (!track || !track.playing()) return // 재생 시작 시 bgmVolume()으로 반영됨
  track.fade(track.volume(), bgmVolume(), on ? BGM_DUCK_FADE_MS : BGM_UNDUCK_FADE_MS)
}
