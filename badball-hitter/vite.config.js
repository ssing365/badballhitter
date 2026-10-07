import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import aitDevtools from '@apps-in-toss/devtools/unplugin'

const GA_ID = 'G-S7RJSX2CLZ'
const WEB_URL = 'https://badballhitter.vercel.app/'
const SHARE_TITLE = 'BadBall Hitter'
const SHARE_DESCRIPTION = 'Sort the pitches left or right before time runs out. How long can you keep your combo?'

// 링크 미리보기(og/twitter) — 웹 배포에만 넣음. 토스 번들엔 외부(vercel) 주소를 남기지 않음 (검수)
const webShareMetaTags = () => ({
  name: 'web-share-meta-tags',
  apply: (_, { mode }) => mode === 'web',
  transformIndexHtml: () => [
    ['property', 'og:type', 'website'],
    ['property', 'og:url', WEB_URL],
    ['property', 'og:title', SHARE_TITLE],
    ['property', 'og:description', SHARE_DESCRIPTION],
    ['property', 'og:image', `${WEB_URL}assets/bg.png`],
    ['name', 'twitter:card', 'summary_large_image'],
    ['name', 'twitter:title', SHARE_TITLE],
    ['name', 'twitter:description', SHARE_DESCRIPTION],
    ['name', 'twitter:image', `${WEB_URL}assets/bg.png`],
  ].map(([key, value, content]) => ({ tag: 'meta', attrs: { [key]: value, content }, injectTo: 'head' })),
})

// 구글 애널리틱스(gtag.js) — 웹 배포(--mode web)에만 넣고 앱인토스 번들에서는 뺌
const webAnalyticsTags = () => ({
  name: 'web-analytics-tags',
  apply: (_, { mode }) => mode === 'web',
  transformIndexHtml: () => [
    { tag: 'script', attrs: { async: true, src: `https://www.googletagmanager.com/gtag/js?id=${GA_ID}` }, injectTo: 'head-prepend' },
    {
      tag: 'script',
      children: `window.dataLayer = window.dataLayer || [];\nfunction gtag(){dataLayer.push(arguments);}\ngtag('js', new Date());\ngtag('config', '${GA_ID}');`,
      injectTo: 'head-prepend',
    },
  ],
})

// https://vite.dev/config/
export default defineConfig({
  plugins: [aitDevtools.vite(), react(), webAnalyticsTags(), webShareMetaTags()],
  define: {
    // 실기기 디버깅 콘솔(main.jsx) — dogfood 빌드에만 넣음
    __DEBUG_BUILD__: JSON.stringify(process.env.RELEASE_CHANNEL === 'dogfood'),
  },
})
