import { useState } from 'react'
import { isMuted, setMuted as setSoundMuted } from '../../lib/sound'
import volumeIcon from '../../assets/icons/volume.svg'
import volumeXmarkIcon from '../../assets/icons/volume-xmark.svg'
import './BgmToggle.css'

export default function BgmToggle() {
  const [muted, setMuted] = useState(isMuted)

  const handleToggle = (e) => {
    // 버튼 포커스가 남아 스페이스/엔터로 재토글되지 않도록 해제
    e.currentTarget.blur()
    const next = !muted
    setSoundMuted(next)
    setMuted(next)
  }

  const icon = muted ? volumeXmarkIcon : volumeIcon

  return (
    <div className="bgm-toggle-layer">
      <button
        type="button"
        className="bgm-toggle"
        onClick={handleToggle}
        aria-label={muted ? 'Turn sound on' : 'Turn sound off'}
        aria-pressed={!muted}
      >
        {/* svg가 fill=currentColor라 mask로 색 지정
            빌드 시 svg가 data URI로 인라인되며 ' ( ) 가 포함되므로 url()에 따옴표 필수 */}
        <span
          className="bgm-toggle-icon"
          style={{ maskImage: `url("${icon}")`, WebkitMaskImage: `url("${icon}")` }}
        />
      </button>
    </div>
  )
}
