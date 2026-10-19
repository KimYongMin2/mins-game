import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { installAudioUnlock } from '../../shared/audio/synth'
import { SoundToggle } from '../../shared/ui/SoundToggle'
import { GameScreen } from './game/GameScreen'
import type { RoundSummary } from './play/roundState'
import { type ArcheryRecord, addGame, loadRecord, saveRecord } from './records'
import { ResultScreen } from './screens/ResultScreen'
import { StartScreen } from './screens/StartScreen'
import './archery.css'

// 화면 흐름: 시작 → 경기(10발) → 결과 → 다시 하기 / 처음으로
type Screen =
  | { kind: 'start' }
  | { kind: 'game'; key: number }
  | { kind: 'result'; summary: RoundSummary; newBest: boolean }

export function ArcheryPage() {
  const [screen, setScreen] = useState<Screen>({ kind: 'start' })
  const [record, setRecord] = useState<ArcheryRecord>(() => loadRecord())
  const [games, setGames] = useState(0)
  useEffect(installAudioUnlock, [])

  function start() {
    setGames((n) => n + 1)
    setScreen({ kind: 'game', key: games + 1 })
  }

  function finish(summary: RoundSummary) {
    const { record: next, newBest } = addGame(record, summary)
    saveRecord(next)
    setRecord(next)
    setScreen({ kind: 'result', summary, newBest })
  }

  const toStart = () => setScreen({ kind: 'start' })

  return (
    <main className="page ar-page">
      <header className="ar-header">
        <h1 className="title">졸라 양궁</h1>
        <SoundToggle />
        {screen.kind === 'game' ? (
          <button type="button" className="button button--small" onClick={toStart}>
            그만하기
          </button>
        ) : (
          <Link className="button button--small" to="/">
            나가기
          </Link>
        )}
      </header>

      {screen.kind === 'start' && <StartScreen record={record} onStart={start} />}
      {screen.kind === 'game' && <GameScreen key={screen.key} onFinish={finish} />}
      {screen.kind === 'result' && (
        <ResultScreen
          summary={screen.summary}
          record={record}
          newBest={screen.newBest}
          onRetry={start}
          onMenu={toStart}
        />
      )}
    </main>
  )
}
