import './TitleScreen.css'

export default function TitleScreen({ onPlay, onRanking, onTeamRanking, loading }) {
  return (
    <div className="title-screen">
      <div className="title-scrim" />
      <div className="title-content">
        <h1 className="game-title">
          <span className="game-title-bad">Bad</span>
          <span className="game-title-ball">Ball</span>
          <span className="game-title-hitter">Hitter</span>
        </h1>
        <p className="game-tagline">공 색깔을 보고 좌우로 쳐내세요!</p>

        <button className="btn-play-ball" onClick={onPlay} disabled={loading}>
          <span className="btn-play-ball-text">{loading ? 'Loading...' : 'Play Ball!'}</span>
        </button>

        <div className="title-rankings">
          {onRanking && (
            <button className="btn-ranking" onClick={onRanking}>
              Ranking
            </button>
          )}
          {onTeamRanking && (
            <button className="btn-ranking" onClick={onTeamRanking}>
              Team Ranking
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
