import { GRADES } from '../constants'
import './GameResult.css'

// TODO: Supabase — save score on game over
// import { saveScore } from '../lib/supabase'

export default function GameResult({ stats, onRetry, onHome }) {
  const { score, correct, classified, maxCombo, feverTaps } = stats
  const acc = classified > 0 ? Math.round((correct / classified) * 100) : 0
  const grade = GRADES.find((g) => acc >= g.minAcc)

  const handleShare = () => {
    const text = `BadBallHitter — ${score.toLocaleString()} pts!\nHits ${correct} / Max combo ${maxCombo}\nhttps://badballhitter.com`
    if (navigator.share) {
      navigator.share({ title: 'BadBallHitter', text })
    } else {
      navigator.clipboard.writeText(text).then(() => alert('Result copied to clipboard!'))
    }
  }

  return (
    <div className="result-wrap">
      <h2>Game Over!</h2>
      <div className="result-score">{score.toLocaleString()}</div>
      <div className="result-grade">{grade.label}</div>

      <div className="stat-list">
        <div className="stat-row"><span className="label">Hits</span><span className="value">{correct}</span></div>
        <div className="stat-row"><span className="label">Max Combo</span><span className="value">{maxCombo}</span></div>
        <div className="stat-row"><span className="label">Fever Taps</span><span className="value">{feverTaps}</span></div>
      </div>

      {/* TODO: Supabase — top 10 leaderboard */}
      {/* <Leaderboard currentScore={score} /> */}

      <div className="result-actions">
        <button className="btn-retry" onClick={onRetry}>Play Again</button>
        <button className="btn-share" onClick={handleShare}>Share ↗</button>
      </div>
      {onHome && (
        <button className="btn-home" onClick={onHome}>Back to Title</button>
      )}
    </div>
  )
}
