import { SafeAreaInsets } from '@apps-in-toss/web-framework'

// 토스 웹뷰는 게임 화면을 상태바 밑까지 그리고, 우상단에 ··· ✕ 버튼을 고정으로 띄움
// → 상단 여백(--safe-top), 하단 홈 바 여백(--safe-bottom), 우상단에서 비켜야 할 폭(--toss-nav-space)을 CSS 변수로 내려줌
// 토스 밖(웹 배포)에서는 SDK가 throw → 변수를 안 세팅해서 CSS 기본값(0) 사용

// ··· ✕ 버튼 묶음 폭 (실기기 스크린샷 기준 약 90px) + 게임 버튼과의 간격
const TOSS_NAV_WIDTH = 90
const TOSS_NAV_GAP = 8

// 공식 문서: X 버튼 위치 = 우측 safeArea.right + 10
const applyInsets = ({ top, bottom, right }) => {
  const root = document.documentElement.style
  root.setProperty('--safe-top', `${top}px`)
  root.setProperty('--safe-bottom', `${bottom}px`)
  root.setProperty('--toss-nav-space', `${right + 10 + TOSS_NAV_WIDTH + TOSS_NAV_GAP}px`)
}

const isTossWebView = () => window.ReactNativeWebView != null

if (isTossWebView()) {
  try {
    applyInsets(SafeAreaInsets.get())
    SafeAreaInsets.subscribe({ onEvent: applyInsets })
  } catch {
    // SDK 미지원 환경 — 여백 없이 진행
  }
}
