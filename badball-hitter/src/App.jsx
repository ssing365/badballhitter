import { useState, useEffect, lazy, Suspense } from 'react'
import TitleScreen from './components/Title/TitleScreen'
import GameScreen from './components/Game/GameScreen'
import GameResult from './components/Game/GameResult'
import TeamSelect from './components/Team/TeamSelect'
import TeamRanking from './components/Team/TeamRanking'
import BgmToggle from './components/Sound/BgmToggle'
import { playBgm } from './lib/sound'
import { preloadImages, GAME_IMAGES } from './lib/preload'
import { loadTeam, saveTeam } from './lib/team'
import { isTeamRankingEnabled } from './lib/teamRanking'
import { getBatterImages } from './components/constants'
import { loadBestRecord } from './lib/records'
import { openLeaderboard } from './lib/leaderboard'

// Vercel Analytics — 웹 배포(--mode web)에서만 로드, 앱인토스 번들에서는 빌드 시 제거됨
const Analytics = import.meta.env.MODE === 'web'
  ? lazy(() => import('@vercel/analytics/react').then((m) => ({ default: m.Analytics })))
  : null

export default function App() {
  const [screen, setScreen] = useState('title') // 'title' | 'team' | 'playing' | 'result'
  const [team, setTeam] = useState(loadTeam) // 지난번 고른 팀 (없으면 null — 팀 화면에서 골라야 시작)
  const [stats, setStats] = useState(null)
  const [gameKey, setGameKey] = useState(0)
  const [assetsReady, setAssetsReady] = useState(false)
  // 주간 팀 랭킹 — 화면 전환 대신 오버레이 (결과 화면을 리마운트하지 않게)
  const [showTeamRanking, setShowTeamRanking] = useState(false)
  const openTeamRanking = isTeamRankingEnabled() ? () => setShowTeamRanking(true) : null

  // 게임 이미지 프리로드 + 최고 기록 로드 — 완료 전엔 Play 버튼 비활성
  useEffect(() => {
    const teamImages = team ? Object.values(getBatterImages(team)) : []
    Promise.all([preloadImages([...GAME_IMAGES, ...teamImages]), loadBestRecord()]).then(() => setAssetsReady(true))
  }, [])

  // 화면별 BGM — 단일 진입점
  useEffect(() => {
    playBgm(screen === 'playing' ? 'fast' : 'normal')
  }, [screen])

  // 타이틀 Play Ball → 팀 선택
  const handlePlay = () => {
    playBgm('normal') // sync with click (autoplay unlock)
    setScreen('team')
  }

  const handleSelectTeam = (id) => {
    setTeam(id)
    saveTeam(id)
    preloadImages(Object.values(getBatterImages(id)))
  }

  // 팀 선택 Play Ball → 게임
  const handleStart = () => {
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

  // 토스 게임센터 리더보드 — 토스 앱 밖(웹 배포)에서는 준비 중 안내
  const handleRanking = async () => {
    playBgm('normal')
    if (!(await openLeaderboard())) alert('Ranking coming soon!')
  }

  let content
  if (screen === 'playing') {
    content = (
      <GameScreen
        key={gameKey}
        team={team}
        onGameOver={handleGameOver}
        onQuit={handleBackToTitle}
      />
    )
  } else if (screen === 'result' && stats) {
    content = (
      <GameResult
        stats={stats}
        team={team}
        onTeamRanking={openTeamRanking}
        onRetry={handleRetry}
        onHome={handleBackToTitle}
      />
    )
  } else if (screen === 'team') {
    content = (
      <TeamSelect
        team={team}
        onSelect={handleSelectTeam}
        onStart={handleStart}
        onBack={handleBackToTitle}
      />
    )
  } else {
    content = (
      <TitleScreen
        onPlay={handlePlay}
        onRanking={handleRanking}
        onTeamRanking={openTeamRanking}
        loading={!assetsReady}
      />
    )
  }

  return (
    <>
      {content}
      {screen !== 'playing' && <BgmToggle />}
      {showTeamRanking && <TeamRanking myTeam={team} onClose={() => setShowTeamRanking(false)} />}
      {Analytics && <Suspense fallback={null}><Analytics /></Suspense>}
    </>
  )
}
