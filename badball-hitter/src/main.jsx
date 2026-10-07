import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'
import './lib/safeArea'
 
ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)

// 실기기 디버깅(QR attach) — RELEASE_CHANNEL=dogfood 빌드에만 포함 (eruda에 eval·외부 링크가 있어 검수 번들에서는 통째로 제거)
// 포함돼도 URL에 debug=1+relay=가 있을 때만 붙음
if (__DEBUG_BUILD__) {
  import('@apps-in-toss/debug-console').then((m) => m.maybeAttach())
}
 