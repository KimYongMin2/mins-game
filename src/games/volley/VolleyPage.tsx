import { useEffect, useRef, useState } from 'react'
import { HomeLink } from '../../shared/ui/HomeLink'
import { wantsPvp } from '../../shared/nav'
import { installAudioUnlock } from '../../shared/audio/synth'
import { type DirectRoom, withDirectLink } from '../../shared/online/directLink'
import type { Peer, Room } from '../../shared/online/room'
import { loadNickname } from '../../shared/storage/nickname'
import { PvpLobby } from '../../shared/ui/PvpLobby'
import { DuelReadyRoom, RematchReady, usePeerReady } from '../../shared/ui/Ready'
import { PlayHeader } from '../../shared/ui/PlayHeader'
import { SoundToggle } from '../../shared/ui/SoundToggle'
import { GameScreen } from './game/GameScreen'
import type { VolleyMsg } from './play/net'
import type { Side } from './play/sim'
import { type GameSummary, type VolleyRecord, addGame, loadRecord, saveRecord } from './records'
import { ResultScreen } from './screens/ResultScreen'
import { StartScreen } from './screens/StartScreen'
import './volley.css'

// 화면 흐름
// - 봇 대전: 시작(난이도) → 경기 → 결과 → 다시 하기 / 처음으로
// - 친구 대전: 시작 → 대기실(방 만들기·코드 입력) → 경기 → 결과 → 다시 하기(방장) / 나가기
type Screen =
  | { kind: 'start' }
  | { kind: 'game'; key: number }
  | { kind: 'result'; summary: GameSummary }
  | { kind: 'lobby' }
  /** 친구: 방장이 시작하길 기다림 */
  | { kind: 'pvp-wait' }
  | { kind: 'pvp-game'; key: number; server: Side }
  | { kind: 'pvp-result'; summary: GameSummary }

type Pvp = { room: DirectRoom<VolleyMsg>; peer: Peer }

export function VolleyPage() {
  const [screen, setScreen] = useState<Screen>(() => (wantsPvp() ? { kind: 'lobby' } : { kind: 'start' }))
  const [record, setRecord] = useState<VolleyRecord>(() => loadRecord())
  const [pvp, setPvp] = useState<Pvp | null>(null)
  // 친구 대전 준비 (사용자 요청): 친구가 [준비]해야 방장이 [게임 시작]·[다시 하기]를 누를 수 있다
  const peerReady = usePeerReady(pvp?.room ?? null)
  /** 방장: [게임 시작]을 눌렀는지 · 친구 화면이 듣고 있는지('ready' 메시지를 받았는지) */
  const goRef = useRef(false)
  const listeningRef = useRef(false)
  const [peerGone, setPeerGone] = useState(false)
  useEffect(installAudioUnlock, [])

  function update(next: VolleyRecord) {
    saveRecord(next)
    setRecord(next)
  }

  const play = () => setScreen({ kind: 'game', key: Date.now() })
  const toStart = () => setScreen({ kind: 'start' })

  function finish(summary: GameSummary) {
    update(addGame(record, summary))
    setScreen(summary.mode === 'pvp' ? { kind: 'pvp-result', summary } : { kind: 'result', summary })
  }

  // 친구 대전 메시지 (경기 밖)
  // - 친구: 듣기 시작하면 'ready'를 보내고, 방장의 'start'(처음·다시 하기)를 받으면 새 경기
  // - 방장: 친구의 'ready'를 받으면 첫 경기 시작 (친구가 듣기 전에 시작하면 친구가 못 따라온다)
  const screenRef = useRef(screen)
  useEffect(() => {
    screenRef.current = screen
  })
  useEffect(() => {
    if (!pvp) return
    const { room } = pvp
    const offMsg = room.onMessage((msg) => {
      if (room.role === 'guest' && msg.t === 'start') setScreen({ kind: 'pvp-game', key: Date.now(), server: msg.server })
      if (room.role === 'host' && msg.t === 'ready' && screenRef.current.kind === 'pvp-wait') {
        listeningRef.current = true
        if (goRef.current) startPvp(room)
      }
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

  function connected(room: Room<VolleyMsg>, peer: Peer) {
    // 경기 메시지는 되도록 기기끼리 직접 (WebRTC). 자주 오는 상태는 빠져도 다음 것이 오므로 다시 안 보내는 채널로 (끝난 상태는 꼭 가게)
    setPvp({ room: withDirectLink(room, { lossy: (m) => m.t === 'state' && m.s.phase.kind !== 'done' }), peer })
    setPeerGone(false)
    goRef.current = false
    listeningRef.current = false
    setScreen({ kind: 'pvp-wait' })
  }

  /** 방장: 첫 서브를 무작위로 정해 친구에게 보내고 시작 */
  function startPvp(room: DirectRoom<VolleyMsg>) {
    goRef.current = false
    const server: Side = Math.random() < 0.5 ? 0 : 1
    room.send({ t: 'start', server })
    setScreen({ kind: 'pvp-game', key: Date.now(), server })
  }

  function leavePvp() {
    pvp?.room.leave()
    setPvp(null)
    toStart()
  }

  const inGame = screen.kind === 'game' || screen.kind === 'pvp-game'

  return (
    <main className={`page vb-page arcade${inGame ? ' arcade--play' : ''}`}>
      <PlayHeader className="vb-header" title="점프 배구" playing={inGame}>
        <SoundToggle />
        {inGame ? (
          <button type="button" className="button button--small" onClick={screen.kind === 'pvp-game' ? leavePvp : toStart}>
            그만하기
          </button>
        ) : (
          <HomeLink className="button button--small">
            나가기
          </HomeLink>
        )}
      </PlayHeader>

      {screen.kind === 'start' && (
        <StartScreen record={record} onLevel={(level) => update({ ...record, level })} onBot={play} onPvp={() => setScreen({ kind: 'lobby' })} />
      )}
      {screen.kind === 'lobby' && (
        <PvpLobby<VolleyMsg> gameId="volley" nickname={loadNickname() ?? '익명'} onConnected={connected} onBack={toStart} />
      )}
      {screen.kind === 'pvp-wait' &&
        pvp &&
        (peerGone ? (
          <div className="vb-pvp-wait">
            <p>연결이 끊겼어요. 다시 방을 만들거나 코드를 입력해 주세요</p>
            <button type="button" className="button" onClick={leavePvp}>
              나가기
            </button>
          </div>
        ) : (
          <DuelReadyRoom
            room={pvp.room}
            gameId="volley"
            me={loadNickname() ?? '나'}
            peer={pvp.peer.nickname}
            peerReady={peerReady}
            onStart={() => {
              goRef.current = true
              if (listeningRef.current) startPvp(pvp.room)
            }}
          />
        ))}
      {screen.kind === 'pvp-game' && pvp && (
        <GameScreen
          key={screen.key}
          mode="pvp"
          room={pvp.room}
          peerName={pvp.peer.nickname}
          peerAvatar={pvp.peer.avatar}
          server={screen.server}
          peerGone={peerGone}
          onFinish={finish}
          onQuit={leavePvp}
        />
      )}
      {screen.kind === 'pvp-result' && pvp && (
        <ResultScreen
          summary={screen.summary}
          record={record}
          isHost={pvp.room.role === 'host'}
          peerGone={peerGone}
          onRetry={() => peerReady && startPvp(pvp.room)}
          retryLocked={!peerReady}
          readySlot={<RematchReady room={pvp.room} gameId="volley" people={2} allReady={peerReady} waitText={`${pvp.peer.nickname}님이 준비하길 기다려요`} />}
          onMenu={leavePvp}
        />
      )}
      {screen.kind === 'game' && <GameScreen key={screen.key} mode="bot" level={record.level} onFinish={finish} />}
      {screen.kind === 'result' && <ResultScreen summary={screen.summary} record={record} onRetry={play} onMenu={toStart} />}
    </main>
  )
}
