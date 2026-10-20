import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router'
import { installAudioUnlock } from '../../shared/audio/synth'
import type { Peer, Room } from '../../shared/online/room'
import type { UploadStatus } from '../../shared/online/uploadQueue'
import { loadNickname } from '../../shared/storage/nickname'
import { PvpLobby } from '../../shared/ui/PvpLobby'
import { SoundToggle } from '../../shared/ui/SoundToggle'
import { GameScreen } from './game/GameScreen'
import type { MatchSummary } from './play/matchState'
import type { FightMsg } from './play/pvp'
import { flushPendingGames, submitGame } from './ranking/online'
import { type FightRecord, addGame, loadRecord, saveRecord } from './records'
import { PvpResultScreen } from './screens/PvpResultScreen'
import { RankingScreen } from './screens/RankingScreen'
import { ResultScreen } from './screens/ResultScreen'
import { StartScreen } from './screens/StartScreen'
import './fight.css'

// 화면 흐름
// - 봇 대전: 시작(난이도) → 경기 → 결과 → 다시 하기 / 랭킹 / 처음으로
// - 친구 대전: 시작 → 대기실(방 만들기·코드 입력) → 경기 → 결과 → 다시 하기(방장) / 나가기
type Screen =
  | { kind: 'start' }
  | { kind: 'ranking' }
  | { kind: 'game'; key: number }
  | { kind: 'result'; summary: MatchSummary }
  | { kind: 'lobby' }
  /** 친구: 방장이 시작하길 기다림 */
  | { kind: 'pvp-wait' }
  | { kind: 'pvp-game'; key: number }
  | { kind: 'pvp-result'; summary: MatchSummary }

type Pvp = { room: Room<FightMsg>; peer: Peer }

export function FightPage() {
  const [screen, setScreen] = useState<Screen>({ kind: 'start' })
  const [record, setRecord] = useState<FightRecord>(() => loadRecord())
  const [games, setGames] = useState(0)
  const [upload, setUpload] = useState<UploadStatus>('saving')
  const [pvp, setPvp] = useState<Pvp | null>(null)
  const [peerGone, setPeerGone] = useState(false)
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

  // 친구 대전 메시지 (경기 밖)
  // - 친구: 듣기 시작하면 'ready'를 보내고, 방장의 'start'(처음·다시 하기)를 받으면 새 경기
  // - 방장: 친구의 'ready'를 받으면 첫 경기 시작 (친구가 듣기 전에 시작하면 친구가 못 따라온다)
  const gamesRef = useRef(games)
  const screenRef = useRef(screen)
  useEffect(() => {
    gamesRef.current = games
    screenRef.current = screen
  })
  useEffect(() => {
    if (!pvp) return
    const { room } = pvp
    const offMsg = room.onMessage((msg) => {
      if (room.role === 'guest' && msg.t === 'start') {
        setGames((n) => n + 1)
        setScreen({ kind: 'pvp-game', key: gamesRef.current + 1 })
      }
      if (room.role === 'host' && msg.t === 'ready' && screenRef.current.kind === 'pvp-wait') startPvp(room)
    })
    const offPeer = room.onPeer((peer) => setPeerGone(!peer))
    return () => {
      offMsg()
      offPeer()
    }
  }, [pvp])

  // 친구: 시작할 때까지 1초마다 'ready'를 보낸다 (방장이 아직 안 듣고 있을 수 있어서)
  const waiting = screen.kind === 'pvp-wait'
  useEffect(() => {
    if (!waiting || pvp?.room.role !== 'guest') return
    const { room } = pvp
    room.send({ t: 'ready' })
    const id = setInterval(() => room.send({ t: 'ready' }), 1000)
    return () => clearInterval(id)
  }, [waiting, pvp])

  // 화면을 떠나면 방을 닫는다
  const pvpRef = useRef(pvp)
  useEffect(() => {
    pvpRef.current = pvp
  })
  useEffect(() => () => pvpRef.current?.room.leave(), [])

  function connected(room: Room<FightMsg>, peer: Peer) {
    setPvp({ room, peer })
    setPeerGone(false)
    setScreen({ kind: 'pvp-wait' })
  }

  function startPvp(room: Room<FightMsg>) {
    room.send({ t: 'start' })
    setGames((n) => n + 1)
    setScreen({ kind: 'pvp-game', key: gamesRef.current + 1 })
  }

  function finishPvp(summary: MatchSummary) {
    update(addGame(record, summary))
    setScreen({ kind: 'pvp-result', summary })
  }

  function leavePvp() {
    pvp?.room.leave()
    setPvp(null)
    toStart()
  }

  const inGame = screen.kind === 'game' || screen.kind === 'pvp-game'

  return (
    <main className="page ft-page">
      <header className="ft-header">
        <h1 className="title">격투</h1>
        <SoundToggle />
        {inGame ? (
          <button type="button" className="button button--small" onClick={screen.kind === 'pvp-game' ? leavePvp : toStart}>
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
          onPvp={() => setScreen({ kind: 'lobby' })}
          onRanking={toRanking}
        />
      )}
      {screen.kind === 'lobby' && (
        <PvpLobby<FightMsg> gameId="fight" nickname={loadNickname() ?? '익명'} onConnected={connected} onBack={toStart} />
      )}
      {screen.kind === 'pvp-wait' && pvp && (
        peerGone ? (
          <div className="ft-pvp-wait">
            <p>연결이 끊겼어요. 다시 방을 만들거나 코드를 입력해 주세요</p>
            <button type="button" className="button" onClick={leavePvp}>
              나가기
            </button>
          </div>
        ) : (
          <p className="ft-pvp-wait">
            {pvp.room.role === 'host' ? `${pvp.peer.nickname}님이 들어왔어요` : `${pvp.peer.nickname}님 방에 들어왔어요`}. 곧
            시작해요…
          </p>
        )
      )}
      {screen.kind === 'pvp-game' && pvp && (
        <GameScreen
          key={screen.key}
          difficulty={record.difficulty}
          pvp={{ room: pvp.room, peerName: pvp.peer.nickname }}
          onFinish={finishPvp}
          onQuit={leavePvp}
        />
      )}
      {screen.kind === 'pvp-result' && pvp && (
        <PvpResultScreen
          summary={screen.summary}
          record={record.pvp}
          peerName={pvp.peer.nickname}
          isHost={pvp.room.role === 'host'}
          peerGone={peerGone}
          onRetry={() => startPvp(pvp.room)}
          onLeave={leavePvp}
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
