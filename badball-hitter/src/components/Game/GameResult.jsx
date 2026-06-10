import { GRADES } from '../constants'
import './GameResult.css'

// TODO: Supabase — 게임 종료 시 점수 저장
// import { saveScore } from '../lib/supabase'

export default function GameResult({ stats, team, onRetry }) {
  const { score, correct, classified, maxCombo, feverTaps } = stats
  const acc = classified > 0 ? Math.round((correct / classified) * 100) : 0
  const grade = GRADES.find((g) => acc >= g.minAcc)

  // TODO: Supabase — 결과 화면 진입 시 리더보드에 점수 등록
  // useEffect(() => { saveScore({ team: team.id, score, acc, maxCombo }) }, [])

  const handleShare = () => {
    const text = `배드볼히터 ${team.name} 타자로 ${score.toLocaleString()}점!\n정확도 ${acc}% / 최고콤보 ${maxCombo}개\nhttps://badballhitter.com`
    if (navigator.share) {
      navigator.share({ title: '배드볼히터', text })
    } else {
      navigator.clipboard.writeText(text).then(() => alert('결과가 클립보드에 복사됐어!'))
    }
  }

  return (
    <div className="result-wrap">
      <h2>⚾ 경기 종료!</h2>
      <div className="result-score">{score.toLocaleString()}</div>
      <div className="result-grade">{grade.label}</div>

      <div className="stat-list">
        <div className="stat-row"><span className="label">팀</span><span className="value">{team.name}</span></div>
        <div className="stat-row"><span className="label">분류 성공</span><span className="value">{correct}개</span></div>
        <div className="stat-row"><span className="label">정확도</span><span className="value">{acc}%</span></div>
        <div className="stat-row"><span className="label">최고 콤보</span><span className="value">{maxCombo}개</span></div>
        <div className="stat-row"><span className="label">피버 탭</span><span className="value">{feverTaps}회</span></div>
      </div>

      {/* TODO: Supabase — 전체 랭킹 상위 10명 표시 */}
      {/* <Leaderboard currentScore={score} /> */}

      <div className="result-actions">
        <button className="btn-retry" onClick={onRetry}>다시 하기</button>
        <button className="btn-share" onClick={handleShare}>결과 공유 ↗</button>
      </div>
    </div>
  )
}