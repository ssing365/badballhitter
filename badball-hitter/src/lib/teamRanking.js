import { getUserHash } from './records'

// 주간 팀 랭킹 — Supabase RPC(supabase/team-ranking.sql)를 fetch로 직접 호출 (supabase-js 없이)
// env(VITE_SUPABASE_URL·VITE_SUPABASE_ANON_KEY)가 없으면 꺼짐 → 버튼 숨김
// 점수 제출은 토스 안(게임 사용자 식별키가 있을 때)에서만 — 웹은 보기만

const URL_BASE = import.meta.env.VITE_SUPABASE_URL
const ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY
const TIMEOUT_MS = 5000

export const isTeamRankingEnabled = () => !!(URL_BASE && ANON_KEY)

// 로컬 개발(npm run dev)은 devtools 가짜 식별키가 진짜 DB에 올라가므로 제출 안 함
export const canSubmitTeamScore = () => !import.meta.env.DEV && isTeamRankingEnabled() && getUserHash() != null

const rpc = async (fn, args) => {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
  try {
    const res = await fetch(`${URL_BASE}/rest/v1/rpc/${fn}`, {
      method: 'POST',
      headers: {
        apikey: ANON_KEY,
        Authorization: `Bearer ${ANON_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(args),
      signal: controller.signal,
    })
    if (!res.ok) throw new Error(`[teamRanking] ${fn} ${res.status}`)
    return await res.json()
  } finally {
    clearTimeout(timer)
  }
}

// 한 판 점수 제출 — 실패해도 게임 흐름엔 영향 없게 조용히 무시
export const submitTeamScore = async (team, score) => {
  if (!team || !canSubmitTeamScore()) return
  try {
    await rpc('submit_team_score', { p_user: getUserHash(), p_team: team, p_score: Math.round(score) })
  } catch (error) {
    console.warn('[teamRanking] submit error:', error)
  }
}

// [{ team_id, total, players, games }] 합계 내림차순 — offset 0 이번 주, 1 지난주. 실패 시 throw
export const fetchWeeklyRanking = async (offset = 0) => {
  const rows = await rpc('weekly_team_ranking', { p_offset: offset })
  return rows.map((r) => ({ ...r, total: Number(r.total), players: Number(r.players), games: Number(r.games) }))
}

// 한 주 = 한국시간 월요일 00:00 시작 (SQL과 같은 기준) — 화면에 기간·초기화까지 남은 시간 표시용
const KST_OFFSET_MS = 9 * 60 * 60 * 1000
const WEEK_MS = 7 * 24 * 60 * 60 * 1000

export const getWeekRange = (offset = 0, now = Date.now()) => {
  const kst = new Date(now + KST_OFFSET_MS)  // UTC 메서드로 읽으면 한국시간
  const daysSinceMonday = (kst.getUTCDay() + 6) % 7
  const mondayKst = Date.UTC(kst.getUTCFullYear(), kst.getUTCMonth(), kst.getUTCDate() - daysSinceMonday)
  const start = mondayKst - KST_OFFSET_MS - offset * WEEK_MS
  return { start, end: start + WEEK_MS }
}
