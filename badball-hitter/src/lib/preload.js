import { COLOR_BALL_FILES } from '../components/constants'

// 게임 화면에서 쓰는 이미지 — 타이틀에서 미리 받아둬서 첫 게임부터 바로 보이게
export const GAME_IMAGES = [
  '/assets/bg.jpg',
  '/assets/pitcher_idle.png',
  '/assets/batter_idle.png',
  '/assets/batter_swing_l.png',
  '/assets/batter_swing_r.png',
  '/assets/balls/white.png',
  ...COLOR_BALL_FILES.map((name) => `/assets/balls/${name}.png`),
]

// 이미지 한 장 로드 + 디코드 (실패해도 resolve — 로딩 실패로 게임이 막히지 않게)
const preloadImage = (src) =>
  new Promise((resolve) => {
    const img = new Image()
    img.onload = () => {
      if (img.decode) img.decode().catch(() => { }).then(resolve)
      else resolve()
    }
    img.onerror = () => resolve()
    img.src = src
  })

export const preloadImages = (urls = GAME_IMAGES) => Promise.all(urls.map(preloadImage))
