import { useState, useEffect } from 'react'
import TitleScreen from './components/Title/TitleScreen'
import GameScreen from './components/Game/GameScreen'
import GameResult from './components/Game/GameResult'
import BgmToggle from './components/Sound/BgmToggle'
import { playBgm } from './lib/sound'

export default function App() {
  const [screen, setScreen] = useState('title') // 'title' | 'playing' | 'result'
  const [stats, setStats] = useState(null)
  const [gameKey, setGameKey] = useState(0)

  // 화면별 BGM — 단일 진입점
  useEffect(() => {
    playBgm(screen === 'playing' ? 'fast' : 'normal')
  }, [screen])

  const handlePlay = () => {
    playBgm('fast') // sync with click (autoplay unlock)
    setGameKey((k) => k + 1)
    setScreen('playing')
  }

  const handleGameOver = (gameStats) => {
    setStats(gameStats)
    setScreen('result')
  }

  const handleRetry = () => {
    playBgm('fast')
    setStats(null)
    setGameKey((k) => k + 1)
    setScreen('playing')
  }

  const handleBackToTitle = () => {
    playBgm('normal')
    setStats(null)
    setScreen('title')
  }

  const handleRanking = () => {
    playBgm('normal')
    alert('Ranking coming soon!')
  }

  let content
  if (screen === 'playing') {
    content = (
      <GameScreen
        key={gameKey}
        onGameOver={handleGameOver}
      />
    )
  } else if (screen === 'result' && stats) {
    content = (
      <GameResult
        stats={stats}
        onRetry={handleRetry}
        onHome={handleBackToTitle}
      />
    )
  } else {
    content = (
      <TitleScreen
        onPlay={handlePlay}
        onRanking={handleRanking}
      />
    )
  }

  return (
    <>
      {content}
      <BgmToggle inGame={screen === 'playing'} />
    </>
  )
}
