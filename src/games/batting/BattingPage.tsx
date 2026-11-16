import { useEffect, useState } from 'react'
import { HomeLink } from '../../shared/ui/HomeLink'
import { installAudioUnlock } from '../../shared/audio/synth'
import type { UploadStatus } from '../../shared/online/uploadQueue'
import { loadNickname } from '../../shared/storage/nickname'
import { PlayHeader } from '../../shared/ui/PlayHeader'
import { SoundToggle } from '../../shared/ui/SoundToggle'
import { GameScreen } from './game/GameScreen'
import type { SessionSummary } from './play/session'
import { flushPendingGames, submitGame } from './ranking/online'
import { type Ticket, prefetchTicket, takeTicket } from '../../shared/online/verified'
import { type BattingRecord, addGame, loadRecord, saveRecord } from './records'
import { RankingScreen } from './screens/RankingScreen'
import { ResultScreen } from './screens/ResultScreen'
import { StartScreen } from './screens/StartScreen'
import './batting.css'

// 화면 흐름: 시작(난이도·타석) → 경기(10구) → 결과 → 다시 하기 / 랭킹 / 처음으로
type Screen =
  | { kind: 'start' }
  | { kind: 'ranking' }
  | { kind: 'game'; key: number; ticket: Ticket | null }
  | { kind: 'result'; summary: SessionSummary; newBest: boolean }

export function BattingPage() {
  const [screen, setScreen] = useState<Screen>({ kind: 'start' })
  const [record, setRecord] = useState<BattingRecord>(() => loadRecord())
  const [games, setGames] = useState(0)
  const [upload, setUpload] = useState<UploadStatus>('saving')
  useEffect(installAudioUnlock, [])
  // 지난번에 못 올린 기록이 있으면 다시 보낸다.
  useEffect(() => {
    void prefetchTicket('batting')
    void flushPendingGames()
  }, [])

  function update(next: BattingRecord) {
    saveRecord(next)
    setRecord(next)
  }

  function start() {
    setGames((n) => n + 1)
    setScreen({ kind: 'game', key: games + 1, ticket: takeTicket('batting') })
  }

  function finish(summary: SessionSummary) {
    const { record: next, newBest } = addGame(record, summary)
    update(next)
    setScreen({ kind: 'result', summary, newBest })
    // 서버 입장권 없이 한 판(오프라인 등)은 랭킹에 안 올라감 — 서버가 다시 쳐 볼 수 없어서
    const ticket = screen.kind === 'game' ? screen.ticket : null
    if (!ticket) {
      setUpload('rejected')
      return
    }
    setUpload('saving')
    submitGame(summary, ticket, loadNickname() ?? '익명')
      .then(setUpload)
      .catch(() => setUpload('queued'))
  }

  const toRanking = () => setScreen({ kind: 'ranking' })

  const toStart = () => setScreen({ kind: 'start' })

  // 경기 중이면 arcade--play (경기 화면만 따로 다듬을 때)
  const inGame = screen.kind === 'game'
  return (
    <main className={`page bt-page arcade${inGame ? ' arcade--play' : ''}`}>
      <PlayHeader className="bt-header" title="배팅" playing={inGame}>
        <SoundToggle />
        {screen.kind === 'game' ? (
          <button type="button" className="button button--small" onClick={toStart}>
            그만하기
          </button>
        ) : (
          <HomeLink className="button button--small">
            나가기
          </HomeLink>
        )}
      </PlayHeader>

      {screen.kind === 'start' && (
        <StartScreen record={record} onChange={(c) => update({ ...record, ...c })} onStart={start} onRanking={toRanking} />
      )}
      {screen.kind === 'ranking' && (
        <RankingScreen initialDifficulty={record.difficulty} onBack={toStart} />
      )}
      {screen.kind === 'game' && (
        <GameScreen key={screen.key} difficulty={record.difficulty} hand={record.hand} seed={screen.ticket?.seed} onFinish={finish} />
      )}
      {screen.kind === 'result' && (
        <ResultScreen
          summary={screen.summary}
          record={record}
          newBest={screen.newBest}
          upload={upload}
          onRetry={start}
          onRanking={toRanking}
          onMenu={toStart}
        />
      )}
    </main>
  )
}
