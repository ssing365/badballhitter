import './TeamBadge.css'

// 팀 배지 — 헬멧 이니셜 패치 모양 (patch 바탕·helmet 테두리·letter 글자)
export default function TeamBadge({ team, size = 36 }) {
  return (
    <span
      className="team-badge"
      style={{
        background: team.patch,
        borderColor: team.helmet,
        color: team.letter,
        '--badge-size': `${size}px`,
      }}
    >
      {team.initial}
    </span>
  )
}

// 팀 강조색 — 헬멧이 검정이면 글자색으로 (검정 테두리·글로우는 안 보여서)
export const teamAccent = (team) => (team.helmet === '#2A2A2A' ? team.letter : team.helmet)
