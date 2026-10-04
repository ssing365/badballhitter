import { getTossShareLink } from '@apps-in-toss/web-framework'

// 공유 문구에 넣을 링크 — 웹 배포는 vercel 주소, 토스 앱은 토스 공유 링크
// 토스 번들에는 외부 링크를 넣지 않음 (자사 서비스 이동 유도 금지 — 앱인토스 검수 항목)
const WEB_URL = 'https://badballhitter.vercel.app/'
const TOSS_DEEP_LINK = 'intoss://badball-hitter'

// 링크 문자열, 만들지 못하면 null (토스 밖 로컬 dev 등에서는 SDK가 throw)
export const getShareUrl = async () => {
  if (import.meta.env.MODE === 'web') return WEB_URL
  try {
    return await getTossShareLink(TOSS_DEEP_LINK)
  } catch {
    return null
  }
}
