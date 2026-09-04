import { useState } from 'react'
import TitleScreen from './components/Title/TitleScreen'
import GameScreen from './components/Game/GameScreen'
import GameResult from './components/Game/GameResult'

export default function App() {
  const [screen, setScreen] = useState('title') // 'title' | 'playing' | 'result'
  const [stats, setStats] = useState(null)
  const [gameKey, setGameKey] = useState(0)

  const handlePlay = () => {
    setGameKey((k) => k + 1)
    setScreen('playing')
  }

  const handleGameOver = (gameStats) => {
    setStats(gameStats)
    setScreen('result')
  }

  const handleRetry = () => {
    setStats(null)
    setGameKey((k) => k + 1)
    setScreen('playing')
  }

  const handleBackToTitle = () => {
    setStats(null)
    setScreen('title')
  }

  const handleRanking = () => {
    alert('Ranking coming soon!')
  }

  if (screen === 'playing') {
    return (
      <GameScreen
        key={gameKey}
        onGameOver={handleGameOver}
      />
    )
  }

  if (screen === 'result' && stats) {
    return (
      <GameResult
        stats={stats}
        onRetry={handleRetry}
        onHome={handleBackToTitle}
      />
    )
  }

  return (
    <TitleScreen
      onPlay={handlePlay}
      onRanking={handleRanking}
    />
  )
}
