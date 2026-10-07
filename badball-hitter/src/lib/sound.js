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

const createTrack = (file) => new Howl({
  src: [encodeURI(`/sounds/${file}`)],
  loop: true,
  volume: BGM_VOLUME,
  preload: true,
  html5: true,
})

// 오디오 객체는 전부 let — 백그라운드 복귀 시 AudioContext째 새로 만듦 (rebuildAudio)
let tracks = null
let bgmGain = null

let currentType = null
let ducked = false

const createTracks = () => {
  tracks = {
    normal: createTrack('Pinball Spring.m4a'),
    fast: createTrack('Pinball Spring 160.m4a'),
  }
  // html5 play()가 대기 중(_playLock)일 때 stop()은 Howler 큐에만 쌓이고, 재생이 시작돼도 실행되지 않음
  // → 첫 탭의 touchend가 타이틀 곡 재생을 시작한 직후 Play 클릭이 멈추려 하면 두 곡이 겹침
  // 실제 재생이 시작된 시점에 현재 트랙이 아니면 바로 정지
  Object.entries(tracks).forEach(([key, howl]) => {
    howl.on('play', () => {
      if (currentType !== key) howl.stop()
    })
  })
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

// 현재 목표 BGM 볼륨 — 새 트랙 시작·정지 후 복구도 이 값 기준
const bgmVolume = () => (ducked ? BGM_VOLUME * BGM_DUCK_RATIO : BGM_VOLUME)

// iOS는 <audio> 요소의 volume을 코드로 못 바꿔서(항상 1) html5 BGM의 volume/fade가 무시됨
// → BGM audio 요소를 Web Audio GainNode에 연결해 볼륨·덕킹을 gain으로 처리 (스트리밍은 그대로)
// 연결 실패(Web Audio 미지원 등) 시 bgmGain = null → 기존처럼 Howler volume/fade 사용
const connectBgmGain = () => {
  const ctx = Howler.ctx
  if (!ctx || !Howler.masterGain) return null
  try {
    const gain = ctx.createGain()
    gain.gain.value = bgmVolume()
    gain.connect(Howler.masterGain) // 전역 음소거(Howler.mute)도 그대로 적용
    Object.values(tracks).forEach((howl) => {
      // Howler 비공개 필드 — html5 Howl은 생성 시 load()로 audio 요소 하나를 만들고, 재생마다 재사용
      howl._sounds.forEach(({ _node: node }) => {
        ctx.createMediaElementSource(node).connect(gain)
      })
    })
    // Howler는 html5 소리를 재생 중으로 치지 않아 30초 뒤 AudioContext를 suspend → gain 연결된 BGM이 무음이 됨
    Howler.autoSuspend = false
    return gain
  } catch {
    return null
  }
}

// 트랙(howl) 자체 볼륨 — gain 연결 시 1로 두고 gain에서 조절
const trackVolume = () => (bgmGain ? 1 : bgmVolume())

// gain을 목표 볼륨으로 (fadeMs 동안 선형 변화, 0이면 즉시)
const setGainVolume = (fadeMs = 0) => {
  const { gain } = bgmGain
  const now = Howler.ctx.currentTime
  gain.cancelScheduledValues(now)
  gain.setValueAtTime(gain.value, now)
  if (fadeMs > 0) gain.linearRampToValueAtTime(bgmVolume(), now + fadeMs / 1000)
  else gain.setValueAtTime(bgmVolume(), now)
}

const GESTURE_EVENTS = ['click', 'keydown', 'touchend']
let waitingGesture = false
const GESTURE_CLICK_WINDOW_MS = 600 // 같은 탭의 touchstart → click 사이

// 터치 시작 순간 소리가 잠겨 있었는지 — 자동 재생 차단(첫 진입)이면 BGM 요소는 재생 중이어도 AudioContext가 suspended라 무음
// touchend에서 Howler·retryOnGesture가 소리를 풀기 전에(capture 단계 touchstart) 기록
let lockedTouchAt = -Infinity
window.addEventListener('touchstart', () => {
  if (waitingGesture || (Howler.ctx && Howler.ctx.state !== 'running')) lockedTouchAt = performance.now()
}, { capture: true, passive: true })

// 소리가 잠긴 상태에서 누른 탭 — 이때 사운드 토글을 누르면 음소거 대신 '소리 켜기'로 처리 (이 탭이 소리를 풂)
export const isBgmWaitingGesture = () =>
  waitingGesture || performance.now() - lockedTouchAt < GESTURE_CLICK_WINDOW_MS

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
    // 로딩 중이면 playBgm의 load 리스너가 재생 — 여기서도 play()하면 큐에 쌓여 두 번 재생됨
    if (!track || track.playing() || track.state() !== 'loaded') return
    track.off('playerror')
    track.once('playerror', retryOnGesture)
    track.play()
  }

  GESTURE_EVENTS.forEach((ev) => window.addEventListener(ev, onGesture))
}

const stopTrack = (howl) => {
  howl.off('fade')
  howl.stop()
  howl.volume(trackVolume())
}

export const playBgm = (type) => {
  const nextType = type === 'fast' ? 'fast' : 'normal'
  const next = tracks[nextType]

  if (currentType === nextType && next.playing()) {
    if (bgmGain) setGainVolume()
    else next.volume(bgmVolume())
    return
  }

  // 다른 트랙은 즉시 정지 (fade 레이스로 새 트랙이 같이 멈추는 문제 방지)
  Object.entries(tracks).forEach(([key, howl]) => {
    if (key !== nextType) stopTrack(howl)
  })

  currentType = nextType
  stopTrack(next)

  const start = () => {
    // 다른 트랙으로 바뀌었거나 이미 재생 중이면 건너뜀 (중복 play → BGM 두 겹 방지)
    if (currentType !== nextType || next.playing()) return
    next.volume(trackVolume())
    if (bgmGain) {
      setGainVolume()
      if (Howler.ctx.state !== 'running') Howler.ctx.resume().catch(() => {}) // 클릭 직후 호출이면 여기서 unlock
    }
    next.off('playerror') // 이전 play의 미발생 리스너 정리
    next.once('playerror', retryOnGesture)
    next.play()
  }

  if (next.state() === 'loaded') {
    start()
  } else {
    // 로딩 중 playBgm이 여러 번 호출돼도(클릭 핸들러 + useEffect) load 리스너는 하나만
    next.off('load')
    next.once('load', start)
    if (next.state() === 'unloaded') next.load() // 로딩 중 load() 재호출은 오디오 노드를 하나 더 만듦
  }
}

// 백그라운드 전환(리더보드 열기·홈 이동 등) 시 즉시 무음 + BGM 일시정지, 돌아오면 다시 재생
// iOS 웹뷰는 백그라운드에서 오디오 세션을 끊어 AudioContext가 interrupted가 되는데,
// 돌아와서 resume하면 state는 running이어도 스피커 출력이 죽어 BGM·효과음 전부 무음
// → 복귀 시 AudioContext가 멈춰 있으면 Howler째(AudioContext·모든 Howl) 새로 만들고 BGM은 처음부터
//   (이어 재생은 seek가 곡 전환 정지와 꼬여 BGM이 겹치거나 앞부분이 반복돼서 뺌)
let bgmPausedInBackground = false

// AudioContext 깨우기 — 탭 없이 막히면 다음 터치에서 한 번 더
const resumeAudioContext = () => {
  const ctx = Howler.ctx
  if (!ctx || ctx.state === 'running') return
  ctx.resume().catch(() => {})
  const onGesture = () => {
    GESTURE_EVENTS.forEach((ev) => window.removeEventListener(ev, onGesture))
    if (Howler.ctx === ctx && ctx.state !== 'running') ctx.resume().catch(() => {})
  }
  GESTURE_EVENTS.forEach((ev) => window.addEventListener(ev, onGesture))
}

// AudioContext·모든 Howl 생성 (앱 시작 + 백그라운드 복귀 때 출력이 죽었을 때)
const buildAudio = () => {
  createTracks()
  bgmGain = connectBgmGain()
  createEffects()
}

const rebuildAudio = () => {
  const type = currentType
  // 예전 BGM <audio>는 닫힐 AudioContext에 묶여 있어(MediaElementSource는 요소당 한 번) 재사용하면 무음
  // → Howler가 unload 때 html5 풀에 돌려놓는 걸 다시 빼냄
  const oldNodes = Object.values(tracks).flatMap((howl) => howl._sounds.map((snd) => snd._node))
  Howler.unload() // 모든 Howl 해제 + AudioContext 닫고 새로 만듦
  Howler._html5AudioPool = Howler._html5AudioPool.filter((node) => !oldNodes.includes(node))
  // 새 AudioContext·BGM <audio>도 첫 터치에서 Howler가 풀도록 — Howler는 한 번 풀면 autoUnlock을 스스로 꺼서 다시 켬
  // (터치 때 미리 풀어 둔 <audio> 풀도 다시 채움 — 다시 만들 때마다 BGM이 2개씩 가져가 바닥나면 BGM이 안 나옴)
  Howler._audioUnlocked = false
  Howler.autoUnlock = true
  Howler.mute(muted)
  pausedSfx.clear()
  buildAudio()
  currentType = null
  if (type) playBgm(type)
  resumeAudioContext()
}

document.addEventListener('visibilitychange', () => {
  const track = currentType && tracks[currentType]
  if (document.hidden) {
    Howler.mute(true)
    bgmPausedInBackground = !!track && track.playing()
    if (bgmPausedInBackground) track.pause()
    return
  }
  if (Howler.ctx && Howler.ctx.state !== 'running') {
    rebuildAudio()
  } else if (bgmPausedInBackground && track && !track.playing()) {
    // AudioContext가 안 끊긴 짧은 전환 — 그대로 이어서 재생
    Howler.mute(muted)
    track.off('playerror')
    track.once('playerror', retryOnGesture)
    track.play()
  } else {
    Howler.mute(muted)
  }
  bgmPausedInBackground = false
})

export const stopBgm = () => {
  Object.values(tracks).forEach(stopTrack)
  currentType = null
}

// ── 효과음 ──
const HIT_SFX_VOLUME = 0.7

// 효과음은 Web Audio(기본값)로 재생 — html5 audio보다 지연이 짧고 연타 시 겹쳐 재생 가능
let hitSounds = []
let sfx = {}
let scoreDings = []
let finalScoreDing = null
let feverHit = null
let melonCrashes = []

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

const createEffects = () => {
  hitSounds = [1, 2, 3].map((n) => createSfx(`bat-hit-0${n}.wav`, HIT_SFX_VOLUME))
  sfx = {
    swoosh: createSfx('bat-swoosh.wav', 0.8),
    crowdDisappointment: createSfx('crowd disappointment.wav', 0.6),
    fever: createSfx('fevertime.wav', 0.7),
    feverCrowd: createSfx('crowd-cheering.wav', 0.6),
    charge: createSfx('charge.wav', 0.7), // 피버 파워 충전 (꾹 누르는 동안)
    fullSwing: createSfx('grandslam swoosh.wav', 0.8), // 100% 파워 스윙
    scoreboard: createSfx('scoreboard.wav', 0.7),
    scoreboardSoft: createSfx('scoreboard.wav', 0.3), // 피버 준비(READY) — 작게
    stamp: createSfx('stamp.mp3', 0.8),
    fanfare: createSfx('fanfare.mp3', 0.8),
    newBall: createSfx('new-ball.wav', 0.7),
    watermelon: createSfx('watermelontime.wav', 0.7), // WATERMELON! 팝업
  }
  // 박스 스코어 행 확정음 — 행마다 음이 올라감 (원본이 너무 작아 scripts/boost-score-ding.py로 키운 wav)
  // 파일명에 '+' 금지 — 토스 웹뷰가 '+'를 공백으로 읽어 로드 실패 (encodeURI는 '+'를 그대로 둠)
  scoreDings = [
    'score-ding.wav',
    'score-ding_pitch-2st.wav',
    'score-ding_pitch-4st.wav',
    'score-ding_pitch-6st.wav',
  ].map((file) => createSfx(file, 0.6))
  finalScoreDing = createSfx('score-ding_pitch-12st.wav', 0.8)
  // 피버 연타 타격음 — 연타 겹침 대비 풀 확장
  feverHit = createSfx('bat-hit-03.wav', 0.6, { pool: 16 })
  // 수박 깨지는 소리 2종 — 연타 겹침 대비 풀 확장
  melonCrashes = ['crash_watermelon.wav', 'crash_watermelon2.wav'].map((file) => createSfx(file, 0.7, { pool: 8 }))
}

export const playSfx = (name) => {
  sfx[name]?.play()
}

// 효과음 재생 속도(음 높이) — 피버 충전음이 파워에 따라 올라감
export const setSfxRate = (name, rate) => {
  sfx[name]?.rate(rate)
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

export const playFeverHitSfx = () => {
  feverHit.play()
}

// 수박 깨지는 소리 2종 중 하나를 랜덤 재생
export const playMelonCrashSfx = () => {
  melonCrashes[Math.floor(Math.random() * melonCrashes.length)].play()
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
  const fadeMs = on ? BGM_DUCK_FADE_MS : BGM_UNDUCK_FADE_MS
  if (bgmGain) {
    setGainVolume(fadeMs)
    return
  }
  const track = currentType && tracks[currentType]
  if (!track || !track.playing()) return // 재생 시작 시 bgmVolume()으로 반영됨
  track.fade(track.volume(), bgmVolume(), fadeMs)
}

buildAudio()
