import { useState } from 'react'
import { isMuted, setMuted as setSoundMuted } from '../../lib/sound'
import { isHapticSupported, isHapticOn, setHapticOn } from '../../lib/haptic'
import volumeIcon from '../../assets/icons/volume.svg'
import volumeXmarkIcon from '../../assets/icons/volume-xmark.svg'
import vibrateIcon from '../../assets/icons/vibrate.svg'
import vibrateOffIcon from '../../assets/icons/vibrate-off.svg'
import './BgmToggle.css'

// svg가 fill=currentColor라 mask로 색 지정
// 빌드 시 svg가 data URI로 인라인되며 ' ( ) 가 포함되므로 url()에 따옴표 필수
const maskStyle = (icon) => ({ maskImage: `url("${icon}")`, WebkitMaskImage: `url("${icon}")` })

export default function BgmToggle() {
  const [muted, setMuted] = useState(isMuted)
  const [hapticOn, setHapticOnState] = useState(isHapticOn)

  const handleToggle = (e) => {
    // 버튼 포커스가 남아 스페이스/엔터로 재토글되지 않도록 해제
    e.currentTarget.blur()
    const next = !muted
    setSoundMuted(next)
    setMuted(next)
  }

  const handleHapticToggle = (e) => {
    e.currentTarget.blur()
    const next = !hapticOn
    setHapticOn(next)
    setHapticOnState(next)
  }

  return (
    <div className="bgm-toggle-layer">
      {/* 진동 — 토스 앱 안에서만 동작하므로 웹에서는 숨김 */}
      {isHapticSupported() && (
        <button
          type="button"
          className="bgm-toggle"
          onClick={handleHapticToggle}
          aria-label={hapticOn ? 'Turn vibration off' : 'Turn vibration on'}
          aria-pressed={hapticOn}
        >
          <span className="bgm-toggle-icon" style={maskStyle(hapticOn ? vibrateIcon : vibrateOffIcon)} />
        </button>
      )}
      <button
        type="button"
        className="bgm-toggle"
        onClick={handleToggle}
        aria-label={muted ? 'Turn sound on' : 'Turn sound off'}
        aria-pressed={!muted}
      >
        <span className="bgm-toggle-icon" style={maskStyle(muted ? volumeXmarkIcon : volumeIcon)} />
      </button>
    </div>
  )
}
