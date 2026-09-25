import { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import { getGrade, calcFinalBreakdown, getUnlockedPitchIds, PITCH_UNLOCKS, PITCHES } from '../constants'
import { playSfx, playScoreDing, playFinalScoreDing, duckBgm } from '../../lib/sound'
import './GameResult.css'

// TODO: Supabase — save score on game over (finalScore 기준)
// import { saveScore } from '../lib/supabase'

const BEST_SCORE_KEY = 'bestScore'
const SHARE_URL = 'https://badballhitter.vercel.app/'
const TOAST_DURATION_MS = 2000

// 카운트업 연출 — 첫 행(타격 점수)은 길게, 보너스 행은 짧게
const STAGE_MS = [1200, 500, 500, 500]
const EMPTY_STAGE_MS = 150  // 점수 0인 행
const STAGE_GAP_MS = 250
const SKIP_GUARD_MS = 500   // 게임 중 연타가 바로 스킵으로 이어지지 않도록
const FANFARE_DELAY_MS = 600 // 최종 점수·도장 소리 뒤에 팡파르

// 전 구종 (해금 순서) — 등급 아래 공 슬롯
const ALL_PITCH_IDS = getUnlockedPitchIds(PITCH_UNLOCKS.length)

// 저장된 최고 기록 읽기 (없거나 접근 불가하면 null)
function readBestScore() {
  try {
    const raw = localStorage.getItem(BEST_SCORE_KEY)
    if (raw === null) return null
    const n = Number(raw)
    return Number.isFinite(n) ? n : null
  } catch {
    return null
  }
}

function prefersReducedMotion() {
  return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false
}

const easeOutCubic = (t) => 1 - (1 - t) ** 3

export default function GameResult({ stats, onRetry, onHome }) {
  const { unlockStep = 0, pitchBallImages = {} } = stats
  const grade = getGrade(unlockStep)
  const { rows, finalScore } = useMemo(() => calcFinalBreakdown(stats), [stats])

  // 행별 누적 점수 (cumulative[i] = i번째 행 시작값)
  const cumulative = useMemo(() => {
    const acc = [0]
    rows.forEach((r) => acc.push(acc[acc.length - 1] + r.pts))
    return acc
  }, [rows])

  // 마운트 시 1회만 이전 기록과 비교 (렌더 중에는 읽기만)
  const [{ best, isNewRecord }] = useState(() => {
    const prev = readBestScore()
    const isNewRecord = finalScore > (prev ?? 0)
    return { best: isNewRecord ? finalScore : prev, isNewRecord }
  })

  // 신기록이면 localStorage 갱신
  useEffect(() => {
    if (!isNewRecord) return
    try {
      localStorage.setItem(BEST_SCORE_KEY, String(finalScore))
    } catch {
      // 저장 실패는 무시 (프라이빗 모드 등)
    }
  }, [isNewRecord, finalScore])

  // ── 점수 카운트업 ──
  // stage = 현재 올라가는 행 index, rows.length면 연출 완료
  const [stage, setStage] = useState(() => (prefersReducedMotion() ? rows.length : 0))
  const [shown, setShown] = useState(0)
  const done = stage >= rows.length
  const displayScore = done ? finalScore : shown

  useEffect(() => {
    if (stage >= rows.length) return
    const from = cumulative[stage]
    const to = cumulative[stage + 1]
    const dur = to === from ? EMPTY_STAGE_MS : STAGE_MS[stage]
    const start = performance.now()
    let raf = null
    let gapTimeout = null
    const tick = (now) => {
      const t = Math.min(1, (now - start) / dur)
      setShown(Math.round(from + (to - from) * easeOutCubic(t)))
      if (t < 1) {
        raf = requestAnimationFrame(tick)
      } else {
        playScoreDing(stage)
        gapTimeout = setTimeout(() => setStage((s) => s + 1), STAGE_GAP_MS)
      }
    }
    raf = requestAnimationFrame(tick)
    return () => {
      cancelAnimationFrame(raf)
      clearTimeout(gapTimeout)
    }
  }, [stage, rows.length, cumulative])

  // ── 효과음 ── (StrictMode 이중 실행에도 한 번만 재생되도록 ref로 가드)
  const soundPlayed = useRef({ board: false, final: false, fanfare: false })

  useEffect(() => {
    if (soundPlayed.current.board) return
    soundPlayed.current.board = true
    playSfx('scoreboard')
  }, [])

  // 카운트업 중에는 BGM을 줄이고, 최종 점수가 나오면(또는 화면을 떠나면) 다시 fade in
  useEffect(() => {
    if (done) return
    duckBgm(true)
    return () => duckBgm(false)
  }, [done])

  // 카운트업 완료(스킵 포함) — 최종 점수 띠링 + 등급 도장, 신기록이면 팡파르
  useEffect(() => {
    if (!done) return
    const played = soundPlayed.current
    if (!played.final) {
      played.final = true
      playFinalScoreDing()
      playSfx('stamp')
    }
    if (!isNewRecord || played.fanfare) return
    const id = setTimeout(() => {
      played.fanfare = true
      playSfx('fanfare')
    }, FANFARE_DELAY_MS)
    return () => clearTimeout(id)
  }, [done, isNewRecord])

  // 탭 / Enter / Space → 연출 스킵
  const mountedAt = useRef(performance.now())
  const skip = useCallback(() => {
    if (performance.now() - mountedAt.current < SKIP_GUARD_MS) return
    setStage(rows.length)
  }, [rows.length])

  useEffect(() => {
    if (done) return
    const onKey = (e) => {
      if (e.key === 'Enter' || e.key === ' ') skip()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [done, skip])

  // 공유 결과 토스트 메시지 (null이면 숨김)
  const [toast, setToast] = useState(null)

  useEffect(() => {
    if (!toast) return
    const id = setTimeout(() => setToast(null), TOAST_DURATION_MS)
    return () => clearTimeout(id)
  }, [toast])

  // 네이티브 공유 시트 대신 클립보드 복사만 사용
  const handleShare = () => {
    const text = `I scored ${finalScore.toLocaleString('en-US')} (${grade.grade} ${grade.title}) on BadBall Hitter! Can you beat me? → ${SHARE_URL}`
    if (!navigator.clipboard) {
      setToast('Copy failed 😢')
      return
    }
    navigator.clipboard.writeText(text).then(
      () => setToast('Copied to clipboard!'),
      () => setToast('Copy failed 😢'),
    )
  }

  const scoreText = displayScore.toLocaleString('en-US')
  const unlockedCount = ALL_PITCH_IDS.length - PITCH_UNLOCKS.length + unlockStep

  return (
    <div className="result-screen" onPointerDown={done ? undefined : skip}>
      <div className="result-scrim" />
      <div className="result-content">
        <h2 className="result-title">Game Over</h2>

        {/* 전광판 — 최종 점수 카운트업 */}
        <div className="result-board">
          <span className="result-board-label">FINAL SCORE</span>
          <span className={`result-board-num${scoreText.length > 7 ? ' long' : ''}${done ? ' done' : ''}`}>
            {scoreText}
          </span>
        </div>

        {/* 최고 기록 / 홈런(신기록) */}
        <div className={`result-best${done ? ' show' : ''}`}>
          {isNewRecord ? (
            <div className="home-run">
              <span className="home-run-text">HOME RUN!</span>
              <span className="home-run-sub">New best score</span>
              <img className="home-run-ball" src="/assets/balls/white.png" alt="" draggable={false} />
            </div>
          ) : (
            <span className="best-text">BEST {best != null ? best.toLocaleString('en-US') : '-'}</span>
          )}
        </div>

        {/* 박스 스코어 — 행이 하나씩 켜지며 점수에 더해짐 */}
        <div className="box-score">
          <div className="box-score-head">
            <span>BOX SCORE</span>
            <span>PTS</span>
          </div>
          {rows.map((r, i) => (
            <div key={r.id} className={`box-row${done || i <= stage ? ' lit' : ''}`}>
              <span className="box-label">
                {r.label}
                {r.sub && <span className="box-sub">{r.sub}</span>}
              </span>
              <span className="box-value">{r.value}</span>
              <span className="box-pts">+{r.pts.toLocaleString('en-US')}</span>
            </div>
          ))}
        </div>

        {/* 등급 도장 + 해금 구종 — 카운트업 완료 후 표시 (자리는 미리 확보) */}
        <div className={`result-grade${done ? ' show' : ''}`} style={{ '--grade-color': grade.color }}>
          <div className={`grade-stamp grade-${grade.grade.toLowerCase()}`}>{grade.grade}</div>
          <div className="grade-info">
            <div className="grade-title">{grade.title}</div>
            <div className="grade-balls">
              {ALL_PITCH_IDS.map((id, i) => {
                const img = pitchBallImages[id]
                const unlocked = i < unlockedCount
                return img ? (
                  <img
                    key={id}
                    className={`grade-ball${unlocked ? '' : ' locked'}`}
                    src={img}
                    alt={PITCHES[id].label}
                    draggable={false}
                  />
                ) : (
                  <span key={id} className={`grade-ball fallback${unlocked ? '' : ' locked'}`} style={{ background: PITCHES[id].color }} />
                )
              })}
            </div>
          </div>
        </div>

        {/* TODO: Supabase — top 10 leaderboard */}
        {/* <Leaderboard currentScore={finalScore} /> */}

        <div className="result-actions">
          <button className="btn-retry" onClick={onRetry}>Play Again</button>
          <button className="btn-share" onClick={handleShare}>Share</button>
        </div>
        {onHome && (
          <button className="btn-home" onClick={onHome}>Back to Title</button>
        )}
      </div>
      {toast && <div className="result-toast">{toast}</div>}
    </div>
  )
}
