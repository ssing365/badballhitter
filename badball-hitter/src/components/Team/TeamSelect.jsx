import { useState } from 'react'
import { TEAMS } from '../constants'
import './TeamSelect.css'

export default function TeamSelect({ onStart }) {
  const [selectedTeam, setSelectedTeam] = useState(null)

  const handleStart = () => {
    if (!selectedTeam) return
    onStart(selectedTeam)
  }

  return (
    <div className="select-wrap">
      <h2>⚾ 배드볼히터</h2>
      <p>투수가 던지는 공을 좌/우로 분류하라!</p>

      <div className="team-grid">
        {TEAMS.map((team) => (
          <button
            key={team.id}
            className={`team-btn ${selectedTeam?.id === team.id ? 'selected' : ''}`}
            onClick={() => setSelectedTeam(team)}
          >
            {team.emoji} {team.name}
          </button>
        ))}
      </div>

      <button
        className="start-btn"
        disabled={!selectedTeam}
        onClick={handleStart}
      >
        {selectedTeam ? `${selectedTeam.name} 타자로 시작!` : '팀을 먼저 선택하세요'}
      </button>
    </div>
  )
}