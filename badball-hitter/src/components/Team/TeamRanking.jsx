import { useState, useEffect, useCallback } from 'react'
import { getTeam } from '../constants'
import { fetchWeeklyRanking, getWeekRange } from '../../lib/teamRanking'
import TeamBadge, { teamAccent } from './TeamBadge'
import './TeamRanking.css'

// 주간 팀 랭킹 — 타이틀·결과 화면 위에 덮는 오버레이 (결과 화면이 리마운트되면 카운트업·점수 제출이 다시 돌아서)
const TABS = [
  { offset: 0, label: '이번 주' },
  { offset: 1, label: '지난주' },
]

const formatDate = (ms) => {
  // 한국시간 기준 M/D
  const d = new Date(ms + 9 * 60 * 60 * 1000)
  return `${d.getUTCMonth() + 1}/${d.getUTCDate()}`
}

const formatRemaining = (ms) => {
  const h = Math.max(0, Math.floor(ms / 3600000))
  return h >= 24 ? `${Math.floor(h / 24)}일 ${h % 24}시간` : `${h}시간 ${Math.floor((ms % 3600000) / 60000)}분`
}

export default function TeamRanking({ myTeam, onClose }) {
  const [offset, setOffset] = useState(0)
  const [byOffset, setByOffset] = useState({})  // offset → rows | 'error'
  const rows = byOffset[offset]

  const load = useCallback((o) => {
    setByOffset((prev) => ({ ...prev, [o]: undefined }))
    fetchWeeklyRanking(o)
      .then((r) => setByOffset((prev) => ({ ...prev, [o]: r })))
      .catch(() => setByOffset((prev) => ({ ...prev, [o]: 'error' })))
  }, [])

  useEffect(() => {
    if (byOffset[offset] === undefined) load(offset)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 탭을 처음 열 때만 불러옴
  }, [offset])

  const { start, end } = getWeekRange(offset)
  const lastDay = end - 24 * 60 * 60 * 1000
  const max = Array.isArray(rows) ? Math.max(1, ...rows.map((r) => r.total)) : 1
  const empty = Array.isArray(rows) && rows.every((r) => r.total === 0)

  return (
    <div className="team-ranking" role="dialog" aria-label="Weekly team ranking">
      <div className="team-ranking-scrim" />
      <button className="team-ranking-close" onClick={onClose} aria-label="Close">‹</button>

      <div className="team-ranking-content">
        <h2 className="team-ranking-heading">주간 팀 랭킹</h2>

        <div className="team-ranking-tabs" role="tablist">
          {TABS.map((t) => (
            <button
              key={t.offset}
              role="tab"
              aria-selected={offset === t.offset}
              className={`team-ranking-tab${offset === t.offset ? ' active' : ''}`}
              onClick={() => setOffset(t.offset)}
            >
              {t.label}
            </button>
          ))}
        </div>

        <p className="team-ranking-period">
          {formatDate(start)} – {formatDate(lastDay)}
          {offset === 0 && <span className="team-ranking-reset"> · {formatRemaining(end - Date.now())} 뒤 초기화</span>}
        </p>

        {rows === undefined && <p className="team-ranking-status">Loading...</p>}

        {rows === 'error' && (
          <div className="team-ranking-status">
            <p>Couldn&apos;t load the ranking.</p>
            <button className="team-ranking-retry" onClick={() => load(offset)}>Try again</button>
          </div>
        )}

        {Array.isArray(rows) && (
          <ol className="team-ranking-list">
            {rows.map((r, i) => {
              const team = getTeam(r.team_id)
              if (!team) return null
              const rank = r.total > 0 ? i + 1 : null  // 기록 없는 팀은 순위 없이 '-'
              return (
                <li
                  key={r.team_id}
                  className={`team-ranking-row${r.team_id === myTeam ? ' mine' : ''}`}
                  style={{ '--team-color': teamAccent(team), '--team-bar': `${teamAccent(team)}52`, '--bar': `${(r.total / max) * 100}%` }}
                >
                  <span className={`team-ranking-rank${rank && rank <= 3 ? ` top${rank}` : ''}`}>{rank ?? '-'}</span>
                  <TeamBadge team={team} size={32} />
                  <span className="team-ranking-name">
                    <span className="team-ranking-city">{team.city}</span>
                    <span className="team-ranking-nick">{team.name}</span>
                  </span>
                  <span className="team-ranking-score">
                    <span className="team-ranking-total">{r.total.toLocaleString('en-US')}</span>
                    <span className="team-ranking-players">{r.players.toLocaleString('en-US')} {r.players === 1 ? 'player' : 'players'}</span>
                  </span>
                </li>
              )
            })}
          </ol>
        )}

        {empty && offset === 0 && <p className="team-ranking-note">No games yet this week. Be the first!</p>}
      </div>
    </div>
  )
}
