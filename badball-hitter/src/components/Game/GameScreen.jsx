import { useState, useEffect, useLayoutEffect, useRef, useCallback } from 'react'
import {
  QUEUE_SIZE, TIMER_MAX,
  calcScore, getActivePitches, assignDirsForStep, getUnlockStep, getPitchDir,
  PITCH_UNLOCK_ORDER, PITCHES,
  FEVER_UNLOCK_DELAY, FEVER_DURATION, createPitchBallImages, getPitchBallImage, toFeverBallImage,
  POWER_FULL_MS, POWER_MIN, POWER_TAP_IGNORE_MS, SHORT_TAP_HINT_MS, POWER_BALL_INTERVAL_MS, POWER_BALL_POINTS, powerBallCount, getHitGrade,
  FEVER_READY_MS, PITCHER_REST_MS, QUEUE_REFILL_INTERVAL_MS,
  FEVER_CHARGE_MAX, FEVER_CHARGE_DECAY_DELAY_MS, FEVER_CHARGE_DECAY_PER_SEC,
  CYCLE_CHARGE_MAX, WATERMELON_MIN, WATERMELON_MAX, WATERMELON_POINTS, WATERMELON_IMAGE,
  MELON_SHARDS_IMAGE, MELON_SHARDS_SIZE, MELON_SHARDS,
} from '../constants'
import {
  playHitSfx, playFeverHitSfx, playMelonCrashSfx, playMissSfx, playSfx, stopSfx, pauseSfx, resumeSfx, duckBgm,
  isMuted, setMuted,
} from '../../lib/sound'
import { haptic, isHapticSupported, isHapticOn, setHapticOn } from '../../lib/haptic'
import volumeIcon from '../../assets/icons/volume.svg'
import volumeXmarkIcon from '../../assets/icons/volume-xmark.svg'
import vibrateIcon from '../../assets/icons/vibrate.svg'
import vibrateOffIcon from '../../assets/icons/vibrate-off.svg'
import Crowd from './Crowd'
import Fielders from './Fielders'
import './GameScreen.css'

// 공 대기열 레이아웃 — 레인 바닥 기준, 맨 앞(index 0)이 쳐야 할 공이라 크게, 뒤로 갈수록 작게 겹침
// (bottom 기준이라 앞 공이 커져도 위로 자라서 아래 타이머와 겹치지 않음)
// spawnDir: 새 공이 살짝 들어오는 쪽 ('left' | 'right' — 그 구종의 힌트 방향)
const ballLaneLayout = (index, spawnDir) => ({
  bottom: index === 0 ? '0%' : `${9 + (index - 1) * 5.5}%`,
  zIndex: 24 - index,
  '--ball-scale': index === 0 ? '1.3' : `${1 - index * 0.085}`,
  // 맨 뒤 2개만 살짝 투명하게 — 투수가 비쳐 보이며 멀리 녹아드는 느낌
  '--ball-opacity': index < 6 ? 1 : 1 - (index - 5) * 0.12,
  '--spawn-x': spawnDir === 'left' ? '-10px' : spawnDir === 'right' ? '10px' : '0px',
})

// 공마다 고유 uid — 렌더 key로 사용 (같은 구종이 연속돼도 공 교체가 보이도록)
let ballUid = 0
const nextBallUid = () => ++ballUid

// 타이머 바 색 = 지금 치면 받을 타격 등급 (판정과 같은 기준)
const GRADE_TIMER_LEVEL = { homerun: 'hr', double: 'safe', single: 'warn', foul: 'danger' }
const timerLevelAt = (elapsedMs) => GRADE_TIMER_LEVEL[getHitGrade(elapsedMs).id]

// 정타 궤적 2종 중 랜덤 (CSS .v0 / .v1)
const randomHitVariant = () => (Math.random() < 0.5 ? 0 : 1)

// 수박 파편 — 큰 조각 3개 + 씨·과즙 3개를 랜덤으로 골라 사방으로 흩뿌림 (매번 방향·회전이 다름)
const SHARD_SCALE = 0.6
const pickRandom = (list, n) => [...list].sort(() => Math.random() - 0.5).slice(0, n)
const randomMelonShards = () => {
  const picked = [
    ...pickRandom(MELON_SHARDS.filter((sh) => sh.big), 3),
    ...pickRandom(MELON_SHARDS.filter((sh) => !sh.big), 3),
  ]
  const slots = pickRandom([0, 1, 2, 3, 4, 5], 6)
  return picked.map((sh, i) => {
    const angle = ((slots[i] * 60 + Math.random() * 30 - 15) * Math.PI) / 180
    const dist = (sh.big ? 30 : 42) + Math.random() * 18
    const spin = (Math.random() < 0.5 ? -1 : 1) * (120 + Math.random() * 240)
    return { ...sh, dx: Math.round(Math.cos(angle) * dist), dy: Math.round(Math.sin(angle) * dist), spin: Math.round(spin) }
  })
}

// 대기열을 채우는 유틸 (dir은 pitchDirs에서 항상 조회 — 큐에 방향을 고정 저장하지 않음)
// melonRef: 남은 수박 수 — 있으면 새로 채우는 공을 수박으로 (대기열 뒤에서 들어옴)
// fromPitcher: 투수가 던져서 자기 칸까지 날아오는 공 (게임 시작·그랜드슬램 후 채우기)
const buildQueue = (existing, unlockStep, pitchDirs, melonRef, size = QUEUE_SIZE, fromPitcher = false) => {
  const ids = getActivePitches(unlockStep, pitchDirs).map((p) => p.id)
  const result = [...existing]
  while (result.length < size) {
    const id = ids[Math.floor(Math.random() * ids.length)]
    const ball = { ...PITCHES[id], uid: nextBallUid(), fromPitcher }
    if (melonRef?.current > 0) {
      ball.watermelon = true
      melonRef.current -= 1
    }
    result.push(ball)
  }
  return result
}

export default function GameScreen({ onGameOver, onQuit }) {
  // ── 게임 상태 ──
  const [score, setScore] = useState(0)
  const [combo, setCombo] = useState(0)
  const [maxCombo, setMaxCombo] = useState(0)
  const [outs, setOuts] = useState(0)
  const [classified, setClassified] = useState(0)
  const [correct, setCorrect] = useState(0)
  const [powerBalls, setPowerBalls] = useState(0)        // 게임 전체 파워 스윙으로 날린 공 수 (결과 화면용)
  const [homeRuns, setHomeRuns] = useState(0)            // 홈런 수 (결과 화면용)
  const [powerPct, setPowerPct] = useState(Math.round(POWER_MIN * 100)) // 파워 % (충전 중 실시간, 파워 버튼에 표시)
  const [feverReady, setFeverReady] = useState(false)     // 피버 시작 후 준비 시간 (입력 무시, CHANCE!)
  const [powerCharging, setPowerCharging] = useState(false) // 피버 중 꾹 누르는 중
  const [powerSwinging, setPowerSwinging] = useState(false) // 파워 스윙 후 공이 날아가는 중
  const [shortTapId, setShortTapId] = useState(0)          // 너무 짧게 누름 — 0이 아니면 "더 길게 꾹!" (바뀔 때마다 흔들림 다시)
  const [grandSlam, setGrandSlam] = useState(false)       // 파워 스윙 — GRAND SLAM 문구 (피버 끝나도 잠깐 유지)
  const [unlockStep, setUnlockStep] = useState(0)
  const [pitchDirs, setPitchDirs] = useState(() => assignDirsForStep(0))
  const [pitchBallImages] = useState(() => createPitchBallImages())

  // ── UI 애니메이션 상태 ──
  const [queue, setQueue] = useState([])
  const [pitcherThrowing, setPitcherThrowing] = useState(false)
  const [swingDir, setSwingDir] = useState(null)     // 'left' | 'right' | null
  const [popMsg, setPopMsg] = useState({ id: 0, text: '', tone: '', visible: false })
  // 전광판 옆 +점수 — 정타/피버 합계를 따로 표시 (피버 직후 정타에 묻히지 않게)
  const [scorePops, setScorePops] = useState({
    hit: { id: 0, text: '', visible: false },
    fever: { id: 0, text: '', visible: false },
  })
  const [paused, setPaused] = useState(false)
  const [soundMuted, setSoundMuted] = useState(isMuted)
  const [hapticOn, setHapticOnState] = useState(isHapticOn)
  const [timerLevel, setTimerLevel] = useState('hr') // 'hr' | 'safe' | 'warn' | 'danger' — 타격 등급 구간
  // 타이머 바 아래 타격 결과 (HOME RUN!/DOUBLE!/SINGLE!/FOUL)
  const [hitLabel, setHitLabel] = useState({ id: 0, grade: '', text: '', visible: false })
  const [hrFlash, setHrFlash] = useState(0)                // 홈런마다 증가 — 타이머 바 플래시·관중 환호 key
  const [timerNum, setTimerNum] = useState(TIMER_MAX.toFixed(1))
  const [fever, setFever] = useState(false)
  const [feverCountdown, setFeverCountdown] = useState(FEVER_DURATION)
  // 처리된 공 연출 — kind: 'hit'(방향대로 외야로) | 'miss'(헛스윙, 몸쪽으로) | 'take'(시간 초과, 가운데로 지나감)
  const [flyBalls, setFlyBalls] = useState([])
  const [outFlash, setOutFlash] = useState(false)         // 아웃 직후 연출 (투수 비웃기·화면 흔들림 등)
  const [swingId, setSwingId] = useState(0)                // 스윙마다 증가 — 스윙 궤적 재생용 key

  // ── ref로 최신 상태 참조 (클로저 문제 방지) ──
  const stateRef = useRef({})
  stateRef.current = { score, combo, maxCombo, outs, classified, correct, powerBalls, homeRuns, unlockStep, pitchDirs, queue, fever }

  const timerRaf = useRef(null)
  const timerBarRef = useRef(null)  // 바 너비는 매 프레임 DOM 직접 갱신 (리렌더 없이)
  const timerStart = useRef(null)
  const feverTimer = useRef(null)
  const handleTimeoutRef = useRef(() => { })
  const screenRef = useRef(null)    // 파워(--power)를 방망이 바·버튼 채움에 같이 쓰도록 DOM 직접 갱신
  const swingTimeout = useRef(null)
  const feverActiveRef = useRef(false)
  const popTimeout = useRef(null)
  const scorePopTimeouts = useRef({})
  const hitLabelTimeout = useRef(null)
  const hrFlashTimeout = useRef(null)
  const homeRunPtsRef = useRef(0)  // 홈런 타구로 얻은 점수 누적 (결과 화면 Home Run 행)
  const gradeBonusRef = useRef(0)  // 타격 등급 배율로 더해진(파울은 깎인) 점수 누적 — 해금 판정에서 제외

  // ── 피버 차지 (0~FEVER_CHARGE_MAX, 소수 — 입력 없으면 서서히 감소) ──
  const chargeRef = useRef(0)
  const lastHitAtRef = useRef(performance.now())
  const feverPendingRef = useRef(false)   // 차지 가득 → 피버 시작 대기 중 (감소 멈춤)
  const feverEndAtRef = useRef(0)         // 피버 종료 시각 (performance.now 기준)
  const gaugeRef = useRef(null)           // 게이지는 매 프레임 DOM 직접 갱신 (리렌더 없이)
  const gaugeFillRef = useRef(null)
  const gaugeRaf = useRef(null)

  // ── 수박 차지 (0~CYCLE_CHARGE_MAX) — 가득 차면 다음 공 몇 개가 수박 ──
  const cycleChargeRef = useRef(0)
  const melonPendingRef = useRef(0)       // 아직 대기열에 안 들어온 수박 수
  const melonActiveRef = useRef(false)    // 수박 차지 가득 ~ 마지막 수박 처리까지 (차지 멈춤)

  // ── 일시정지 ──
  const pausedRef = useRef(false)
  const pausedAtRef = useRef(0)
  const timerResumeRef = useRef(null)     // 재개 시 타이머 경과 ms (null = 재개할 타이머 없음)
  const feverRemainingRef = useRef(0)     // 일시정지 시점의 피버 남은 ms
  const feverOnResumeRef = useRef(false)  // 일시정지 중 피버 시작이 걸리면 재개 시 시작
  const powerHeldMsRef = useRef(0)        // 일시정지 시점까지 누른 시간 (재개 시 이어서 충전)

  // ── 파워 스윙 (피버) ──
  const powerStartRef = useRef(null)      // 누르기 시작한 시각 (null = 안 누르는 중)
  const powerSwungRef = useRef(false)     // 이번 피버에서 이미 스윙함
  const powerPctRef = useRef(0)
  const feverReadyRef = useRef(false)     // 준비 시간 중 (끝나는 순간 누르고 있으면 충전 시작)
  const feverReadyUntilRef = useRef(0)    // 이 시각 전까지 피버 입력 무시 (준비 시간)
  const heldInputsRef = useRef(new Set()) // 지금 누르고 있는 방향 입력 (포인터 id / 키) — 준비 중에도 기록
  const lastDirRef = useRef('right')      // 마지막으로 누른 방향 (가득 차서 자동 스윙할 때)
  const powerSwingRef = useRef(() => { })
  const grandSlamTimeout = useRef(null)
  const shortTapTimeout = useRef(null)
  const refillingRef = useRef(false)      // 파워 스윙 후 대기열 다시 채우는 중 (입력 무시)
  const powerTimeouts = useRef([])
  const endedRef = useRef(false)          // 게임 오버·언마운트 이후 (일시정지·지연 피버 무시)

  // ── 타자 스윙 애니메이션 ──
  const triggerSwing = useCallback((dir) => {
    clearTimeout(swingTimeout.current)
    setSwingDir(dir)
    setSwingId((n) => n + 1)
    swingTimeout.current = setTimeout(() => setSwingDir(null), 280)
  }, [])

  // ── 팝업 표시 ──
  // id 증가로 매번 등장 애니메이션 재생, 이전 팝업의 숨김 타이머는 취소
  const showPop = useCallback((text, tone) => {
    clearTimeout(popTimeout.current)
    setPopMsg((p) => ({ id: p.id + 1, text, tone, visible: true }))
    popTimeout.current = setTimeout(() => setPopMsg((p) => ({ ...p, visible: false })), 850)
  }, [])

  // ── 전광판 옆 점수 팝업 ──
  const showScorePop = useCallback((text, tone = 'hit') => {
    clearTimeout(scorePopTimeouts.current[tone])
    setScorePops((p) => ({ ...p, [tone]: { id: p[tone].id + 1, text, visible: true } }))
    scorePopTimeouts.current[tone] = setTimeout(
      () => setScorePops((p) => ({ ...p, [tone]: { ...p[tone], visible: false } })),
      tone === 'fever' ? 1600 : 900,
    )
  }, [])

  // ── 타이머 바 아래 타격 결과 ──
  const showHitLabel = useCallback((grade) => {
    clearTimeout(hitLabelTimeout.current)
    setHitLabel((p) => ({ id: p.id + 1, grade: grade.id, text: grade.label, visible: true }))
    hitLabelTimeout.current = setTimeout(() => setHitLabel((p) => ({ ...p, visible: false })), 700)
  }, [])

  // ── 홈런 — 타이머 바 플래시 + 관중 환호 ──
  const triggerHrFlash = useCallback(() => {
    clearTimeout(hrFlashTimeout.current)
    setHrFlash((n) => n + 1)
    hrFlashTimeout.current = setTimeout(() => setHrFlash(0), 900)
  }, [])

  // ── 타이머 시작 (elapsedMs: 일시정지 후 이어서 재개할 때의 경과 시간) ──
  const startTimer = useCallback((elapsedMs = 0) => {
    if (feverActiveRef.current) return
    cancelAnimationFrame(timerRaf.current)
    // 일시정지 중에 걸린 타이머(다음 공 준비 등)는 재개 시 시작
    if (pausedRef.current) {
      timerResumeRef.current = elapsedMs
      return
    }
    timerResumeRef.current = null
    timerStart.current = performance.now() - elapsedMs
    if (elapsedMs === 0) {
      if (timerBarRef.current) timerBarRef.current.style.transform = 'scaleX(1)'
      setTimerLevel('hr')
      setTimerNum(TIMER_MAX.toFixed(1))
    }

    const tick = (now) => {
      if (feverActiveRef.current) {
        cancelAnimationFrame(timerRaf.current)
        return
      }
      const elapsed = (now - timerStart.current) / 1000
      const remaining = Math.max(0, TIMER_MAX - elapsed)
      if (timerBarRef.current) {
        timerBarRef.current.style.transform = `scaleX(${remaining / TIMER_MAX})`
      }
      setTimerNum(remaining.toFixed(1))
      setTimerLevel(timerLevelAt(elapsed * 1000))

      if (remaining <= 0) {
        handleTimeoutRef.current()
        return
      }
      timerRaf.current = requestAnimationFrame(tick)
    }
    timerRaf.current = requestAnimationFrame(tick)
  }, [])

  // ── 수박 — 차지 가득이면 다음 공들을 수박으로, 다 처리되면 차지 초기화 ──
  const startWatermelons = () => {
    melonActiveRef.current = true
    melonPendingRef.current = WATERMELON_MIN + Math.floor(Math.random() * (WATERMELON_MAX - WATERMELON_MIN + 1))
  }

  // 첫 수박이 맨 앞에 오는 순간 WATERMELON! 팝업
  const announceMelonFront = (prevQueue, nextQueue) => {
    if (prevQueue[0]?.watermelon || !nextQueue[0]?.watermelon) return
    showPop('WATERMELON!', 'melon')
    playSfx('newBall')
  }

  const checkMelonEnd = (nextQueue) => {
    if (melonActiveRef.current && melonPendingRef.current === 0 && !nextQueue.some((b) => b.watermelon)) {
      melonActiveRef.current = false
      cycleChargeRef.current = 0
    }
  }

  // 피버가 오면 수박은 전부 취소 — 대기열 수박은 원래 구종의 일반 공으로, 수박 차지는 0부터
  const cancelWatermelons = () => {
    melonPendingRef.current = 0
    melonActiveRef.current = false
    cycleChargeRef.current = 0
    const { queue: curQueue } = stateRef.current
    if (!curQueue.some((b) => b.watermelon)) return
    const next = curQueue.map((b) => (b.watermelon ? { ...b, watermelon: false } : b))
    setQueue(next)
    stateRef.current = { ...stateRef.current, queue: next }
  }

  // ── 투수가 공을 하나씩 던져 대기열을 채우고, 다 차면 타이머 시작 (게임 시작·그랜드슬램 후) ──
  const refillQueue = useCallback((delayMs) => {
    refillingRef.current = true
    const addBall = () => {
      if (endedRef.current) return
      if (pausedRef.current) {
        powerTimeouts.current.push(setTimeout(addBall, 100))
        return
      }
      const { queue: q, unlockStep: step, pitchDirs: dirs } = stateRef.current
      const next = buildQueue(q, step, dirs, melonPendingRef, q.length + 1, true)
      setQueue(next)
      stateRef.current = { ...stateRef.current, queue: next }
      setPitcherThrowing(true)
      powerTimeouts.current.push(setTimeout(() => setPitcherThrowing(false), QUEUE_REFILL_INTERVAL_MS - 10))
      if (next.length < QUEUE_SIZE) {
        powerTimeouts.current.push(setTimeout(addBall, QUEUE_REFILL_INTERVAL_MS))
      } else {
        refillingRef.current = false
        startTimer()
      }
    }
    powerTimeouts.current.push(setTimeout(addBall, delayMs))
  }, [startTimer])

  // ── 피버 종료 — 파워 스윙으로 날린 공 점수를 한 번에 합산 (마지막 공이 발사되는 순간) ──
  const endFever = useCallback((balls) => {
    clearInterval(feverTimer.current)
    feverActiveRef.current = false
    setFever(false)
    stopSfx('fever', 300)
    stopSfx('feverCrowd', 600)
    duckBgm(false)
    chargeRef.current = 0
    lastHitAtRef.current = performance.now()

    setPowerCharging(false)
    setPowerSwinging(false)
    clearTimeout(shortTapTimeout.current)
    setShortTapId(0)
    const { score: curScore, powerBalls: curBalls } = stateRef.current
    const pts = balls * POWER_BALL_POINTS
    const newScore = curScore + pts
    const newBalls = curBalls + balls
    setScore(newScore)
    setPowerBalls(newBalls)
    stateRef.current = { ...stateRef.current, score: newScore, powerBalls: newBalls }
    showScorePop(`+${pts.toLocaleString()}`, 'fever')

    // 투수가 잠깐 숨 고른 뒤 바로 다시 던짐
    refillQueue(PITCHER_REST_MS)
  }, [showScorePop, refillQueue])

  // 지금 파워 (POWER_MIN~1) — 누르는 순간 POWER_MIN, POWER_FULL_MS 동안 누르면 가득 (안 누르는 중이면 POWER_MIN)
  const currentPower = (now) =>
    powerStartRef.current == null ? POWER_MIN
      : Math.min(1, POWER_MIN + (1 - POWER_MIN) * (now - powerStartRef.current) / POWER_FULL_MS)

  // 파워 충전 시작 (피버 중 누름 / 준비가 끝날 때 누르고 있었음)
  const startCharging = () => {
    powerStartRef.current = performance.now()
    setPowerCharging(true)
    clearTimeout(shortTapTimeout.current)
    setShortTapId(0)
    haptic('tickWeak')
  }

  // 너무 짧게 누름 — 파워 버튼에 잠깐 "더 길게 꾹!" (다시 짧게 누르면 흔들림부터 다시)
  const showShortTap = () => {
    clearTimeout(shortTapTimeout.current)
    setShortTapId((id) => id + 1)
    shortTapTimeout.current = setTimeout(() => setShortTapId(0), SHORT_TAP_HINT_MS)
  }

  // ── 파워 스윙 — 파워만큼 공이 따라라락 연달아 날아가고 피버 종료 ──
  const powerSwing = useCallback((dir) => {
    if (!feverActiveRef.current || powerSwungRef.current) return
    powerSwungRef.current = true
    clearInterval(feverTimer.current)
    const power = currentPower(performance.now())
    const count = powerBallCount(power)
    powerStartRef.current = null
    clearTimeout(grandSlamTimeout.current)
    setGrandSlam(true)
    grandSlamTimeout.current = setTimeout(() => setGrandSlam(false), 1200)

    // 대기열 공은 전부 치워버림
    setQueue([])
    stateRef.current = { ...stateRef.current, queue: [] }
    setPowerCharging(false)
    setPowerSwinging(true)
    triggerSwing(dir)
    haptic('success')

    // 날아가는 공은 대기열과 별개
    const { unlockStep: step, pitchDirs: dirs } = stateRef.current
    const ids = getActivePitches(step, dirs).map((p) => p.id)
    for (let i = 0; i < count; i++) {
      powerTimeouts.current.push(setTimeout(() => {
        const id = ids[Math.floor(Math.random() * ids.length)]
        const ballDir = Math.random() < 0.5 ? 'left' : 'right'
        setFlyBalls((balls) => [...balls, {
          kind: 'hit', dir: ballDir, pitch: { ...PITCHES[id], uid: nextBallUid() },
          variant: randomHitVariant(), grade: 'homerun', fever: true,
        }])
        playFeverHitSfx()
        haptic('tickWeak')
      }, i * POWER_BALL_INTERVAL_MS))
    }
    // 마지막 공이 발사되는 순간 피버 종료 — 바로 대기열 채우기 시작
    powerTimeouts.current.push(setTimeout(() => endFever(count), (count - 1) * POWER_BALL_INTERVAL_MS))
  }, [endFever, triggerSwing])

  useLayoutEffect(() => {
    powerSwingRef.current = powerSwing
  }, [powerSwing])

  // ── 피버 카운트다운 (종료 시각 기준 — 일시정지 후 남은 시간부터 재개) ──
  const runFeverClock = useCallback((remainingMs) => {
    clearInterval(feverTimer.current)
    feverEndAtRef.current = performance.now() + remainingMs
    const tick = () => {
      const left = feverEndAtRef.current - performance.now()
      setFeverCountdown(Math.min(FEVER_DURATION, Math.max(0, Math.ceil(left / 1000))))
      if (left <= 0) powerSwing('right')  // 시간 끝 — 그 시점 파워로 자동 스윙
    }
    tick()
    feverTimer.current = setInterval(tick, 100)
  }, [powerSwing])

  // ── 피버 시작 ──
  const startFever = useCallback(() => {
    if (endedRef.current) return
    if (pausedRef.current) {
      feverOnResumeRef.current = true
      return
    }
    feverPendingRef.current = false
    feverActiveRef.current = true
    chargeRef.current = 0
    cancelWatermelons()
    timerResumeRef.current = null
    cancelAnimationFrame(timerRaf.current)
    setFever(true)
    powerStartRef.current = null
    powerSwungRef.current = false
    powerHeldMsRef.current = 0
    powerPctRef.current = Math.round(POWER_MIN * 100)
    setPowerPct(powerPctRef.current)
    setPowerCharging(false)
    setPowerSwinging(false)
    feverReadyRef.current = true
    setFeverReady(true)
    playSfx('fever')
    playSfx('feverCrowd')
    playSfx('scoreboardSoft')
    duckBgm(true)
    haptic('success')
    feverReadyUntilRef.current = performance.now() + FEVER_READY_MS
    runFeverClock(FEVER_DURATION * 1000 + FEVER_READY_MS)
  }, [runFeverClock])

  // ── 게임 오버 ──
  const handleGameOver = useCallback(() => {
    endedRef.current = true
    cancelAnimationFrame(timerRaf.current)
    clearInterval(feverTimer.current)
    const s = stateRef.current
    // TODO: Supabase — save score (결과 화면의 finalScore 기준)
    setTimeout(() => {
      onGameOver({
        score: s.score,
        correct: s.correct,
        classified: s.classified,
        maxCombo: s.maxCombo,
        powerBalls: s.powerBalls,
        homeRuns: s.homeRuns,
        unlockStep: s.unlockStep,
        homeRunPts: homeRunPtsRef.current,
        pitchBallImages,
      })
    }, 400)
  }, [onGameOver, pitchBallImages])

  // ── 시간 초과 처리 ──
  const handleTimeout = useCallback(() => {
    if (feverActiveRef.current) return
    const { outs: curOuts, queue: curQueue, unlockStep: curUnlockStep, pitchDirs: curPitchDirs } = stateRef.current
    setCombo(0)
    chargeRef.current /= 2
    if (!melonActiveRef.current) cycleChargeRef.current = 0
    showPop('TIME UP!', 'bad')
    haptic('error')
    playSfx('crowdDisappointment')  // 스윙 없이 아웃 — 관중 탄식만
    const newOuts = curOuts + 1
    setOuts(newOuts)
    if (newOuts >= 3) {
      handleGameOver()
      return
    }
    // 맨 앞 공은 타자 옆을 지나가고, 제거 후 보충
    if (curQueue.length > 0) setFlyBalls((balls) => [...balls, { kind: 'take', dir: null, pitch: curQueue[0] }])
    const next = buildQueue(curQueue.slice(1), curUnlockStep, curPitchDirs, melonPendingRef)
    setQueue(next)
    stateRef.current = { ...stateRef.current, combo: 0, outs: newOuts, queue: next }
    announceMelonFront(curQueue, next)
    checkMelonEnd(next)
    startTimer()
  }, [showPop, startTimer, handleGameOver])

  useLayoutEffect(() => {
    handleTimeoutRef.current = handleTimeout
  }, [handleTimeout])

  // ── 판정 로직 ──
  const judge = useCallback((dir) => {
    const { fever: isFever, queue: curQueue, combo: curCombo, score: curScore,
      maxCombo: curMax, classified: curCls, correct: curCrt,
      unlockStep: curUnlockStep, pitchDirs: curPitchDirs, outs: curOuts } = stateRef.current

    if (pausedRef.current || endedRef.current || refillingRef.current) return

    // 피버 중 — 누르기 시작하면 파워 충전, 떼면(release) 파워 스윙. 스윙은 한 번뿐
    if (isFever) {
      if (powerSwungRef.current || powerStartRef.current != null) return
      // 준비 시간 — 연타 관성 무시 (누른 채로 준비가 끝나면 그때 충전 시작)
      if (feverReadyRef.current || performance.now() < feverReadyUntilRef.current) return
      startCharging()
      return
    }

    if (curQueue.length === 0) return
    cancelAnimationFrame(timerRaf.current)

    // 수박 — 좌우 구분 없이 치면 깨짐 (타이머는 평소처럼, 콤보 +1, 수박 차지·타율 변화 없음)
    if (curQueue[0].watermelon) {
      // 타격음 + 수박 깨지는 소리 함께
      playFeverHitSfx()
      playMelonCrashSfx()
      haptic('tickWeak')
      triggerSwing(dir)
      setPitcherThrowing(true)
      setTimeout(() => setPitcherThrowing(false), 250)
      const nextQueue = buildQueue(curQueue.slice(1), curUnlockStep, curPitchDirs, melonPendingRef)
      const newScore = curScore + WATERMELON_POINTS
      const newCombo = curCombo + 1
      const newMax = Math.max(newCombo, curMax)
      setFlyBalls((balls) => [
        ...balls,
        { kind: 'hit', dir, pitch: curQueue[0], variant: randomHitVariant() },
        { kind: 'shards', pitch: curQueue[0], shards: randomMelonShards() },
      ])
      setQueue(nextQueue)
      setScore(newScore)
      setCombo(newCombo)
      setMaxCombo(newMax)
      showScorePop(`+${WATERMELON_POINTS}`)
      lastHitAtRef.current = performance.now()  // 수박 치는 동안 피버 차지가 줄지 않게
      stateRef.current = { ...stateRef.current, queue: nextQueue, score: newScore, combo: newCombo, maxCombo: newMax }
      checkMelonEnd(nextQueue)
      // 수박도 피버 차지 +1 — 가득 차면 피버 (피버가 오면 남은 수박은 사라짐)
      chargeRef.current = Math.min(FEVER_CHARGE_MAX, chargeRef.current + 1)
      if (chargeRef.current >= FEVER_CHARGE_MAX && !feverPendingRef.current) {
        feverPendingRef.current = true
        setTimeout(() => startFever(), 200)
      }
      startTimer()
      return
    }


    const bt = curQueue[0]
    const isCorrect = dir === getPitchDir(bt.id, curPitchDirs)
    const reactionMs = performance.now() - timerStart.current
    const hitGrade = isCorrect ? getHitGrade(reactionMs) : null
    const isHomeRun = hitGrade?.id === 'homerun'

    // 공 연출 — 정타는 친 방향으로 날아가고, 헛스윙은 몸쪽으로 지나감. 큐에서는 바로 빼서 뒤 공이 앞으로 옴
    setFlyBalls((balls) => [...balls, { kind: isCorrect ? 'hit' : 'miss', dir, pitch: bt, variant: randomHitVariant(), grade: hitGrade?.id }])

    // 투수 동작
    setPitcherThrowing(true)
    setTimeout(() => setPitcherThrowing(false), 250)

    // 타자 스윙
    triggerSwing(dir)

    const newClassified = curCls + 1

    let nextUnlockStep = curUnlockStep
    let nextPitchDirs = curPitchDirs
    let patch  // 리렌더 전에 다음 탭이 들어와도 최신 값으로 판정하도록 stateRef에 즉시 반영할 값

    if (isCorrect) {
      playHitSfx()
      haptic(isHomeRun ? 'tap' : 'tickWeak')
      const newCombo = curCombo + 1
      const newMax = Math.max(newCombo, curMax)
      const basePts = calcScore(newCombo)
      const pts = Math.round(basePts * hitGrade.mult)
      const newScore = curScore + pts
      gradeBonusRef.current += pts - basePts
      const newCorrect = curCrt + 1

      setCombo(newCombo)
      setMaxCombo(newMax)
      setScore(newScore)
      setCorrect(newCorrect)
      setClassified(newClassified)
      patch = { combo: newCombo, maxCombo: newMax, score: newScore, correct: newCorrect, classified: newClassified }
      showScorePop(`+${pts}`)
      showHitLabel(hitGrade)
      if (isHomeRun) {
        const newHomeRuns = stateRef.current.homeRuns + 1
        setHomeRuns(newHomeRuns)
        homeRunPtsRef.current += pts
        stateRef.current = { ...stateRef.current, homeRuns: newHomeRuns }
        triggerHrFlash()
      }

      // 구종 해금 (첫 공은 콤보, 이후는 점수 기준) — 배율 보너스를 뺀 점수로 판정해 해금 속도·등급 밸런스 유지
      // 수박 타임(차지 가득 ~ 마지막 수박)엔 해금을 미룸 — 끝난 뒤 다음 정타에서 해금
      const reachedStep = melonActiveRef.current ? curUnlockStep
        : getUnlockStep(curUnlockStep, newCombo, newScore - gradeBonusRef.current)
      const isUnlocking = reachedStep > curUnlockStep

      // 피버 차지 — 가득 차면 발동, 해금과 겹치면 새 구종을 먼저 보여주도록 차지를 되돌려 미룸
      chargeRef.current = Math.min(FEVER_CHARGE_MAX, chargeRef.current + 1)
      lastHitAtRef.current = performance.now()
      if (chargeRef.current >= FEVER_CHARGE_MAX) {
        if (isUnlocking) {
          chargeRef.current = FEVER_CHARGE_MAX - FEVER_UNLOCK_DELAY
        } else {
          feverPendingRef.current = true
          setTimeout(() => startFever(), 200)
        }
      }

      // 수박 차지 — 파울 제외. 가득 차면 다음 공들이 수박 (피버 중엔 차지 안 쌓임)
      if (hitGrade.id !== 'foul' && !melonActiveRef.current) {
        cycleChargeRef.current = Math.min(CYCLE_CHARGE_MAX, cycleChargeRef.current + 1)
        if (cycleChargeRef.current >= CYCLE_CHARGE_MAX) {
          if (isUnlocking) cycleChargeRef.current = CYCLE_CHARGE_MAX - FEVER_UNLOCK_DELAY
          else if (feverPendingRef.current) cycleChargeRef.current = 0  // 피버와 겹치면 수박 없이 초기화
          else startWatermelons()
        }
      }

      if (isUnlocking) {
        nextUnlockStep = reachedStep
        nextPitchDirs = assignDirsForStep(reachedStep, curPitchDirs)
        setUnlockStep(reachedStep)
        setPitchDirs(nextPitchDirs)
        patch = { ...patch, unlockStep: reachedStep, pitchDirs: nextPitchDirs }

        const addedLabels = PITCH_UNLOCK_ORDER.slice(curUnlockStep, reachedStep)
          .map((id) => PITCHES[id].label)
        // 새 구종 팝업과 함께 해금 효과음
        setTimeout(() => {
          showPop(`NEW PITCH!\n${addedLabels.join(', ')}`, 'new')
          playSfx('newBall')
        }, 450)
      }
    } else {
      const newOuts = curOuts + 1
      playMissSfx()
      haptic('error')
      setCombo(0)
      chargeRef.current /= 2
      if (!melonActiveRef.current) cycleChargeRef.current = 0
      setClassified(newClassified)
      showPop('MISS!', 'bad')
      setOuts(newOuts)
      patch = { combo: 0, classified: newClassified, outs: newOuts }
      if (newOuts >= 3) {
        endedRef.current = true  // 게임 오버 연출 중 입력 무시
        setQueue(curQueue.slice(1))
        setTimeout(() => handleGameOver(), 300)
        return
      }
    }

    // 대기열 보충 + 다음 공 바로 준비 (기다림 없이 연타 가능) — 피버 중·대기 중엔 수박을 들이지 않음
    const next = buildQueue(curQueue.slice(1), nextUnlockStep, nextPitchDirs,
      feverActiveRef.current || feverPendingRef.current ? null : melonPendingRef)
    setQueue(next)
    stateRef.current = { ...stateRef.current, ...patch, queue: next }
    announceMelonFront(curQueue, next)
    startTimer()
  }, [showPop, showScorePop, showHitLabel, triggerHrFlash, startFever, handleGameOver, startTimer, triggerSwing])

  // ── 버튼·키 누름/뗌 — 누르고 있는 입력을 기록 (준비 끝날 때 누르고 있으면 충전 시작) ──
  const press = useCallback((id, dir) => {
    heldInputsRef.current.add(id)
    lastDirRef.current = dir
    judge(dir)
  }, [judge])

  // 피버 중 충전하고 있었으면 뗀 순간의 파워로 스윙 (최소 POWER_MIN) — 짧은 터치는 충전만 취소, 다시 꾹 누르면 됨
  const release = useCallback((id, dir) => {
    heldInputsRef.current.delete(id)
    if (pausedRef.current) return
    if (!feverActiveRef.current || powerStartRef.current == null) return
    if (performance.now() - powerStartRef.current < POWER_TAP_IGNORE_MS) {
      powerStartRef.current = null
      setPowerCharging(false)
      showShortTap()
      return
    }
    powerSwing(dir)
  }, [powerSwing])

  // ── 일시정지 / 재개 ──
  const pauseGame = useCallback(() => {
    if (pausedRef.current || endedRef.current) return
    const now = performance.now()
    pausedRef.current = true
    pausedAtRef.current = now
    setPaused(true)

    if (feverActiveRef.current) {
      feverRemainingRef.current = Math.max(0, feverEndAtRef.current - now)
      clearInterval(feverTimer.current)
      if (powerStartRef.current != null) powerHeldMsRef.current = now - powerStartRef.current
    } else if (!feverPendingRef.current) {
      // 피버 시작 대기 중이 아니면 진행 중인 타이머 — 경과 시간 저장
      cancelAnimationFrame(timerRaf.current)
      timerResumeRef.current = now - timerStart.current
    }
    pauseSfx('fever')
    pauseSfx('feverCrowd')
    duckBgm(true)
  }, [])

  const resumeGame = useCallback(() => {
    if (!pausedRef.current) return
    pausedRef.current = false
    setPaused(false)
    // 멈춰 있던 시간만큼 차지 감소 대기도 미룸
    lastHitAtRef.current += performance.now() - pausedAtRef.current
    feverReadyUntilRef.current += performance.now() - pausedAtRef.current

    resumeSfx('fever')
    resumeSfx('feverCrowd')
    duckBgm(feverActiveRef.current)

    if (feverActiveRef.current) {
      if (powerStartRef.current != null) powerStartRef.current = performance.now() - powerHeldMsRef.current
      if (!powerSwungRef.current) runFeverClock(feverRemainingRef.current)
    } else if (feverOnResumeRef.current) {
      feverOnResumeRef.current = false
      startFever()
    } else if (timerResumeRef.current != null) {
      startTimer(timerResumeRef.current)
    }
  }, [runFeverClock, startFever, startTimer])

  const togglePause = useCallback(() => {
    if (pausedRef.current) resumeGame()
    else pauseGame()
  }, [pauseGame, resumeGame])

  const toggleSound = (e) => {
    e.currentTarget.blur()
    const next = !soundMuted
    setMuted(next)
    setSoundMuted(next)
  }

  const toggleHaptic = (e) => {
    e.currentTarget.blur()
    const next = !hapticOn
    setHapticOn(next)
    setHapticOnState(next)
  }

  // 탭 전환·앱 이탈 시 자동 일시정지
  useEffect(() => {
    const onVisibility = () => {
      if (document.hidden) pauseGame()
    }
    document.addEventListener('visibilitychange', onVisibility)
    return () => document.removeEventListener('visibilitychange', onVisibility)
  }, [pauseGame])

  // ── 피버 차지 게이지 — 감소 처리 + DOM 갱신 (피버 중엔 남은 피버 시간 표시) ──
  useEffect(() => {
    let last = performance.now()
    let shown = -1
    const loop = (now) => {
      const dt = (now - last) / 1000
      last = now
      if (!pausedRef.current) {
        let ratio
        if (feverActiveRef.current) {
          // 피버 중엔 타자 옆 게이지는 숨기고, 파워 버튼이 충전 바 (스윙 후엔 그 파워로 멈춤)
          ratio = 0
          // 준비 끝 — 누르고 있었으면 바로 충전 시작
          if (feverReadyRef.current && now >= feverReadyUntilRef.current) {
            feverReadyRef.current = false
            setFeverReady(false)
            if (heldInputsRef.current.size > 0 && !powerSwungRef.current) startCharging()
          }
          if (!powerSwungRef.current) {
            // 누르는 순간 POWER_MIN부터 — 파워 버튼 채움(--power)과 %가 같은 값
            const power = currentPower(now)
            screenRef.current?.style.setProperty('--power', power)
            const pct = Math.round(power * 100)
            if (pct !== powerPctRef.current) {
              powerPctRef.current = pct
              setPowerPct(pct)
            }
            if (power >= 1) powerSwingRef.current(lastDirRef.current)  // 가득 차면 바로 스윙
          }
        } else {
          if (!feverPendingRef.current && chargeRef.current > 0
            && now - lastHitAtRef.current > FEVER_CHARGE_DECAY_DELAY_MS) {
            chargeRef.current = Math.max(0, chargeRef.current - FEVER_CHARGE_DECAY_PER_SEC * dt)
          }
          ratio = chargeRef.current / FEVER_CHARGE_MAX
        }
        if (ratio !== shown && gaugeFillRef.current) {
          shown = ratio
          gaugeFillRef.current.style.transform = `scaleY(${ratio})`
          gaugeRef.current?.classList.toggle('near-full', !feverActiveRef.current && ratio >= 0.8)
        }

        // 수박 차지 — 화면엔 안 보이고 뒤에서만 계산 (수박 진행 중엔 멈춤)
        if (!melonActiveRef.current && cycleChargeRef.current > 0
          && now - lastHitAtRef.current > FEVER_CHARGE_DECAY_DELAY_MS) {
          cycleChargeRef.current = Math.max(0, cycleChargeRef.current - FEVER_CHARGE_DECAY_PER_SEC * dt)
        }
      }
      gaugeRaf.current = requestAnimationFrame(loop)
    }
    gaugeRaf.current = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(gaugeRaf.current)
  }, [])

  // ── 초기화 ──
  useEffect(() => {
    new Image().src = '/assets/feverpitcher.png'  // 30콤보 진입 시 교체 지연 방지
    endedRef.current = false  // StrictMode 재마운트 시 이전 cleanup의 종료 표시 해제
    refillQueue(300)  // 투수가 하나씩 던져 채우고 타이머 시작
    return () => {
      cancelAnimationFrame(timerRaf.current)
      clearInterval(feverTimer.current)
      clearTimeout(swingTimeout.current)
      clearTimeout(popTimeout.current)
      Object.values(scorePopTimeouts.current).forEach(clearTimeout)
      clearTimeout(hitLabelTimeout.current)
      clearTimeout(hrFlashTimeout.current)
      clearTimeout(grandSlamTimeout.current)
      clearTimeout(shortTapTimeout.current)
      powerTimeouts.current.forEach(clearTimeout)
      endedRef.current = true
      stopSfx('fever')
      stopSfx('feverCrowd')
      duckBgm(false)
    }
  }, []) // eslint-disable-line

  // ── 키보드 입력 ──
  useEffect(() => {
    const keyDir = (key) => (
      key === 'ArrowLeft' || key === 'a' || key === 'A' ? 'left'
        : key === 'ArrowRight' || key === 'd' || key === 'D' ? 'right' : null
    )
    const onKey = (e) => {
      if (e.key === 'Escape' || e.key === 'p' || e.key === 'P') { e.preventDefault(); togglePause(); return }
      const dir = keyDir(e.key)
      if (!dir) return
      e.preventDefault()
      if (!e.repeat) press(`key-${e.key}`, dir)  // 꾹 누를 때 자동 반복 입력은 무시 (피버 충전용 홀드)
    }
    const onKeyUp = (e) => {
      const dir = keyDir(e.key)
      if (dir) release(`key-${e.key}`, dir)
    }
    window.addEventListener('keydown', onKey)
    window.addEventListener('keyup', onKeyUp)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('keyup', onKeyUp)
    }
  }, [press, release, togglePause])

  // ── 활성 구종 힌트 계산 ──
  const activeTypes = getActivePitches(unlockStep, pitchDirs)
  // 최신 해금 구종이 위로 오도록 역순
  const leftHints = activeTypes.filter((t) => t.dir === 'left').reverse()
  const rightHints = activeTypes.filter((t) => t.dir === 'right').reverse()

  const batterSrc =
    swingDir === 'left' ? '/assets/batter_swing_l.png'
      : swingDir === 'right' ? '/assets/batter_swing_r.png'
        : '/assets/batter_idle.png'

  // 맨 앞이 수박 — 연타 안내
  const melonFront = !fever && !!queue[0]?.watermelon

  // 30콤보+/피버엔 땀 흘리는 투수
  const pitcherSweat = fever || combo >= 30
  const pitcherSrc = pitcherSweat ? '/assets/feverpitcher.png' : '/assets/pitcher_idle.png'

  // goldDelayMs: 피버 준비 중 레인 공이 금테 공으로 바뀌는 시점 (뒤쪽 공부터 차례로, 일반 공 위에 겹쳐 서서히 나타남)
  const renderBall = (pitch, className, size = 'lane', feverBall = false, goldDelayMs = null) => {
    // 피버 중엔 레인·타구 공이 금테 공으로 (좌/우 힌트·수박은 그대로)
    const baseImg = pitch.watermelon ? WATERMELON_IMAGE : getPitchBallImage(pitch.id, pitchBallImages)
    const img = feverBall && !pitch.watermelon ? toFeverBallImage(baseImg) : baseImg
    if (img) {
      return (
        <div className={`${className} has-img`}>
          <img src={img} className={`ball-sprite ${size}${feverBall ? ' fever' : ''}${pitch.watermelon ? ' melon' : ''}`} alt="" draggable={false} />
          {goldDelayMs != null && !pitch.watermelon && (
            <img
              src={toFeverBallImage(baseImg)}
              className={`ball-sprite ${size} fever gold-in`}
              style={{ '--gold-delay': `${goldDelayMs}ms` }}
              alt=""
              draggable={false}
            />
          )}
        </div>
      )
    }
    return (
      <div
        className={className}
        style={{ background: pitch.color, borderColor: pitch.border }}
      >
        {pitch.text}
      </div>
    )
  }

  // 아웃 당하면 잠깐 아웃 연출
  useEffect(() => {
    if (outs === 0) return
    setOutFlash(true)
    const t = setTimeout(() => setOutFlash(false), 1200)
    return () => clearTimeout(t)
  }, [outs])

  // 화면 연출 단계 — 아웃 직후 > 피버 > 30콤보+ > 평소 (.game-screen의 scene-* 클래스로 CSS에서 처리)
  const sceneMood = outFlash ? 'out' : fever ? 'fever' : combo >= 30 ? 'hype' : 'normal'
  // 관중 분위기 — 피버·홈런 직후 > 30콤보+ > 10콤보+ > 평소
  const crowdMood = fever || hrFlash ? 'fever' : combo >= 30 ? 'hype' : combo >= 10 ? 'warm' : 'calm'

  // 10콤보마다 콤보 숫자 스타일 단계 상승 (최대 5)
  const comboLevel = Math.min(Math.floor(combo / 10), 5)
  // 피버 제목(CHANCE! / GRAND SLAM)이 떠 있는 동안 — 콤보는 제목 아래로 비켜남
  const feverTitleOn = grandSlam || (fever && feverReady)
  const scoreText = score.toLocaleString()

  // 힌트 아이템 — 중앙 기준 오프셋으로 배치 (새 공이 위에 추가되면 기존 공이 내려감)
  const renderHint = (bt, i, list) => (
    <div
      key={bt.id}
      className="hint-item"
      style={{ '--hint-offset': i - (list.length - 1) / 2 }}
    >
      <div className="hint-pop">
        {/* 수박 타임엔 힌트 공도 수박 */}
        {renderBall(melonFront ? { ...bt, watermelon: true } : bt, 'hint-ball', 'hint')}
        <div className="hint-lbl">{bt.label}</div>
      </div>
    </div>
  )

  return (
    <div ref={screenRef} className={`game-screen scene-${sceneMood}${paused ? ' paused' : ''}${grandSlam ? ' grand-slam' : ''}`}>
      <Crowd mood={crowdMood} hush={outFlash} />
      <Fielders mood={sceneMood} />

      {/* HUD */}
      <div className="hud">
        <div className="hud-left">
          <span className="hud-label outs-label">OUTS</span>
          <div className="out-row">
            {[1, 2, 3].map((n) => (
              <div key={n} className={`out-dot ${outs >= n ? 'active' : ''}`} />
            ))}
          </div>
        </div>
        <button
          type="button"
          className="pause-btn"
          onPointerDown={(e) => { e.preventDefault(); togglePause() }}
          aria-label="Pause"
        >
          <span className="pause-icon" />
        </button>
      </div>

      {/* 배경 전광판 위 점수 */}
      <div className="scoreboard">
        <span className="scoreboard-label">SCORE</span>
        <span
          key={`score-${score}`}
          className={`scoreboard-num${scoreText.length > 7 ? ' long' : ''}`}
        >
          {scoreText}
        </span>
        {/* 점수 획득 — 전광판 오른쪽에서 튀어나옴 */}
        {['hit', 'fever'].map((tone) => (
          <span
            key={`pop-${tone}-${scorePops[tone].id}`}
            className={`score-pop ${tone}`}
            style={{ opacity: scorePops[tone].visible ? 1 : 0 }}
          >
            {scorePops[tone].text}
          </span>
        ))}
      </div>

      {/* 피버 내내 — 투수·타자·공·방망이·버튼만 남기고 배경 살짝 어둡게 (끝나면 서서히 밝아짐) */}
      <div className={`fever-dim${fever ? ' on' : ''}`} />

      {/* 중앙 콤보 — 피버 중에도 항상 표시, 피버 제목이 떠 있는 동안엔 그 아래로 */}
      {combo > 0 && (
        <div className={`center-combo${feverTitleOn ? ' below-title' : ''}`}>
          <span className="center-label">COMBO</span>
          <div className={`center-num combo-lv-${comboLevel}`}>
            <span key={combo} className="combo-num">{combo}</span>
          </div>
        </div>
      )}

      {/* 투수 */}
      <div className="pitcher-area">
        {outFlash && <div key={outs} className="pitcher-taunt">HA!</div>}
        <div className="pitcher-body">
          <img
            className={`pitcher-sprite${pitcherSweat ? ' sweat' : ''}${pitcherThrowing ? ' throwing' : ''}`}
            src={pitcherSrc}
            alt="투수"
            draggable={false}
          />
        </div>
      </div>

      {/* 공 레인 — 피버 중엔 전부 불타는 공 */}
      <div className={`ball-lane${fever ? ' fever' : ''}`}>
        {queue.map((bt, i) => (
          <div
            key={bt.uid}
            className={`ball-item-wrap depth-${i}${bt.fromPitcher ? ' from-pitcher' : ''}`}
            style={ballLaneLayout(i, getPitchDir(bt.id, pitchDirs))}
          >
            {renderBall(bt, 'ball-item', 'lane', false, fever ? (queue.length - 1 - i) * 70 : null)}
          </div>
        ))}
      </div>

      {/* 처리된 공 연출 — 몸쪽으로 오는 공이 타자·버튼 위로 보이도록 레인 밖 별도 레이어 */}
      <div className="fly-layer">
        {flyBalls.map((fb) => fb.kind === 'shards' ? (
          // 수박 파편 — 맨 앞 공 자리에서 흩어짐 (자식 애니메이션 끝 이벤트는 무시)
          <div
            key={`shards-${fb.pitch.uid}`}
            className="melon-shards"
            onAnimationEnd={(e) => {
              if (e.target === e.currentTarget) setFlyBalls((balls) => balls.filter((b) => b !== fb))
            }}
          >
            {fb.shards.map((sh, i) => (
              <span
                key={i}
                className="shard"
                style={{
                  width: sh.w * SHARD_SCALE,
                  height: sh.h * SHARD_SCALE,
                  backgroundImage: `url(${MELON_SHARDS_IMAGE})`,
                  backgroundSize: `${MELON_SHARDS_SIZE[0] * SHARD_SCALE}px ${MELON_SHARDS_SIZE[1] * SHARD_SCALE}px`,
                  backgroundPosition: `${-sh.x * SHARD_SCALE}px ${-sh.y * SHARD_SCALE}px`,
                  '--dx': `${sh.dx}px`,
                  '--dy': `${sh.dy}px`,
                  '--spin': `${sh.spin}deg`,
                }}
              />
            ))}
          </div>
        ) : (
          <div
            key={fb.pitch.uid}
            className={`ball-item-wrap fly-ball fly-${fb.kind}${fb.dir ? `-${fb.dir}` : ''} v${fb.variant ?? 0}${fb.grade ? ` ${fb.grade}` : ''}`}
            style={ballLaneLayout(0)}
            onAnimationEnd={() => setFlyBalls((balls) => balls.filter((b) => b !== fb))}
          >
            {renderBall(fb.pitch, 'ball-item', 'lane', fb.fever)}
          </div>
        ))}
      </div>

      {/* 좌/우 힌트 — 각 사이드 세로 중앙 정렬 */}
      <div className="hint-side left">{leftHints.map(renderHint)}</div>
      <div className="hint-side right">{rightHints.map(renderHint)}</div>

      {/* 타이머 — 피버 중엔 숨김(파워 버튼·중앙 초가 대신), 수박 타임엔 수박색 (바는 타이머 tick이 DOM 직접 갱신) */}
      <div className={`timer-wrap ${fever ? 'fever' : melonFront ? 'melon' : timerLevel}`}>
        <div className="timer-bar-area">
          <div className="timer-track">
            <div className="timer-bar" ref={timerBarRef} />
          </div>
          {/* 타격 등급 경계 표시 — 바 위 작은 픽셀 화살표, 남은 시간 2.7s(홈런) / 2.1s(2루타) / 0.7s(파울 시작) */}
          {!fever && !melonFront && (
            <div className="timer-zones" aria-hidden="true">
              <i className="hr" style={{ left: '90%' }} />
              <i className="double" style={{ left: '70%' }} />
              <i className="foul" style={{ left: '23.33%' }} />
            </div>
          )}
          {/* 홈런 — 바만 금빛으로 번쩍 */}
          {hrFlash > 0 && <div key={`hr-${hrFlash}`} className="timer-hr-flash" />}
        </div>
        <span className="timer-num">{timerNum}</span>
        {/* 초는 바 오른쪽, 바 아래는 수박 타임엔 연타 안내 / 평소엔 타격 결과 (자리는 항상 확보) */}
        {melonFront ? (
          <div className="fever-sub melon">마구 눌러요!</div>
        ) : (
          <div
            key={`hit-${hitLabel.id}`}
            className={`hit-label ${hitLabel.grade}`}
            style={{ opacity: hitLabel.visible ? 1 : 0 }}
          >
            {hitLabel.text || '\u00a0'}
          </div>
        )}
      </div>

      {/* 좌/우 버튼 + 타자 */}
      <div className="btn-row">
        <button
          className={`dir-btn${melonFront ? ' melon' : ''}${swingDir === 'left' ? ' pressed' : ''}`}
          onPointerDown={(e) => { e.preventDefault(); e.currentTarget.setPointerCapture?.(e.pointerId); press(`ptr-${e.pointerId}`, 'left') }}
          onPointerUp={(e) => release(`ptr-${e.pointerId}`, 'left')}
          onPointerCancel={(e) => release(`ptr-${e.pointerId}`, 'left')}
          aria-label="Left"
        >
          {melonFront && <span className="tap-badge left melon">TAP!</span>}
          <span className="dir-arrow left" />
        </button>
        <div className={`batter-slot${fever ? ' fever-active' : ''}`}>
          <div className={`batter-wrap${powerCharging ? ' charging' : ''}`}>
            {swingDir && <div key={swingId} className={`swing-trail ${swingDir}${powerSwinging ? ' power' : ''}`} />}
            <img className="batter-sprite" src={batterSrc} alt="batter" draggable={false} />
          </div>
          {/* 피버 차지 게이지 (채움은 gauge 루프에서 DOM 직접 갱신) */}
          <div ref={gaugeRef} className="fever-gauge power" aria-hidden="true">
            <span className="fever-gauge-label">FVR</span>
            <div className="fever-gauge-track">
              <div ref={gaugeFillRef} className="fever-gauge-fill" />
            </div>
          </div>
        </div>
        <button
          className={`dir-btn${melonFront ? ' melon' : ''}${swingDir === 'right' ? ' pressed' : ''}`}
          onPointerDown={(e) => { e.preventDefault(); e.currentTarget.setPointerCapture?.(e.pointerId); press(`ptr-${e.pointerId}`, 'right') }}
          onPointerUp={(e) => release(`ptr-${e.pointerId}`, 'right')}
          onPointerCancel={(e) => release(`ptr-${e.pointerId}`, 'right')}
          aria-label="Right"
        >
          {melonFront && <span className="tap-badge right melon">TAP!</span>}
          <span className="dir-arrow right" />
        </button>
        {/* 피버 — 좌우 버튼이 가로로 긴 버튼 하나로 합쳐짐 (방향 무관). 누르는 동안 왼쪽부터 금색으로 차오르며 %, 타자는 그 위에 올라섬 */}
        {fever && (
          <button
            className={`power-btn${powerCharging || powerSwinging ? ' charging' : ''}${powerCharging ? ' pressed' : ''}${feverReady ? ' ready' : ''}${shortTapId ? ' short' : ''}`}
            onPointerDown={(e) => { e.preventDefault(); e.currentTarget.setPointerCapture?.(e.pointerId); press(`ptr-${e.pointerId}`, lastDirRef.current) }}
            onPointerUp={(e) => release(`ptr-${e.pointerId}`, lastDirRef.current)}
            onPointerCancel={(e) => release(`ptr-${e.pointerId}`, lastDirRef.current)}
            aria-label="Power swing"
          >
            <span className="btn-fill" aria-hidden="true" />
            {/* 짧게 누를 때마다 글씨가 다시 흔들리도록 key (버튼 자체는 누르는 중 리마운트되면 안 됨) */}
            <span key={shortTapId} className="power-btn-label">
              {powerCharging || powerSwinging ? `${powerPct}%` : shortTapId ? '더 길게 꾹!' : '꾹 누르세요!'}
            </span>
          </button>
        )}
        {/* 피버 남은 초 — 파워 버튼 바깥 우측 위 (초가 바뀔 때마다 톡 튀고 마지막 1초는 빨갛게 깜빡임) */}
        {fever && !powerSwinging && (
          <div className="fever-clock">
            <span key={`fever-sec-${feverCountdown}`} className={`fever-sec${feverCountdown <= 1 ? ' last' : ''}`}>
              {feverCountdown}s
            </span>
          </div>
        )}
      </div>

      {/* 아웃 직후 붉은 비네트 */}
      {outFlash && <div key={`vignette-${outs}`} className="out-vignette" />}

      {/* 결과 팝업 */}
      <div
        key={`msg-${popMsg.id}`}
        className={`result-pop ${popMsg.tone}`}
        style={{ opacity: popMsg.visible ? 1 : 0 }}
      >
        {popMsg.text}
      </div>

      {/* 피버 — 준비 중 CHANCE!, 스윙하면 GRAND SLAM (피버가 끝나도 잠깐 유지) */}
      {fever && <div className="fever-overlay" />}
      {feverTitleOn && (
        <div className="fever-ui">
          {grandSlam ? (
            <div className="fever-title grand-slam">
              <span className="fever-title-text">GRAND SLAM</span>
            </div>
          ) : (
            <div className="fever-title chance">
              <span className="fever-title-text">CHANCE!</span>
            </div>
          )}
        </div>
      )}

      {/* 일시정지 — 반투명 블라인드 + 메뉴 */}
      {paused && (
        <div className="pause-overlay">
          <div className="pause-title">PAUSED</div>
          <div className="pause-menu">
            <button type="button" className="pause-menu-btn primary" onClick={resumeGame}>
              RESUME
            </button>
            <button
              type="button"
              className="pause-menu-btn"
              onClick={toggleSound}
              aria-pressed={!soundMuted}
            >
              <span
                className="pause-sound-icon"
                style={{
                  maskImage: `url("${soundMuted ? volumeXmarkIcon : volumeIcon}")`,
                  WebkitMaskImage: `url("${soundMuted ? volumeXmarkIcon : volumeIcon}")`,
                }}
              />
              SOUND {soundMuted ? 'OFF' : 'ON'}
            </button>
            {/* 진동 — 토스 앱 안에서만 동작하므로 웹에서는 숨김 */}
            {isHapticSupported() && (
              <button
                type="button"
                className="pause-menu-btn"
                onClick={toggleHaptic}
                aria-pressed={hapticOn}
              >
                <span
                  className="pause-sound-icon"
                  style={{
                    maskImage: `url("${hapticOn ? vibrateIcon : vibrateOffIcon}")`,
                    WebkitMaskImage: `url("${hapticOn ? vibrateIcon : vibrateOffIcon}")`,
                  }}
                />
                VIBRATION {hapticOn ? 'ON' : 'OFF'}
              </button>
            )}
            <button type="button" className="pause-menu-btn" onClick={onQuit}>
              QUIT
            </button>
          </div>
        </div>
      )}
    </div>
  )
}