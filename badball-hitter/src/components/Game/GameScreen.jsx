import { useState, useEffect, useLayoutEffect, useRef, useCallback } from 'react'
import {
  BALL_TYPES, QUEUE_SIZE, TIMER_MAX,
  calcScore, getActiveTypes,
  FEVER_COMBO_INTERVAL, FEVER_DURATION, PHASE2_THRESHOLD,
} from '../constants'
import './GameScreen.css'

// 공 대기열에서 최하단(플레이어 앞) 공의 top % 위치
const ballTop = (index) => 88 - index * 13

// 대기열을 채우는 유틸
const buildQueue = (existing, phase) => {
  const types = getActiveTypes(phase)
  const result = [...existing]
  while (result.length < QUEUE_SIZE) {
    result.push(types[Math.floor(Math.random() * types.length)])
  }
  return result
}

export default function GameScreen({ team, onGameOver }) {
  // ── 게임 상태 ──
  const [score, setScore] = useState(0)
  const [combo, setCombo] = useState(0)
  const [maxCombo, setMaxCombo] = useState(0)
  const [outs, setOuts] = useState(0)
  const [classified, setClassified] = useState(0)
  const [correct, setCorrect] = useState(0)
  const [feverTaps, setFeverTaps] = useState(0)
  const [phase, setPhase] = useState(1)

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

  // ── ref로 최신 상태 참조 (클로저 문제 방지) ──
  const stateRef = useRef({})
  stateRef.current = { score, combo, maxCombo, outs, classified, correct, feverTaps, phase, queue, fever }

  const timerRaf = useRef(null)
  const timerStart = useRef(null)
  const feverTimer = useRef(null)
  const judgeLocked = useRef(false)  // 공 처리 중 중복 입력 방지
  const handleTimeoutRef = useRef(() => { })

  // ── 팝업 표시 ──
  const showPop = useCallback((text, color) => {
    setPopMsg({ text, color, visible: true })
    setTimeout(() => setPopMsg((p) => ({ ...p, visible: false })), 850)
  }, [])

  // ── 타이머 시작 ──
  const startTimer = useCallback(() => {
    cancelAnimationFrame(timerRaf.current)
    timerStart.current = performance.now()
    setTimerPct(100)
    setTimerNum(TIMER_MAX.toFixed(1))

    const tick = (now) => {
      const elapsed = (now - timerStart.current) / 1000
      const remaining = Math.max(0, TIMER_MAX - elapsed)
      const pct = (remaining / TIMER_MAX) * 100

      setTimerPct(pct)
      setTimerNum(remaining.toFixed(1))
      setTimerColor(pct > 50 ? '#4ade80' : pct > 25 ? '#facc15' : '#ef4444')

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
    setFever(false)
    const { feverTaps: taps } = stateRef.current
    showPop(`피버 +${taps * 50}점!`, '#facc15')
    // 피버 종료 후 타이머 재시작
    setTimeout(() => startTimer(), 300)
  }, [showPop, startTimer])

  // ── 피버 시작 ──
  const startFever = useCallback(() => {
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
    // TODO: Supabase — 점수 저장
    // saveScore({ teamId: team.id, score: s.score, maxCombo: s.maxCombo })
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
    const { outs: curOuts, queue: curQueue, phase: curPhase } = stateRef.current
    setCombo(0)
    showPop('시간 초과!', '#ef4444')
    const newOuts = curOuts + 1
    setOuts(newOuts)
    if (newOuts >= 3) {
      handleGameOver()
      return
    }
    // 맨 앞 공 제거 후 보충
    const next = buildQueue(curQueue.slice(1), curPhase)
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
      feverTaps: curTaps, phase: curPhase, outs: curOuts } = stateRef.current

    // 피버 중엔 탭 카운트
    if (isFever) {
      const newTaps = curTaps + 1
      setFeverTaps(newTaps)
      setScore(curScore + 50)
      return
    }

    if (judgeLocked.current || curQueue.length === 0) return
    judgeLocked.current = true
    cancelAnimationFrame(timerRaf.current)

    const bt = curQueue[0]
    const isCorrect = dir === bt.dir

    // 공 날아가는 애니메이션
    setFlyDir(dir)

    // 투수 동작
    setPitcherThrowing(true)
    setTimeout(() => setPitcherThrowing(false), 250)

    // 타자 스윙
    setSwingDir(dir)
    setTimeout(() => setSwingDir(null), 280)

    const newClassified = curCls + 1

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
      showPop(newCombo > 1 ? `${newCombo}연속! +${pts}` : `좋아! +${pts}`, '#4ade80')

      // 피버 발동
      if (newCombo % FEVER_COMBO_INTERVAL === 0) {
        setTimeout(() => startFever(), 200)
      }

      // 페이즈 2 전환
      if (newClassified >= PHASE2_THRESHOLD && curPhase === 1) {
        setPhase(2)
        showPop('난이도 UP! 구종 추가!', '#facc15')
      }
    } else {
      const newOuts = curOuts + 1
      setCombo(0)
      setClassified(newClassified)
      showPop('틀렸어! ❌', '#ef4444')
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
      const newPhase = isCorrect && newClassified >= PHASE2_THRESHOLD ? 2 : curPhase
      const next = buildQueue(curQueue.slice(1), newPhase)
      setQueue(next)
      judgeLocked.current = false
      if (!stateRef.current.fever) startTimer()
    }, 200)
  }, [showPop, startFever, handleGameOver, startTimer])

  // ── 초기화 ──
  useEffect(() => {
    const initial = buildQueue([], 1)
    setQueue(initial)
    startTimer()
    return () => {
      cancelAnimationFrame(timerRaf.current)
      clearInterval(feverTimer.current)
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
  const activeTypes = getActiveTypes(phase)
  const leftHints = activeTypes.filter((t) => t.dir === 'left')
  const rightHints = activeTypes.filter((t) => t.dir === 'right')

  const batterSrc =
    swingDir === 'left' ? '/assets/batter_swing_l.png'
      : swingDir === 'right' ? '/assets/batter_swing_r.png'
        : '/assets/batter_idle.png'

  return (
    <div className="game-screen">
      {/* 배경 */}
      <div className="bg-sky" />
      <div className="bg-grass" />
      <div className="bg-dirt" />
      <div className="bg-mound" />

      {/* HUD */}
      <div className="hud">
        <div className="hud-left">
          <span className="hud-label">아웃</span>
          <div className="out-row">
            {[1, 2, 3].map((n) => (
              <div key={n} className={`out-dot ${outs >= n ? 'active' : ''}`} />
            ))}
          </div>
          <div className="combo-badge">
            {combo > 0 ? `${combo}콤보🔥` : '콤보 0'}
          </div>
        </div>
        <div className="hud-right">
          <span className="hud-label">SCORE</span>
          <div className="hud-score">{score.toLocaleString()}</div>
        </div>
      </div>

      {/* 투수 */}
      <div className="pitcher-area">
        <div className={`pitcher-fig ${pitcherThrowing ? 'throwing' : ''}`}>🧑‍⚾</div>
      </div>

      {/* 공 레인 */}
      <div className="ball-lane">
        {queue.map((bt, i) => (
          <div
            key={`${bt.id}-${i}`}
            className={`ball-item${i === 0 && flyDir ? ` fly-${flyDir}` : ''}`}
            style={{
              top: `${ballTop(i)}%`,
              background: bt.color,
              borderColor: bt.border,
            }}
          >
            {bt.text}
          </div>
        ))}
      </div>

      {/* 좌측 힌트 */}
      <div className="hint-side left">
        <span className="hint-arrow">◀</span>
        {leftHints.map((bt) => (
          <div key={bt.id}>
            <div className="hint-ball" style={{ background: bt.color, borderColor: bt.border }}>
              {bt.text}
            </div>
            <div className="hint-lbl">{bt.label}</div>
          </div>
        ))}
      </div>

      {/* 우측 힌트 */}
      <div className="hint-side right">
        <span className="hint-arrow">▶</span>
        {rightHints.map((bt) => (
          <div key={bt.id}>
            <div className="hint-ball" style={{ background: bt.color, borderColor: bt.border }}>
              {bt.text}
            </div>
            <div className="hint-lbl">{bt.label}</div>
          </div>
        ))}
      </div>

      {/* 타이머 */}
      <div className="timer-wrap">
        <div className="timer-track">
          <div
            className="timer-bar"
            style={{ width: `${timerPct}%`, background: timerColor }}
          />
        </div>
        <span className="timer-num">{timerNum}</span>
      </div>

      {/* 좌/우 버튼 + 타자 */}
      <div className="btn-row">
        <button className="dir-btn" onClick={() => judge('left')}>◀</button>
        <img className="batter-sprite" src={batterSrc} alt="타자" draggable={false} />
        <button className="dir-btn" onClick={() => judge('right')}>▶</button>
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
            <div className="fever-sub">화면을 연타!</div>
            <div className="fever-count">{feverCountdown}</div>
          </div>
        </>
      )}
    </div>
  )
}