import { useState, useEffect, useLayoutEffect, useRef, useCallback } from 'react'
import {
  QUEUE_SIZE, TIMER_MAX,
  calcScore, getActivePitches, assignDirsForStep, getUnlockStep, getPitchDir,
  PITCH_UNLOCK_ORDER, PITCHES,
  FEVER_FIRST_RANGE, FEVER_GAP_RANGE, FEVER_UNLOCK_DELAY, FEVER_DURATION, randInt, createPitchBallImages, getPitchBallImage,
  FEVER_TAP_POINTS, calcBatSpeed,
} from '../constants'
import Crowd from './Crowd'
import Fielders from './Fielders'
import './GameScreen.css'

// 공 대기열 레이아웃 — 앞(index 0)이 크고, 뒤로 갈수록 작게 겹침
const ballLaneLayout = (index) => ({
  top: `${86 - index * 5.5}%`,
  zIndex: 24 - index,
  '--ball-scale': `${1 - index * 0.085}`,
})

// 공마다 고유 uid — 렌더 key로 사용 (같은 구종이 연속돼도 공 교체가 보이도록)
let ballUid = 0
const nextBallUid = () => ++ballUid

// 대기열을 채우는 유틸 (dir은 pitchDirs에서 항상 조회 — 큐에 방향을 고정 저장하지 않음)
const buildQueue = (existing, unlockStep, pitchDirs) => {
  const ids = getActivePitches(unlockStep, pitchDirs).map((p) => p.id)
  const result = [...existing]
  while (result.length < QUEUE_SIZE) {
    const id = ids[Math.floor(Math.random() * ids.length)]
    result.push({ ...PITCHES[id], uid: nextBallUid() })
  }
  return result
}

export default function GameScreen({ onGameOver }) {
  // ── 게임 상태 ──
  const [score, setScore] = useState(0)
  const [combo, setCombo] = useState(0)
  const [maxCombo, setMaxCombo] = useState(0)
  const [outs, setOuts] = useState(0)
  const [classified, setClassified] = useState(0)
  const [correct, setCorrect] = useState(0)
  const [feverTaps, setFeverTaps] = useState(0)
  const [unlockStep, setUnlockStep] = useState(0)
  const [pitchDirs, setPitchDirs] = useState(() => assignDirsForStep(0))
  const [pitchBallImages] = useState(() => createPitchBallImages())

  // ── UI 애니메이션 상태 ──
  const [queue, setQueue] = useState([])
  const [flyDir, setFlyDir] = useState(null)         // 'left' | 'right' | null
  const [pitcherThrowing, setPitcherThrowing] = useState(false)
  const [swingDir, setSwingDir] = useState(null)     // 'left' | 'right' | null
  const [popMsg, setPopMsg] = useState({ id: 0, text: '', color: '', visible: false })
  const [timerColor, setTimerColor] = useState('#4ade80')
  const [timerNum, setTimerNum] = useState(TIMER_MAX.toFixed(1))
  const [fever, setFever] = useState(false)
  const [feverCountdown, setFeverCountdown] = useState(FEVER_DURATION)
  const [feverHitBalls, setFeverHitBalls] = useState([]) // 피버 연타 시 날아가는 공들
  const [outFlash, setOutFlash] = useState(false)         // 아웃 직후 연출 (투수 비웃기·화면 흔들림 등)
  const [swingId, setSwingId] = useState(0)                // 스윙마다 증가 — 스윙 궤적 재생용 key

  // ── ref로 최신 상태 참조 (클로저 문제 방지) ──
  const stateRef = useRef({})
  stateRef.current = { score, combo, maxCombo, outs, classified, correct, feverTaps, unlockStep, pitchDirs, queue, fever }

  const timerRaf = useRef(null)
  const timerBarRef = useRef(null)  // 바 너비는 매 프레임 DOM 직접 갱신 (리렌더 없이)
  const timerStart = useRef(null)
  const feverTimer = useRef(null)
  const judgeLocked = useRef(false)  // 공 처리 중 중복 입력 방지
  const handleTimeoutRef = useRef(() => { })
  const swingTimeout = useRef(null)
  const feverActiveRef = useRef(false)
  const nextFeverAtRef = useRef(randInt(FEVER_FIRST_RANGE))  // 다음 피버 발동 콤보
  const popTimeout = useRef(null)
  const reactionRef = useRef({ sum: 0, count: 0 })  // 정답 스윙 반응시간 누적 (Bat Speed용)

  // ── 타자 스윙 애니메이션 ──
  const triggerSwing = useCallback((dir) => {
    clearTimeout(swingTimeout.current)
    setSwingDir(dir)
    setSwingId((n) => n + 1)
    swingTimeout.current = setTimeout(() => setSwingDir(null), 280)
  }, [])

  // ── 팝업 표시 ──
  // id 증가로 매번 등장 애니메이션 재생, 이전 팝업의 숨김 타이머는 취소
  const showPop = useCallback((text, color) => {
    clearTimeout(popTimeout.current)
    setPopMsg((p) => ({ id: p.id + 1, text, color, visible: true }))
    popTimeout.current = setTimeout(() => setPopMsg((p) => ({ ...p, visible: false })), 850)
  }, [])

  // ── 타이머 시작 ──
  const startTimer = useCallback(() => {
    if (feverActiveRef.current) return
    cancelAnimationFrame(timerRaf.current)
    timerStart.current = performance.now()
    if (timerBarRef.current) timerBarRef.current.style.transform = 'scaleX(1)'
    setTimerColor('#4ade80')
    setTimerNum(TIMER_MAX.toFixed(1))

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
    showPop(`FEVER +${(taps * FEVER_TAP_POINTS).toLocaleString()}`, '#facc15')
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
    const { sum, count } = reactionRef.current
    // TODO: Supabase — save score (결과 화면의 finalScore 기준)
    setTimeout(() => {
      onGameOver({
        score: s.score,
        correct: s.correct,
        classified: s.classified,
        maxCombo: s.maxCombo,
        feverTaps: s.feverTaps,
        unlockStep: s.unlockStep,
        batSpeed: count > 0 ? calcBatSpeed(sum / count) : null,
        pitchBallImages,
      })
    }, 400)
  }, [onGameOver, pitchBallImages])

  // ── 시간 초과 처리 ──
  const handleTimeout = useCallback(() => {
    if (feverActiveRef.current) return
    const { outs: curOuts, queue: curQueue, unlockStep: curUnlockStep, pitchDirs: curPitchDirs } = stateRef.current
    setCombo(0)
    nextFeverAtRef.current = randInt(FEVER_FIRST_RANGE)
    showPop('TIME UP!', '#ef4444')
    const newOuts = curOuts + 1
    setOuts(newOuts)
    if (newOuts >= 3) {
      handleGameOver()
      return
    }
    // 맨 앞 공 제거 후 보충
    const next = buildQueue(curQueue.slice(1), curUnlockStep, curPitchDirs)
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
      feverTaps: curTaps, unlockStep: curUnlockStep, pitchDirs: curPitchDirs, outs: curOuts } = stateRef.current

    // 피버 중 — 좌우 구분 없이 연타, 공은 일반처럼 날아감 (아웃 없음)
    if (isFever) {
      triggerSwing(dir)
      const newTaps = curTaps + 1
      const newScore = curScore + FEVER_TAP_POINTS
      setFeverTaps(newTaps)
      setScore(newScore)

      let nextQueue = curQueue
      if (curQueue.length > 0) {
        const hitBall = curQueue[0]
        nextQueue = buildQueue(curQueue.slice(1), curUnlockStep, curPitchDirs)
        setFeverHitBalls((balls) => [...balls, { dir, pitch: hitBall }])
        setQueue(nextQueue)
      }
      // 리렌더 전에 다음 탭이 들어와도 최신 값으로 판정하도록 즉시 반영
      stateRef.current = { ...stateRef.current, feverTaps: newTaps, score: newScore, queue: nextQueue }
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

    let nextUnlockStep = curUnlockStep
    let nextPitchDirs = curPitchDirs

    if (isCorrect) {
      reactionRef.current.sum += performance.now() - timerStart.current
      reactionRef.current.count += 1
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
      showPop(`+${pts}`, '#4ade80')

      // 구종 해금 (첫 공은 콤보, 이후는 점수 기준)
      const reachedStep = getUnlockStep(curUnlockStep, newCombo, newScore)
      const isUnlocking = reachedStep > curUnlockStep

      // 피버 발동 — 해금과 겹치면 새 구종을 먼저 보여주도록 미룸
      if (newCombo >= nextFeverAtRef.current) {
        if (isUnlocking) {
          nextFeverAtRef.current = newCombo + FEVER_UNLOCK_DELAY
        } else {
          nextFeverAtRef.current = newCombo + randInt(FEVER_GAP_RANGE)
          setTimeout(() => startFever(), 200)
        }
      }

      if (isUnlocking) {
        nextUnlockStep = reachedStep
        nextPitchDirs = assignDirsForStep(reachedStep, curPitchDirs)
        setUnlockStep(reachedStep)
        setPitchDirs(nextPitchDirs)

        const addedLabels = PITCH_UNLOCK_ORDER.slice(curUnlockStep, reachedStep)
          .map((id) => PITCHES[id].label)
        setTimeout(() => showPop(`NEW PITCH!\n${addedLabels.join(', ')}`, '#facc15'), 450)
      }
    } else {
      const newOuts = curOuts + 1
      setCombo(0)
      nextFeverAtRef.current = randInt(FEVER_FIRST_RANGE)
      setClassified(newClassified)
      showPop('MISS!', '#ef4444')
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
      const next = buildQueue(curQueue.slice(1), nextUnlockStep, nextPitchDirs)
      setQueue(next)
      judgeLocked.current = false
      if (!feverActiveRef.current) startTimer()
    }, 200)
  }, [showPop, startFever, handleGameOver, startTimer, triggerSwing])

  // ── 초기화 ──
  useEffect(() => {
    new Image().src = '/assets/feverpitcher.png'  // 30콤보 진입 시 교체 지연 방지
    const initial = buildQueue([], 0, pitchDirs)
    setQueue(initial)
    startTimer()
    return () => {
      cancelAnimationFrame(timerRaf.current)
      clearInterval(feverTimer.current)
      clearTimeout(swingTimeout.current)
      clearTimeout(popTimeout.current)
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
  const activeTypes = getActivePitches(unlockStep, pitchDirs)
  // 최신 해금 구종이 위로 오도록 역순
  const leftHints = activeTypes.filter((t) => t.dir === 'left').reverse()
  const rightHints = activeTypes.filter((t) => t.dir === 'right').reverse()

  const batterSrc =
    swingDir === 'left' ? '/assets/batter_swing_l.png'
      : swingDir === 'right' ? '/assets/batter_swing_r.png'
        : '/assets/batter_idle.png'

  // 30콤보+/피버엔 땀 흘리는 투수
  const pitcherSweat = fever || combo >= 30
  const pitcherSrc = pitcherSweat ? '/assets/feverpitcher.png' : '/assets/pitcher_idle.png'

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

  // 아웃 당하면 잠깐 아웃 연출
  useEffect(() => {
    if (outs === 0) return
    setOutFlash(true)
    const t = setTimeout(() => setOutFlash(false), 1200)
    return () => clearTimeout(t)
  }, [outs])

  // 화면 연출 단계 — 아웃 직후 > 피버 > 30콤보+ > 평소 (.game-screen의 scene-* 클래스로 CSS에서 처리)
  const sceneMood = outFlash ? 'out' : fever ? 'fever' : combo >= 30 ? 'hype' : 'normal'
  // 관중 분위기 — 피버 > 30콤보+ > 10콤보+ > 평소
  const crowdMood = fever ? 'fever' : combo >= 30 ? 'hype' : combo >= 10 ? 'warm' : 'calm'

  // 10콤보마다 콤보 숫자 스타일 단계 상승 (최대 5)
  const comboLevel = Math.min(Math.floor(combo / 10), 5)
  const scoreText = score.toLocaleString()

  // 힌트 아이템 — 중앙 기준 오프셋으로 배치 (새 공이 위에 추가되면 기존 공이 내려감)
  const renderHint = (bt, i, list) => (
    <div
      key={bt.id}
      className="hint-item"
      style={{ '--hint-offset': i - (list.length - 1) / 2 }}
    >
      <div className="hint-pop">
        {renderBall(bt, 'hint-ball', 'hint')}
        <div className="hint-lbl">{bt.label}</div>
      </div>
    </div>
  )

  return (
    <div className={`game-screen scene-${sceneMood}`}>
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
        <div className="hud-right">
          <span className="hud-label combo-label">COMBO</span>
          <div className={`hud-combo combo-lv-${comboLevel}${combo === 0 ? ' zero' : ''}`}>
            <span key={combo} className="combo-num">{combo}</span>
          </div>
        </div>
      </div>

      {/* 배경 전광판 위 점수 */}
      <div className="scoreboard">
        <span className="scoreboard-label">SCORE</span>
        <span
          key={score}
          className={`scoreboard-num${scoreText.length > 7 ? ' long' : ''}`}
        >
          {scoreText}
        </span>
      </div>

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

      {/* 공 레인 */}
      <div className="ball-lane">
        {queue.map((bt, i) => (
          <div
            key={bt.uid}
            className={`ball-item-wrap depth-${i}${i === 0 && flyDir ? ` fly-${flyDir}` : ''}`}
            style={ballLaneLayout(i)}
          >
            {renderBall(bt, 'ball-item', 'lane')}
          </div>
        ))}
        {feverHitBalls.map((hit) => (
          <div
            key={hit.pitch.uid}
            className={`ball-item-wrap fever-hit fever-fly-${hit.dir}`}
            style={ballLaneLayout(0)}
            onAnimationEnd={() => setFeverHitBalls((balls) => balls.filter((b) => b !== hit))}
          >
            {renderBall(hit.pitch, 'ball-item', 'lane')}
          </div>
        ))}
      </div>

      {/* 좌/우 힌트 — 각 사이드 세로 중앙 정렬 */}
      <div className="hint-side left">{leftHints.map(renderHint)}</div>
      <div className="hint-side right">{rightHints.map(renderHint)}</div>

      {/* 타이머 — 피버 중에는 숨김 */}
      {!fever && (
        <div className="timer-wrap">
          <div className="timer-track">
            <div
              className="timer-bar"
              ref={timerBarRef}
              style={{ background: timerColor }}
            />
          </div>
          <span className="timer-num">{timerNum}</span>
        </div>
      )}

      {/* 좌/우 버튼 + 타자 */}
      <div className="btn-row">
        <button
          className={`dir-btn ${swingDir === 'left' ? 'pressed' : ''}`}
          onPointerDown={(e) => { e.preventDefault(); judge('left') }}
          aria-label="Left"
        >
          <span className="dir-arrow left" />
        </button>
        <div className="batter-wrap">
          {swingDir && <div key={swingId} className={`swing-trail ${swingDir}`} />}
          <img className="batter-sprite" src={batterSrc} alt="batter" draggable={false} />
        </div>
        <button
          className={`dir-btn ${swingDir === 'right' ? 'pressed' : ''}`}
          onPointerDown={(e) => { e.preventDefault(); judge('right') }}
          aria-label="Right"
        >
          <span className="dir-arrow right" />
        </button>
      </div>

      {/* 아웃 직후 붉은 비네트 */}
      {outFlash && <div key={outs} className="out-vignette" />}

      {/* 결과 팝업 */}
      <div
        key={popMsg.id}
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