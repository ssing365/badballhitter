import './TitleScreen.css'

export default function TitleScreen({ onPlay, onRanking, loading }) {
  return (
    <div className="title-screen">
      <div className="title-scrim" />
      <div className="title-content">
        <h1 className="game-title">
          <span className="game-title-bad">Bad</span>
          <span className="game-title-ball">Ball</span>
          <span className="game-title-hitter">Hitter</span>
        </h1>
        <p className="game-tagline">Read the pitch. Swing left or right.</p>

        <button className="btn-play-ball" onClick={onPlay} disabled={loading}>
          {loading ? 'Loading...' : 'Play Ball!'}
        </button>

        <button className="btn-ranking" onClick={onRanking}>
          Ranking
        </button>
      </div>
    </div>
  )
}
