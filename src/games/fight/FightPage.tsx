import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { installAudioUnlock } from '../../shared/audio/synth'
import type { UploadStatus } from '../../shared/online/uploadQueue'
import { loadNickname } from '../../shared/storage/nickname'
import { SoundToggle } from '../../shared/ui/SoundToggle'
import { GameScreen } from './game/GameScreen'
import type { MatchSummary } from './play/matchState'
import { flushPendingGames, submitGame } from './ranking/online'
import { type FightRecord, addGame, loadRecord, saveRecord } from './records'
import { RankingScreen } from './screens/RankingScreen'
import { ResultScreen } from './screens/ResultScreen'
import { StartScreen } from './screens/StartScreen'
import './fight.css'

// 화면 흐름: 시작(난이도) → 경기 → 결과 → 다시 하기 / 랭킹 / 처음으로
type Screen =
  | { kind: 'start' }
  | { kind: 'ranking' }
  | { kind: 'game'; key: number }
  | { kind: 'result'; summary: MatchSummary }

export function FightPage() {
  const [screen, setScreen] = useState<Screen>({ kind: 'start' })
  const [record, setRecord] = useState<FightRecord>(() => loadRecord())
  const [games, setGames] = useState(0)
  const [upload, setUpload] = useState<UploadStatus>('saving')
  useEffect(installAudioUnlock, [])
  // 지난번에 못 올린 기록이 있으면 다시 보낸다.
  useEffect(() => {
    void flushPendingGames()
  }, [])

  function update(next: FightRecord) {
    saveRecord(next)
    setRecord(next)
  }

  function start() {
    setGames((n) => n + 1)
    setScreen({ kind: 'game', key: games + 1 })
  }

  function finish(summary: MatchSummary) {
    const next = addGame(record, summary)
    update(next)
    setScreen({ kind: 'result', summary })
    setUpload('saving')
    submitGame(summary, next[summary.difficulty].streak, loadNickname() ?? '익명')
      .then(setUpload)
      .catch(() => setUpload('queued'))
  }

  const toStart = () => setScreen({ kind: 'start' })
  const toRanking = () => setScreen({ kind: 'ranking' })

  return (
    <main className="page ft-page">
      <header className="ft-header">
        <h1 className="title">격투</h1>
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
        <StartScreen
          record={record}
          onDifficulty={(difficulty) => update({ ...record, difficulty })}
          onStart={start}
          onRanking={toRanking}
        />
      )}
      {screen.kind === 'ranking' && <RankingScreen initialDifficulty={record.difficulty} onBack={toStart} />}
      {screen.kind === 'game' && <GameScreen key={screen.key} difficulty={record.difficulty} onFinish={finish} />}
      {screen.kind === 'result' && (
        <ResultScreen
          summary={screen.summary}
          record={record}
          upload={upload}
          onRetry={start}
          onRanking={toRanking}
          onMenu={toStart}
        />
      )}
    </main>
  )
}
