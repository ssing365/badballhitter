import {
  isMinVersionSupported,
  openGameCenterLeaderboard,
  submitGameCenterLeaderBoardScore,
} from '@apps-in-toss/web-framework'

// 토스 게임센터 리더보드 — 토스앱 5.221.0 이상, 토스 앱 밖(웹 배포)에서는 SDK가 throw
const MIN_VERSION = { android: '5.221.0', ios: '5.221.0' }

const isSupported = () => {
  try {
    return isMinVersionSupported(MIN_VERSION)
  } catch {
    return false
  }
}

// 리더보드 열기 — 열었으면 true, 지원 안 되는 환경이면 false
export const openLeaderboard = async () => {
  if (!isSupported()) return false
  try {
    await openGameCenterLeaderboard()
    return true
  } catch {
    return false
  }
}

// 점수 제출 — 플레이 완료 후에만 호출 (게임 프로필 생성 전 호출 시 오류)
export const submitLeaderboardScore = async (score) => {
  if (!isSupported()) return
  try {
    const result = await submitGameCenterLeaderBoardScore({ score: String(score) })
    if (result && result.statusCode !== 'SUCCESS') {
      console.warn('[leaderboard] submit failed:', result.statusCode)
    }
  } catch (error) {
    console.warn('[leaderboard] submit error:', error)
  }
}
