import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router'
import { installAudioUnlock } from '../../shared/audio/synth'
import type { Member, Room } from '../../shared/online/room'
import { loadNickname } from '../../shared/storage/nickname'
import { GroupLobby } from '../../shared/ui/GroupLobby'
import { SoundToggle } from '../../shared/ui/SoundToggle'
import { MAX_PLAYERS, MIN_PLAYERS } from './constants'
import { GameScreen } from './game/GameScreen'
import type { BombMsg } from './play/pvp'
import { type BombRecord, type GameSummary, addGame, loadRecord, saveRecord } from './records'
import { ResultScreen } from './screens/ResultScreen'
import { StartScreen } from './screens/StartScreen'
import './bomb.css'

// 화면 흐름
// - 봇 연습: 시작(봇 수) → 경기 → 결과 → 다시 하기 / 처음으로
// - 친구 대전: 시작 → 대기실(방 만들기·코드 입력, 모인 사람) → 경기 → 결과 → 다시 하기(방장) / 나가기
type Screen =
  | { kind: 'start' }
  | { kind: 'bot-game'; key: number }
  | { kind: 'lobby' }
  /** 방장은 시작할 때 방에 있던 사람들을 넘긴다 */
  | { kind: 'pvp-game'; key: number; members: Member[] }
  | { kind: 'result'; summary: GameSummary }

export function BombPage() {
  const [screen, setScreen] = useState<Screen>({ kind: 'start' })
  const [record, setRecord] = useState<BombRecord>(() => loadRecord())
  const [room, setRoom] = useState<Room<BombMsg> | null>(null)
  const [members, setMembers] = useState<Member[]>([])
  useEffect(installAudioUnlock, [])

  function update(next: BombRecord) {
    saveRecord(next)
    setRecord(next)
  }

  const toStart = () => setScreen({ kind: 'start' })

  function finish(summary: GameSummary) {
    update(addGame(record, summary))
    setScreen({ kind: 'result', summary })
  }

  // 친구 대전: 방 사람 목록을 계속 알고 있고(다시 하기 때 씀), 친구는 방장의 'start'로 경기에 들어간다
  useEffect(() => {
    if (!room) return
    const offMembers = room.onMembers(setMembers)
    const offMsg = room.onMessage((msg) => {
      if (room.role === 'guest' && msg.t === 'start') setScreen({ kind: 'pvp-game', key: Date.now(), members: [] })
    })
    return () => {
      offMembers()
      offMsg()
    }
  }, [room])

  // 화면을 떠나면 방을 닫는다
  const roomRef = useRef(room)
  useEffect(() => {
    roomRef.current = room
  })
  useEffect(() => () => roomRef.current?.leave(), [])

  /** 방장: 지금 방에 있는 사람들로 시작 */
  function startPvp(r: Room<BombMsg>, with_: Member[]) {
    r.send({ t: 'start' })
    setScreen({ kind: 'pvp-game', key: Date.now(), members: with_ })
  }

  function leaveRoom() {
    room?.leave()
    setRoom(null)
    setMembers([])
    toStart()
  }

  const inGame = screen.kind === 'bot-game' || screen.kind === 'pvp-game'
  const isHost = room?.role === 'host'

  return (
    <main className="page bm-page">
      <header className="bm-header">
        <h1 className="title">폭탄 돌리기</h1>
        <SoundToggle />
        {inGame ? (
          <button type="button" className="button button--small" onClick={screen.kind === 'pvp-game' ? leaveRoom : toStart}>
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
          onBots={(bots) => update({ ...record, bots })}
          onBot={() => setScreen({ kind: 'bot-game', key: Date.now() })}
          onPvp={() => setScreen({ kind: 'lobby' })}
        />
      )}
      {screen.kind === 'lobby' && (
        <GroupLobby<BombMsg>
          gameId="bomb"
          nickname={loadNickname() ?? '익명'}
          capacity={MAX_PLAYERS}
          minPlayers={MIN_PLAYERS}
          onConnected={setRoom}
          onStart={(with_) => room && startPvp(room, with_)}
          onBack={() => {
            setRoom(null)
            toStart()
          }}
        />
      )}
      {screen.kind === 'bot-game' && <GameScreen key={screen.key} mode="bot" bots={record.bots} onFinish={finish} />}
      {screen.kind === 'pvp-game' &&
        room &&
        (room.role === 'host' ? (
          <GameScreen key={screen.key} mode="host" room={room} members={screen.members} onFinish={finish} onQuit={leaveRoom} />
        ) : (
          <GameScreen key={screen.key} mode="guest" room={room} onFinish={finish} onQuit={leaveRoom} />
        ))}
      {screen.kind === 'result' && (
        <ResultScreen
          summary={screen.summary}
          record={record}
          isHost={screen.summary.mode === 'bot' || isHost}
          canRetry={screen.summary.mode === 'bot' || members.length + 1 >= MIN_PLAYERS}
          onRetry={() => {
            if (screen.summary.mode === 'bot') setScreen({ kind: 'bot-game', key: Date.now() })
            else if (room) startPvp(room, members)
          }}
          onMenu={screen.summary.mode === 'pvp' ? leaveRoom : toStart}
        />
      )}
    </main>
  )
}
