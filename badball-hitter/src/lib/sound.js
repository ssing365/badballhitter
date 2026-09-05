import { Howl } from 'howler'

const BGM_VOLUME = 0.35

const tracks = {
  normal: new Howl({
    src: [encodeURI('/sounds/Pinball Spring.mp3')],
    loop: true,
    volume: BGM_VOLUME,
    preload: true,
    html5: true,
  }),
  fast: new Howl({
    src: [encodeURI('/sounds/Pinball Spring 160.mp3')],
    loop: true,
    volume: BGM_VOLUME,
    preload: true,
    html5: true,
  }),
}

let currentType = null

const stopTrack = (howl) => {
  howl.off('fade')
  howl.stop()
  howl.volume(BGM_VOLUME)
}

export const playBgm = (type) => {
  const nextType = type === 'fast' ? 'fast' : 'normal'
  const next = tracks[nextType]

  if (currentType === nextType && next.playing()) {
    next.volume(BGM_VOLUME)
    return
  }

  // 다른 트랙은 즉시 정지 (fade 레이스로 새 트랙이 같이 멈추는 문제 방지)
  Object.entries(tracks).forEach(([key, howl]) => {
    if (key !== nextType) stopTrack(howl)
  })

  currentType = nextType
  stopTrack(next)

  const start = () => {
    if (currentType !== nextType) return
    next.volume(BGM_VOLUME)
    const id = next.play()
    if (id == null) {
      // autoplay blocked or not ready — retry once on unlock
      next.once('unlock', () => {
        if (currentType === nextType && !next.playing()) next.play()
      })
    }
  }

  if (next.state() === 'loaded') {
    start()
  } else {
    next.once('load', start)
    next.load()
  }
}

export const stopBgm = () => {
  Object.values(tracks).forEach(stopTrack)
  currentType = null
}
