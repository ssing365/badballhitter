import { useState, useEffect, useLayoutEffect, useRef, useCallback } from 'react'
import {
  QUEUE_SIZE, TIMER_MAX,
  calcScore, getActivePitches, assignDirsForTier, getPitchTierFromCombo, getPitchDir,
  PITCH_UNLOCK_TIERS, PITCHES, FASTBALL_REPLACED_AT_TIER, FASTBALL_REPLACEMENT,
  FEVER_COMBO_INTERVAL, FEVER_DURATION, createPitchBallImages, getPitchBallImage,
} from '../constants'
import './GameScreen.css'

// 공 대기열 레이아웃 — 앞(index 0)이 크고, 뒤로 갈수록 작게 겹침
const ballLaneLayout = (index) => ({
  top: `${86 - index * 5.5}%`,
  zIndex: 24 - index,
  '--ball-scale': `${1 - index * 0.085}`,
})

// 대기열을 채우는 유틸 (dir은 pitchDirs에서 항상 조회 — 큐에 방향을 고정 저장하지 않음)
const buildQueue = (existing, pitchTier, pitchDirs) => {
  const ids = getActivePitches(pitchTier, pitchDirs).map((p) => p.id)
  const result = [...existing]
  while (result.length < QUEUE_SIZE) {
    const id = ids[Math.floor(Math.random() * ids.length)]
    result.push({ ...PITCHES[id] })
  }
  return result
}

// 직구 → 포심 교체 시 대기열 내 공 변환
const migrateQueuePitch = (queue) =>
  queue.map((ball) =>
    ball.id === 'fastball' ? { ...PITCHES[FASTBALL_REPLACEMENT] } : ball
  )

export default function GameScreen({ onGameOver }) {
  // ── 게임 상태 ──
  const [score, setScore] = useState(0)
  const [combo, setCombo] = useState(0)
  const [maxCombo, setMaxCombo] = useState(0)
  const [outs, setOuts] = useState(0)
  const [classified, setClassified] = useState(0)
  const [correct, setCorrect] = useState(0)
  const [feverTaps, setFeverTaps] = useState(0)
  const [pitchTier, setPitchTier] = useState(0)
  const [pitchDirs, setPitchDirs] = useState(() => assignDirsForTier(0))
  const [pitchBallImages] = useState(() => createPitchBallImages())

  // ── UI 애니메이션 상태 ──
  const [queue, setQueue] = useState([])
  const [flyDir, setFlyDir] = useState(null)         // 'left' | 'right' | null
  const [pitcherThrowing, setPitcherThrowing] = useState(false)
  const [swingDir, setSwingDir] = useState(null)     // 'left' | 'right' | null
  const [popMsg, setPopMsg] = useState({ text: '', color: '', visible: false })
  const [timerPct, setTimerPct] = useState(100)
  const [timerColor, setTimerColor] = useState('#4ade80')
  const [timerNum, setTimerNum] = useState(TIMER_MAX.toFixed(1))
  const [fever, setFever] = useState(false)
  const [feverCountdown, setFeverCountdown] = useState(FEVER_DURATION)
  const [feverHitBall, setFeverHitBall] = useState(null) // 피버 연타 시 날아가는 공

  // ── ref로 최신 상태 참조 (클로저 문제 방지) ──
  const stateRef = useRef({})
  stateRef.current = { score, combo, maxCombo, outs, classified, correct, feverTaps, pitchTier, pitchDirs, queue, fever }

  const timerRaf = useRef(null)
  const timerStart = useRef(null)
  const feverTimer = useRef(null)
  const judgeLocked = useRef(false)  // 공 처리 중 중복 입력 방지
  const handleTimeoutRef = useRef(() => { })
  const swingTimeout = useRef(null)
  const feverHitTimeout = useRef(null)
  const feverActiveRef = useRef(false)

  // ── 타자 스윙 애니메이션 ──
  const triggerSwing = useCallback((dir) => {
    clearTimeout(swingTimeout.current)
    setSwingDir(dir)
    swingTimeout.current = setTimeout(() => setSwingDir(null), 280)
  }, [])

  // ── 팝업 표시 ──
  const showPop = useCallback((text, color) => {
    setPopMsg({ text, color, visible: true })
    setTimeout(() => setPopMsg((p) => ({ ...p, visible: false })), 850)
  }, [])

  // ── 타이머 시작 ──
  const startTimer = useCallback(() => {
    if (feverActiveRef.current) return
    cancelAnimationFrame(timerRaf.current)
    timerStart.current = performance.now()
    setTimerPct(100)
    setTimerNum(TIMER_MAX.toFixed(1))

    const tick = (now) => {
      if (feverActiveRef.current) {
        cancelAnimationFrame(timerRaf.current)
        return
      }
      const elapsed = (now - timerStart.current) / 1000
      const remaining = Math.max(0, TIMER_MAX - elapsed)
      const pct = (remaining / TIMER_MAX) * 100

      setTimerPct(pct)
      setTimerNum(remaining.toFixed(1))
      setTimerColor(remaining > 2 ? '#4ade80' : remaining > 1 ? '#facc15' : '#ef4444')

      if (remaining <= 0) {
        handleTimeoutRef.current()
        return
      }
      timerRaf.current = requestAnimationFrame(tick)
    }
    timerRaf.current = requestAnimationFrame(tick)
  }, [])

  // ── 피버 종료 ──
  const endFever = useCallback(() => {
    clearInterval(feverTimer.current)
    feverActiveRef.current = false
    setFever(false)
    const { feverTaps: taps } = stateRef.current
    showPop(`Fever +${taps * 50}!`, '#facc15')
    // 피버 종료 후 타이머 재시작
    setTimeout(() => startTimer(), 300)
  }, [showPop, startTimer])

  // ── 피버 시작 ──
  const startFever = useCallback(() => {
    feverActiveRef.current = true
    cancelAnimationFrame(timerRaf.current)
    setFever(true)
    setFeverCountdown(FEVER_DURATION)

    let t = FEVER_DURATION
    feverTimer.current = setInterval(() => {
      t -= 1
      setFeverCountdown(t)
      if (t <= 0) endFever()
    }, 1000)
  }, [endFever])

  // ── 게임 오버 ──
  const handleGameOver = useCallback(() => {
    cancelAnimationFrame(timerRaf.current)
    clearInterval(feverTimer.current)
    const s = stateRef.current
    // TODO: Supabase — save score
    // saveScore({ score: s.score, maxCombo: s.maxCombo })
    setTimeout(() => {
      onGameOver({
        score: s.score,
        correct: s.correct,
        classified: s.classified,
        maxCombo: s.maxCombo,
        feverTaps: s.feverTaps,
      })
    }, 400)
  }, [onGameOver])

  // ── 시간 초과 처리 ──
  const handleTimeout = useCallback(() => {
    if (feverActiveRef.current) return
    const { outs: curOuts, queue: curQueue, pitchTier: curPitchTier, pitchDirs: curPitchDirs } = stateRef.current
    setCombo(0)
    showPop('Time up!', '#ef4444')
    const newOuts = curOuts + 1
    setOuts(newOuts)
    if (newOuts >= 3) {
      handleGameOver()
      return
    }
    // 맨 앞 공 제거 후 보충
    const next = buildQueue(curQueue.slice(1), curPitchTier, curPitchDirs)
    setQueue(next)
    startTimer()
  }, [showPop, startTimer, handleGameOver])

  useLayoutEffect(() => {
    handleTimeoutRef.current = handleTimeout
  }, [handleTimeout])

  // ── 판정 로직 ──
  const judge = useCallback((dir) => {
    const { fever: isFever, queue: curQueue, combo: curCombo, score: curScore,
      maxCombo: curMax, classified: curCls, correct: curCrt,
      feverTaps: curTaps, pitchTier: curPitchTier, pitchDirs: curPitchDirs, outs: curOuts } = stateRef.current

    // 피버 중 — 좌우 구분 없이 연타, 공은 일반처럼 날아감 (아웃 없음)
    if (isFever) {
      triggerSwing(dir)
      const newTaps = curTaps + 1
      setFeverTaps(newTaps)
      setScore(curScore + 50)

      if (curQueue.length > 0) {
        clearTimeout(feverHitTimeout.current)
        setFeverHitBall({ dir, pitch: curQueue[0] })
        setQueue(buildQueue(curQueue.slice(1), curPitchTier, curPitchDirs))
        feverHitTimeout.current = setTimeout(() => setFeverHitBall(null), 220)
      }
      return
    }

    if (judgeLocked.current || curQueue.length === 0) return
    judgeLocked.current = true
    cancelAnimationFrame(timerRaf.current)

    const bt = curQueue[0]
    const isCorrect = dir === getPitchDir(bt.id, curPitchDirs)

    // 공 날아가는 애니메이션
    setFlyDir(dir)

    // 투수 동작
    setPitcherThrowing(true)
    setTimeout(() => setPitcherThrowing(false), 250)

    // 타자 스윙
    triggerSwing(dir)

    const newClassified = curCls + 1

    let nextPitchTier = curPitchTier
    let nextPitchDirs = curPitchDirs

    if (isCorrect) {
      const newCombo = curCombo + 1
      const newMax = Math.max(newCombo, curMax)
      const pts = calcScore(newCombo)
      const newScore = curScore + pts
      const newCorrect = curCrt + 1

      setCombo(newCombo)
      setMaxCombo(newMax)
      setScore(newScore)
      setCorrect(newCorrect)
      setClassified(newClassified)
      showPop(newCombo > 1 ? `${newCombo} combo! +${pts}` : `Nice! +${pts}`, '#4ade80')

      // 피버 발동
      if (newCombo % FEVER_COMBO_INTERVAL === 0) {
        setTimeout(() => startFever(), 200)
      }

      // 콤보 기준 구종 해금 (20콤보마다 2구종)
      const unlockedTier = getPitchTierFromCombo(newCombo)
      if (unlockedTier > curPitchTier) {
        nextPitchTier = unlockedTier
        nextPitchDirs = assignDirsForTier(unlockedTier, curPitchDirs)
        setPitchTier(unlockedTier)
        setPitchDirs(nextPitchDirs)

        const addedLabels = []
        for (let t = curPitchTier + 1; t <= unlockedTier; t++) {
          addedLabels.push(...PITCH_UNLOCK_TIERS[t].map((id) => PITCHES[id].label))
        }
        let unlockMsg = `New pitches! ${addedLabels.join(', ')}`
        if (unlockedTier >= FASTBALL_REPLACED_AT_TIER && curPitchTier < FASTBALL_REPLACED_AT_TIER) {
          unlockMsg += ' / Fastball → 4-Seam'
        }
        setTimeout(() => showPop(unlockMsg, '#facc15'), 450)
      }
    } else {
      const newOuts = curOuts + 1
      setCombo(0)
      setClassified(newClassified)
      showPop('Miss! ❌', '#ef4444')
      setOuts(newOuts)
      if (newOuts >= 3) {
        setTimeout(() => handleGameOver(), 300)
        judgeLocked.current = false
        return
      }
    }

    // 200ms 후 공 제거 및 다음 공 준비
    setTimeout(() => {
      setFlyDir(null)
      let sliced = curQueue.slice(1)
      if (nextPitchTier >= FASTBALL_REPLACED_AT_TIER && curPitchTier < FASTBALL_REPLACED_AT_TIER) {
        sliced = migrateQueuePitch(sliced)
      }
      const next = buildQueue(sliced, nextPitchTier, nextPitchDirs)
      setQueue(next)
      judgeLocked.current = false
      if (!feverActiveRef.current) startTimer()
    }, 200)
  }, [showPop, startFever, handleGameOver, startTimer, triggerSwing])

  // ── 초기화 ──
  useEffect(() => {
    const initial = buildQueue([], 0, pitchDirs)
    setQueue(initial)
    startTimer()
    return () => {
      cancelAnimationFrame(timerRaf.current)
      clearInterval(feverTimer.current)
      clearTimeout(swingTimeout.current)
      clearTimeout(feverHitTimeout.current)
    }
  }, []) // eslint-disable-line

  // ── 키보드 입력 ──
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') { e.preventDefault(); judge('left') }
      if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') { e.preventDefault(); judge('right') }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [judge])

  // ── 활성 구종 힌트 계산 ──
  const activeTypes = getActivePitches(pitchTier, pitchDirs)
  const leftHints = activeTypes.filter((t) => t.dir === 'left')
  const rightHints = activeTypes.filter((t) => t.dir === 'right')

  const batterSrc =
    swingDir === 'left' ? '/assets/batter_swing_l.png'
      : swingDir === 'right' ? '/assets/batter_swing_r.png'
        : '/assets/batter_idle.png'

  const pitcherSrc = '/assets/pitcher_idle.png'

  const renderBall = (pitch, className, size = 'lane') => {
    const img = getPitchBallImage(pitch.id, pitchBallImages)
    if (img) {
      return (
        <div className={`${className} has-img`}>
          <img src={img} className={`ball-sprite ${size}`} alt="" draggable={false} />
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

  return (
    <div className="game-screen">

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
        <div className="hud-right">
          <span className="hud-label">SCORE</span>
          <div className="hud-score">{score.toLocaleString()}</div>
        </div>
      </div>

      {/* 투수 */}
      <div className="pitcher-area">
        <img
          className={`pitcher-sprite ${pitcherThrowing ? 'throwing' : ''}`}
          src={pitcherSrc}
          alt="투수"
          draggable={false}
        />
      </div>

      {/* 공 레인 */}
      <div className="ball-lane">
        {queue.map((bt, i) => (
          <div
            key={`${bt.id}-${i}`}
            className={`ball-item-wrap depth-${i}${i === 0 && flyDir ? ` fly-${flyDir}` : ''}`}
            style={ballLaneLayout(i)}
          >
            {renderBall(bt, 'ball-item', 'lane')}
          </div>
        ))}
        {feverHitBall && (
          <div
            className={`ball-item-wrap depth-0 fly-${feverHitBall.dir} fever-hit`}
            style={ballLaneLayout(0)}
          >
            {renderBall(feverHitBall.pitch, 'ball-item', 'lane')}
          </div>
        )}
      </div>

      {/* 좌측 힌트 */}
      <div className="hint-side left">
        {leftHints.map((bt) => (
          <div key={bt.id}>
            {renderBall(bt, 'hint-ball', 'hint')}
            <div className="hint-lbl">{bt.label}</div>
          </div>
        ))}
      </div>

      {/* 우측 힌트 */}
      <div className="hint-side right">
        {rightHints.map((bt) => (
          <div key={bt.id}>
            {renderBall(bt, 'hint-ball', 'hint')}
            <div className="hint-lbl">{bt.label}</div>
          </div>
        ))}
      </div>

      {/* 타이머 — 피버 중에는 숨김 */}
      {!fever && (
        <div className="timer-wrap">
          <div className="timer-track">
            <div
              className="timer-bar"
              style={{ width: `${timerPct}%`, background: timerColor }}
            />
          </div>
          <span className="timer-num">{timerNum}</span>
        </div>
      )}

      {/* 좌/우 버튼 + 타자 */}
      <div className="btn-row">
        <button
          className={`dir-btn ${swingDir === 'left' ? 'pressed' : ''}`}
          onClick={() => judge('left')}
        >
          ◀
        </button>
        <img className="batter-sprite" src={batterSrc} alt="batter" draggable={false} />
        <button
          className={`dir-btn ${swingDir === 'right' ? 'pressed' : ''}`}
          onClick={() => judge('right')}
        >
          ▶
        </button>
      </div>

      {/* 결과 팝업 */}
      <div
        className="result-pop"
        style={{ color: popMsg.color, opacity: popMsg.visible ? 1 : 0 }}
      >
        {popMsg.text}
      </div>

      {/* 피버 */}
      {fever && (
        <>
          <div className="fever-overlay" />
          <div className="fever-ui">
            <div className="fever-title">🔥 FEVER!</div>
            <div className="fever-sub">Tap away!</div>
            <div className="fever-count">{feverCountdown}</div>
          </div>
        </>
      )}
    </div>
  )
}