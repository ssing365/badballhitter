import { useState } from 'react'
import TeamSelect from './components/Team/TeamSelect'
import GameScreen from './components/Game/GameScreen'
import GameResult from './components/Game/GameResult'

export default function App() {
  const [screen, setScreen] = useState('select') // 'select' | 'playing' | 'result'
  const [team, setTeam] = useState(null)
  const [stats, setStats] = useState(null)
  const [gameKey, setGameKey] = useState(0)

  const handleStart = (selectedTeam) => {
    setTeam(selectedTeam)
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

  if (screen === 'playing' && team) {
    return (
      <GameScreen
        key={gameKey}
        team={team}
        onGameOver={handleGameOver}
      />
    )
  }

  if (screen === 'result' && team && stats) {
    return (
      <GameResult
        stats={stats}
        team={team}
        onRetry={handleRetry}
      />
    )
  }

  return <TeamSelect onStart={handleStart} />
}
