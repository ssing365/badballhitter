import { getTeam } from '../components/constants'

// 고른 팀 — localStorage (사운드 bgmMuted·진동 hapticOff와 같은 방식). 막힌 환경이면 매번 미선택으로 시작
const TEAM_KEY = 'team'

export const loadTeam = () => {
  try {
    const id = localStorage.getItem(TEAM_KEY)
    return getTeam(id) ? id : null
  } catch {
    return null
  }
}

export const saveTeam = (id) => {
  try {
    localStorage.setItem(TEAM_KEY, id)
  } catch {
    // 저장 실패해도 이번 세션엔 App 상태로 유지
  }
}
