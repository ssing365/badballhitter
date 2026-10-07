import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import aitDevtools from '@apps-in-toss/devtools/unplugin'

const GA_ID = 'G-S7RJSX2CLZ'

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
  plugins: [aitDevtools.vite(), react(), webAnalyticsTags()],
  define: {
    // 실기기 디버깅 콘솔(main.jsx) — dogfood 빌드에만 넣음
    __DEBUG_BUILD__: JSON.stringify(process.env.RELEASE_CHANNEL === 'dogfood'),
  },
})
