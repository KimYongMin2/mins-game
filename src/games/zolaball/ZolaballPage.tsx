import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router'
import { installAudioUnlock } from '../../shared/audio/synth'
import type { Peer, Room } from '../../shared/online/room'
import { loadNickname } from '../../shared/storage/nickname'
import { PvpLobby } from '../../shared/ui/PvpLobby'
import { SoundToggle } from '../../shared/ui/SoundToggle'
import { MatchScreen } from './match/MatchScreen'
import type { MatchConfig, MatchSummary } from './match/matchState'
import type { BaseballMsg } from './match/pvp'
import { BattingPractice } from './practice/BattingPractice'
import { type UploadStatus, flushPendingGames, submitGame } from './ranking/online'
import { type ZolaballRecord, addMatch, loadRecord, saveRecord } from './records'
import type { Side } from './rules/game'
import type { Difficulty } from './rules/judge'
import { MenuScreen } from './screens/MenuScreen'
import { PvpResultScreen } from './screens/PvpResultScreen'
import { RankingScreen } from './screens/RankingScreen'
import { ResultScreen } from './screens/ResultScreen'
import './zolaball.css'

// 화면 흐름
// - 봇 대전: 난이도 선택 → 경기 → 결과 (타격 연습·랭킹은 난이도 선택에서)
// - 친구 대전: 대기실(방 만들기·코드 입력) → 경기 → 결과 → 다시 하기(방장) / 나가기
type Screen =
  | { kind: 'menu' }
  | { kind: 'practice' }
  | { kind: 'ranking'; difficulty: Difficulty }
  | { kind: 'match'; config: MatchConfig; key: number }
  | { kind: 'result'; summary: MatchSummary }
  | { kind: 'lobby' }
  /** 둘이 모였고 첫 경기를 기다리는 중 */
  | { kind: 'pvp-wait' }
  | { kind: 'pvp-match'; config: MatchConfig; key: number }
  | { kind: 'pvp-result'; summary: MatchSummary }

type Pvp = { room: Room<BaseballMsg>; peer: Peer }

const otherSide = (side: Side): Side => (side === 'away' ? 'home' : 'away')


export function ZolaballPage() {
  const [screen, setScreen] = useState<Screen>({ kind: 'menu' })
  const [record, setRecord] = useState<ZolaballRecord>(() => loadRecord())
  const [upload, setUpload] = useState<UploadStatus>('saving')
  const [pvp, setPvp] = useState<Pvp | null>(null)
  const [peerGone, setPeerGone] = useState(false)
  useEffect(installAudioUnlock, [])
  // 지난번에 못 올린 기록이 있으면 다시 보낸다.
  useEffect(() => {
    void flushPendingGames()
  }, [])

  function startMatch(difficulty: Difficulty) {
    // 선공·후공은 매 경기 무작위
    const userSide = Math.random() < 0.5 ? 'away' : 'home'
    setScreen({ kind: 'match', config: { difficulty, userSide }, key: Date.now() })
  }

  function finishMatch(summary: MatchSummary) {
    const next = addMatch(record, summary)
    saveRecord(next)
    setRecord(next)
    setScreen({ kind: 'result', summary })
    setUpload('saving')
    submitGame(summary, loadNickname() ?? '익명')
      .then(setUpload)
      .catch(() => setUpload('queued'))
  }

  const toMenu = () => setScreen({ kind: 'menu' })

  // 친구 대전 메시지 (경기 밖)
  // - 친구: 방장의 'start'(처음·다시 하기)를 받으면 정해진 공수로 새 경기
  // - 방장: 친구의 'ready'를 받으면 첫 경기 시작 (친구가 듣기 전에 시작하면 친구가 못 따라온다)
  const screenRef = useRef(screen)
  useEffect(() => {
    screenRef.current = screen
  })
  useEffect(() => {
    if (!pvp) return
    const { room } = pvp
    const offMsg = room.onMessage((msg) => {
      if (room.role === 'guest' && msg.t === 'start') {
        setScreen({ kind: 'pvp-match', config: pvpConfig(msg.guestSide), key: Date.now() })
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

  /** 친구 대전 판정은 일반 난이도 구간 */
  function pvpConfig(userSide: Side): MatchConfig {
    return { difficulty: 'normal', userSide, opponent: 'remote' }
  }

  function connected(room: Room<BaseballMsg>, peer: Peer) {
    setPvp({ room, peer })
    setPeerGone(false)
    setScreen({ kind: 'pvp-wait' })
  }

  /** 방장: 선공·후공을 무작위로 정해 알리고 시작 */
  function startPvp(room: Room<BaseballMsg>) {
    const hostSide: Side = Math.random() < 0.5 ? 'away' : 'home'
    room.send({ t: 'start', guestSide: otherSide(hostSide) })
    setScreen({ kind: 'pvp-match', config: pvpConfig(hostSide), key: Date.now() })
  }

  function finishPvp(summary: MatchSummary) {
    const next = addMatch(record, summary)
    saveRecord(next)
    setRecord(next)
    setScreen({ kind: 'pvp-result', summary })
  }

  function leavePvp() {
    pvp?.room.leave()
    setPvp(null)
    toMenu()
  }

  return (
    <main className="page zb-page">
      <header className="zb-header">
        <h1 className="title">
          야구{screen.kind === 'practice' && ' · 타격 연습'}
          {screen.kind === 'ranking' && ' · 랭킹'}
        </h1>
        <SoundToggle />
        {screen.kind === 'match' || screen.kind === 'practice' || screen.kind === 'pvp-match' ? (
          <button type="button" className="button button--small" onClick={screen.kind === 'pvp-match' ? leavePvp : toMenu}>
            그만하기
          </button>
        ) : (
          <Link className="button button--small" to="/">
            나가기
          </Link>
        )}
      </header>

      {screen.kind === 'menu' && (
        <MenuScreen
          record={record}
          onStart={startMatch}
          onPractice={() => setScreen({ kind: 'practice' })}
          onPvp={() => setScreen({ kind: 'lobby' })}
          onRanking={() => setScreen({ kind: 'ranking', difficulty: 'normal' })}
        />
      )}

      {screen.kind === 'ranking' && <RankingScreen initialDifficulty={screen.difficulty} onBack={toMenu} />}

      {screen.kind === 'practice' && <BattingPractice />}

      {screen.kind === 'match' && <MatchScreen key={screen.key} config={screen.config} onFinish={finishMatch} />}

      {screen.kind === 'lobby' && (
        <PvpLobby<BaseballMsg> gameId="zolaball" nickname={loadNickname() ?? '익명'} onConnected={connected} onBack={toMenu} />
      )}
      {screen.kind === 'pvp-wait' && pvp && (
        peerGone ? (
          <div className="zb-pvp-wait">
            <p>연결이 끊겼어요. 다시 방을 만들거나 코드를 입력해 주세요</p>
            <button type="button" className="button" onClick={leavePvp}>
              나가기
            </button>
          </div>
        ) : (
          <p className="zb-pvp-wait">
            {pvp.room.role === 'host' ? `${pvp.peer.nickname}님이 들어왔어요` : `${pvp.peer.nickname}님 방에 들어왔어요`}. 곧
            시작해요…
          </p>
        )
      )}
      {screen.kind === 'pvp-match' && pvp && (
        <MatchScreen
          key={screen.key}
          config={screen.config}
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

      {screen.kind === 'result' && (
        <ResultScreen
          summary={screen.summary}
          record={record}
          upload={upload}
          onRematch={() => startMatch(screen.summary.config.difficulty)}
          onRanking={() => setScreen({ kind: 'ranking', difficulty: screen.summary.config.difficulty })}
          onMenu={toMenu}
        />
      )}
    </main>
  )
}
