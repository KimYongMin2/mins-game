import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { installAudioUnlock } from '../../shared/audio/synth'
import { SoundToggle } from '../../shared/ui/SoundToggle'
import { GameScreen } from './game/GameScreen'
import type { SessionSummary } from './play/session'
import { type BattingRecord, addGame, loadRecord, saveRecord } from './records'
import { ResultScreen } from './screens/ResultScreen'
import { StartScreen } from './screens/StartScreen'
import './batting.css'

// 화면 흐름: 시작(난이도·타석) → 경기(10구) → 결과 → 다시 하기 / 처음으로
type Screen =
  | { kind: 'start' }
  | { kind: 'game'; key: number }
  | { kind: 'result'; summary: SessionSummary; newBest: boolean }

export function BattingPage() {
  const [screen, setScreen] = useState<Screen>({ kind: 'start' })
  const [record, setRecord] = useState<BattingRecord>(() => loadRecord())
  const [games, setGames] = useState(0)
  useEffect(installAudioUnlock, [])

  function update(next: BattingRecord) {
    saveRecord(next)
    setRecord(next)
  }

  function start() {
    setGames((n) => n + 1)
    setScreen({ kind: 'game', key: games + 1 })
  }

  function finish(summary: SessionSummary) {
    const { record: next, newBest } = addGame(record, summary)
    update(next)
    setScreen({ kind: 'result', summary, newBest })
  }

  const toStart = () => setScreen({ kind: 'start' })

  return (
    <main className="page bt-page">
      <header className="bt-header">
        <h1 className="title">졸라 타격왕</h1>
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

      {screen.kind === 'start' && (
        <StartScreen record={record} onChange={(c) => update({ ...record, ...c })} onStart={start} />
      )}
      {screen.kind === 'game' && (
        <GameScreen key={screen.key} difficulty={record.difficulty} hand={record.hand} onFinish={finish} />
      )}
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
