import { TEAMS } from '../constants'
import TeamBadge, { teamAccent } from './TeamBadge'
import './TeamSelect.css'

// 팀 선택 — 타이틀 Play Ball 다음 화면. 지난번 팀이 미리 골라져 있어 Play Ball 한 번이면 바로 시작
export default function TeamSelect({ team, onSelect, onStart, onBack }) {
  return (
    <div className="team-screen">
      <div className="team-scrim" />
      <button className="team-back" onClick={onBack} aria-label="Back to title">‹</button>

      <div className="team-content">
        <h2 className="team-heading">Choose Your Team</h2>

        <div className="team-grid">
          {TEAMS.map((t) => (
            <button
              key={t.id}
              className={`team-btn${team === t.id ? ' selected' : ''}`}
              style={{ '--team-color': teamAccent(t) }}
              onClick={() => onSelect(t.id)}
              aria-pressed={team === t.id}
            >
              <TeamBadge team={t} />
              <span className="team-name">
                <span className="team-city">{t.city}</span>
                <span className="team-nick">{t.name}</span>
              </span>
            </button>
          ))}
        </div>

        <button className="btn-play-ball team-play" onClick={onStart} disabled={!team}>
          <span className="btn-play-ball-text">Play Ball!</span>
        </button>
      </div>
    </div>
  )
}
