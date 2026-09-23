import { useState } from 'react'
import { isBgmMuted, setBgmMuted } from '../../lib/sound'
import volumeIcon from '../../assets/icons/volume.svg'
import volumeXmarkIcon from '../../assets/icons/volume-xmark.svg'
import './BgmToggle.css'

export default function BgmToggle({ inGame = false }) {
  const [muted, setMuted] = useState(isBgmMuted)

  const handleToggle = (e) => {
    // 버튼 포커스가 남아 스페이스/엔터로 재토글되지 않도록 해제
    e.currentTarget.blur()
    const next = !muted
    setBgmMuted(next)
    setMuted(next)
  }

  const icon = muted ? volumeXmarkIcon : volumeIcon

  return (
    <div className={`bgm-toggle-layer${inGame ? ' in-game' : ''}`}>
      <button
        type="button"
        className="bgm-toggle"
        onClick={handleToggle}
        aria-label={muted ? 'Turn music on' : 'Turn music off'}
        aria-pressed={!muted}
      >
        {/* svg가 fill=currentColor라 mask로 색 지정 */}
        <span
          className="bgm-toggle-icon"
          style={{ maskImage: `url(${icon})`, WebkitMaskImage: `url(${icon})` }}
        />
      </button>
    </div>
  )
}
