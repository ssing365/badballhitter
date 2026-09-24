import { useState, useEffect } from 'react'
import { GRADES } from '../constants'
import './GameResult.css'

// TODO: Supabase — save score on game over
// import { saveScore } from '../lib/supabase'

const BEST_SCORE_KEY = 'bestScore'
const SHARE_URL = 'https://badballhitter.vercel.app/'
const TOAST_DURATION_MS = 2000

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

export default function GameResult({ stats, onRetry, onHome }) {
  const { score, correct, classified, maxCombo, feverTaps } = stats
  const acc = classified > 0 ? Math.round((correct / classified) * 100) : 0
  const grade = GRADES.find((g) => acc >= g.minAcc)

  // 마운트 시 1회만 이전 기록과 비교 (렌더 중에는 읽기만)
  const [{ best, isNewRecord }] = useState(() => {
    const prev = readBestScore()
    const isNewRecord = score > (prev ?? 0)
    return { best: isNewRecord ? score : prev, isNewRecord }
  })

  // 신기록이면 localStorage 갱신
  useEffect(() => {
    if (!isNewRecord) return
    try {
      localStorage.setItem(BEST_SCORE_KEY, String(score))
    } catch {
      // 저장 실패는 무시 (프라이빗 모드 등)
    }
  }, [isNewRecord, score])

  // 공유 결과 토스트 메시지 (null이면 숨김)
  const [toast, setToast] = useState(null)

  useEffect(() => {
    if (!toast) return
    const id = setTimeout(() => setToast(null), TOAST_DURATION_MS)
    return () => clearTimeout(id)
  }, [toast])

  // 네이티브 공유 시트 대신 클립보드 복사만 사용
  const handleShare = () => {
    const text = `I scored ${score.toLocaleString('en-US')} on BadBall Hitter! Can you beat me? → ${SHARE_URL}`
    if (!navigator.clipboard) {
      setToast('Copy failed 😢')
      return
    }
    navigator.clipboard.writeText(text).then(
      () => setToast('Copied to clipboard!'),
      () => setToast('Copy failed 😢'),
    )
  }

  return (
    <div className="result-wrap">
      <h2>Game Over!</h2>
      <div className="result-score">{score.toLocaleString()}</div>
      <div className="result-grade">{grade.label}</div>
      <div className="result-best">
        Best: {best != null ? best.toLocaleString() : '-'}
        {isNewRecord && <span className="result-new-record">🎉 New Record!</span>}
      </div>

      <div className="stat-list">
        <div className="stat-row"><span className="label">Hits</span><span className="value">{correct}</span></div>
        <div className="stat-row"><span className="label">Max Combo</span><span className="value">{maxCombo}</span></div>
        <div className="stat-row"><span className="label">Fever Taps</span><span className="value">{feverTaps}</span></div>
      </div>

      {/* TODO: Supabase — top 10 leaderboard */}
      {/* <Leaderboard currentScore={score} /> */}

      <div className="result-actions">
        <button className="btn-retry" onClick={onRetry}>Play Again</button>
        <button className="btn-share" onClick={handleShare}>Share</button>
      </div>
      {onHome && (
        <button className="btn-home" onClick={onHome}>Back to Title</button>
      )}
      {toast && <div className="result-toast">{toast}</div>}
    </div>
  )
}
