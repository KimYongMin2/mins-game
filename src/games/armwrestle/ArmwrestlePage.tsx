import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router'
import { installAudioUnlock } from '../../shared/audio/synth'
import type { Peer, Room } from '../../shared/online/room'
import { loadNickname } from '../../shared/storage/nickname'
import { PvpLobby } from '../../shared/ui/PvpLobby'
import { SoundToggle } from '../../shared/ui/SoundToggle'
import { GameScreen } from './game/GameScreen'
import type { Event } from './constants'
import type { MatchSummary } from './play/matchState'
import type { ArmMsg } from './play/pvp'
import { type ArmRecord, addGame, loadRecord, saveRecord } from './records'
import { ResultScreen } from './screens/ResultScreen'
import { CalibrateScreen } from './screens/CalibrateScreen'
import { StartScreen } from './screens/StartScreen'
import './armwrestle.css'

// 화면 흐름
// - 봇 대전: 시작(난이도) → 경기 → 결과 → 다시 하기 / 처음으로
// - 친구 대전: 시작 → 대기실(방 만들기·코드 입력) → 경기 → 결과 → 다시 하기(방장) / 나가기
type Screen =
  | { kind: 'start' }
  /** 타이밍 맞추기 (터치 지연 보정) */
  | { kind: 'calibrate' }
  | { kind: 'game'; key: number }
  | { kind: 'result'; summary: MatchSummary }
  | { kind: 'lobby' }
  /** 친구: 방장이 시작하길 기다림 */
  | { kind: 'pvp-wait' }
  /** 종목은 방장이 고른 것 */
  | { kind: 'pvp-game'; key: number; event: Event }
  | { kind: 'pvp-result'; summary: MatchSummary }

type Pvp = { room: Room<ArmMsg>; peer: Peer }

export function ArmwrestlePage() {
  const [screen, setScreen] = useState<Screen>({ kind: 'start' })
  const [record, setRecord] = useState<ArmRecord>(() => loadRecord())
  const [pvp, setPvp] = useState<Pvp | null>(null)
  const [peerGone, setPeerGone] = useState(false)
  useEffect(installAudioUnlock, [])

  function update(next: ArmRecord) {
    saveRecord(next)
    setRecord(next)
  }

  const start = () => setScreen({ kind: 'game', key: Date.now() })
  const toStart = () => setScreen({ kind: 'start' })

  function finish(summary: MatchSummary) {
    update(addGame(record, summary))
    setScreen({ kind: summary.mode === 'pvp' ? 'pvp-result' : 'result', summary })
  }

  // 친구 대전 메시지 (경기 밖)
  // - 친구: 듣기 시작하면 'ready'를 보내고, 방장의 'start'(처음·다시 하기)를 받으면 그 종목으로 새 경기
  // - 방장: 친구의 'ready'를 받으면 첫 경기 시작 (친구가 듣기 전에 시작하면 친구가 못 따라온다)
  const screenRef = useRef(screen)
  const recordRef = useRef(record)
  useEffect(() => {
    screenRef.current = screen
    recordRef.current = record
  })
  useEffect(() => {
    if (!pvp) return
    const { room } = pvp
    const offMsg = room.onMessage((msg) => {
      if (room.role === 'guest' && msg.t === 'start') {
        setScreen({ kind: 'pvp-game', key: Date.now(), event: msg.event })
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

  function connected(room: Room<ArmMsg>, peer: Peer) {
    setPvp({ room, peer })
    setPeerGone(false)
    setScreen({ kind: 'pvp-wait' })
  }

  /** 방장: 내가 고른 종목으로 친구와 시작 */
  function startPvp(room: Room<ArmMsg>) {
    const { event } = recordRef.current
    room.send({ t: 'start', event })
    setScreen({ kind: 'pvp-game', key: Date.now(), event })
  }

  function leavePvp() {
    pvp?.room.leave()
    setPvp(null)
    toStart()
  }

  const inGame = screen.kind === 'game' || screen.kind === 'pvp-game'

  return (
    <main className="page aw-page">
      <header className="aw-header">
        <h1 className="title">팔씨름</h1>
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
          onEvent={(event) => update({ ...record, event })}
          onDifficulty={(difficulty) => update({ ...record, difficulty })}
          onStart={start}
          onPvp={() => setScreen({ kind: 'lobby' })}
          onCalibrate={() => setScreen({ kind: 'calibrate' })}
        />
      )}
      {screen.kind === 'calibrate' && <CalibrateScreen onDone={toStart} />}
      {screen.kind === 'lobby' && (
        <PvpLobby<ArmMsg> gameId="armwrestle" nickname={loadNickname() ?? '익명'} onConnected={connected} onBack={toStart} />
      )}
      {screen.kind === 'pvp-wait' &&
        pvp &&
        (peerGone ? (
          <div className="aw-pvp-wait">
            <p>연결이 끊겼어요. 다시 방을 만들거나 코드를 입력해 주세요</p>
            <button type="button" className="button" onClick={leavePvp}>
              나가기
            </button>
          </div>
        ) : (
          <p className="aw-pvp-wait">
            {pvp.room.role === 'host' ? `${pvp.peer.nickname}님이 들어왔어요` : `${pvp.peer.nickname}님 방에 들어왔어요`}. 곧
            시작해요…
          </p>
        ))}
      {screen.kind === 'pvp-game' && pvp && (
        <GameScreen
          key={screen.key}
          event={screen.event}
          difficulty={record.difficulty}
          pvp={{ room: pvp.room, peerName: pvp.peer.nickname }}
          onFinish={finish}
          onQuit={leavePvp}
        />
      )}
      {screen.kind === 'pvp-result' && pvp && (
        <ResultScreen
          summary={screen.summary}
          record={record}
          peerName={pvp.peer.nickname}
          isHost={pvp.room.role === 'host'}
          peerGone={peerGone}
          onRetry={() => startPvp(pvp.room)}
          onMenu={leavePvp}
        />
      )}
      {screen.kind === 'game' && <GameScreen key={screen.key} event={record.event} difficulty={record.difficulty} onFinish={finish} />}
      {screen.kind === 'result' && <ResultScreen summary={screen.summary} record={record} onRetry={start} onMenu={toStart} />}
    </main>
  )
}
