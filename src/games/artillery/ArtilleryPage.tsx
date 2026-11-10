import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router'
import { wantsPvp } from '../../shared/nav'
import { installAudioUnlock } from '../../shared/audio/synth'
import type { Member, Room } from '../../shared/online/room'
import { loadNickname } from '../../shared/storage/nickname'
import type { TeamPick } from '../../shared/team/teams'
import { GroupLobby } from '../../shared/ui/GroupLobby'
import { RematchReady } from '../../shared/ui/Ready'
import { SoundToggle } from '../../shared/ui/SoundToggle'
import { MAX_PLAYERS, MIN_PLAYERS } from './constants'
import { GameScreen } from './game/GameScreen'
import type { ArtilleryMsg } from './play/pvp'
import { type ArtilleryRecord, type GameSummary, addGame, loadRecord, saveRecord } from './records'
import { ResultScreen } from './screens/ResultScreen'
import { StartScreen } from './screens/StartScreen'
import './artillery.css'

// 화면 흐름
// - 봇 연습: 시작(봇 수) → 경기 → 결과 → 다시 하기 / 처음으로
// - 친구 대전: 시작 → 대기실(방 목록·만들기, 모인 사람) → 경기 → 결과 → 다시 하기(방장) / 나가기
type Screen =
  | { kind: 'start' }
  | { kind: 'bot-game'; key: number }
  | { kind: 'lobby' }
  /** 방장은 시작할 때 방에 있던 사람들을 넘긴다 */
  | { kind: 'pvp-game'; key: number; members: Member[]; bots: number; teams: TeamPick | null }
  | { kind: 'result'; summary: GameSummary }

export function ArtilleryPage() {
  const [screen, setScreen] = useState<Screen>(() => (wantsPvp() ? { kind: 'lobby' } : { kind: 'start' }))
  const [record, setRecord] = useState<ArtilleryRecord>(() => loadRecord())
  const [room, setRoom] = useState<Room<ArtilleryMsg> | null>(null)
  const [members, setMembers] = useState<Member[]>([])
  /** 방장이 대기실에서 채운 봇 수 (다시 하기 때 씀) */
  const [pvpBots, setPvpBots] = useState(0)
  /** 방장이 대기실에서 고른 팀 (팀전, 다시 하기 때 씀) */
  const [pvpTeams, setPvpTeams] = useState<TeamPick | null>(null)
  /** 팀전에서 같은 팀도 공격할 수 있는지 (방장이 대기실에서 고름) */
  const [pvpFriendlyFire, setPvpFriendlyFire] = useState(false)
  useEffect(installAudioUnlock, [])

  function update(next: ArtilleryRecord) {
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
      if (room.role === 'guest' && msg.t === 'start') setScreen({ kind: 'pvp-game', key: Date.now(), members: [], bots: 0, teams: null })
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
  function startPvp(r: Room<ArtilleryMsg>, with_: Member[], bots: number, teams: TeamPick | null) {
    // 그새 친구가 더 들어왔으면 봇을 그만큼 줄인다
    const n = Math.max(0, Math.min(bots, MAX_PLAYERS - with_.length - 1))
    setPvpBots(n)
    setPvpTeams(teams)
    r.send({ t: 'start' })
    setScreen({ kind: 'pvp-game', key: Date.now(), members: with_, bots: n, teams })
  }

  function leaveRoom() {
    room?.leave()
    setRoom(null)
    setMembers([])
    setPvpBots(0)
    setPvpTeams(null)
    toStart()
  }

  const inGame = screen.kind === 'bot-game' || screen.kind === 'pvp-game'
  const isHost = room?.role === 'host'
  // 다시 하기 전 준비 (사용자 요청): 방에 있는 친구가 모두 [준비]해야 방장이 다시 하기
  const friendGuests = members.filter((m) => m.role === 'guest')
  const readyCount = friendGuests.filter((m) => m.ready).length
  const allReady = readyCount === friendGuests.length

  return (
    <main className="page sv-page">
      <header className="sv-header">
        <h1 className="title">탱크 대전</h1>
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
          onLevel={(level) => update({ ...record, level })}
          onBot={() => setScreen({ kind: 'bot-game', key: Date.now() })}
          onPvp={() => setScreen({ kind: 'lobby' })}
        />
      )}
      {screen.kind === 'lobby' && (
        <GroupLobby<ArtilleryMsg>
          gameId="artillery"
          nickname={loadNickname() ?? '익명'}
          capacity={MAX_PLAYERS}
          minPlayers={MIN_PLAYERS}
          teams
          friendlyFire
          onConnected={setRoom}
          onStart={(with_, bots, teams, ff) => {
            setPvpFriendlyFire(ff)
            if (room) startPvp(room, with_, bots, teams)
          }}
          onBack={() => {
            setRoom(null)
            toStart()
          }}
        />
      )}
      {screen.kind === 'bot-game' && <GameScreen key={screen.key} mode="bot" bots={record.bots} level={record.level} onFinish={finish} />}
      {screen.kind === 'pvp-game' &&
        room &&
        (room.role === 'host' ? (
          <GameScreen key={screen.key} mode="host" room={room} members={screen.members} bots={screen.bots} teams={screen.teams} friendlyFire={pvpFriendlyFire} onFinish={finish} onQuit={leaveRoom} />
        ) : (
          <GameScreen key={screen.key} mode="guest" room={room} onFinish={finish} onQuit={leaveRoom} />
        ))}
      {screen.kind === 'result' && (
        <ResultScreen
          summary={screen.summary}
          record={record}
          isHost={screen.summary.mode === 'bot' || isHost}
          retryLocked={screen.summary.mode === 'pvp' && !allReady}
          readySlot={
            screen.summary.mode === 'pvp' && room ? (
              <RematchReady room={room} allReady={allReady} waitText={`친구들이 준비하길 기다려요 (${readyCount}/${friendGuests.length})`} />
            ) : undefined
          }
          canRetry={screen.summary.mode === 'bot' || Math.min(MAX_PLAYERS, members.length + 1 + pvpBots) >= MIN_PLAYERS}
          onRetry={() => {
            if (screen.summary.mode === 'bot') setScreen({ kind: 'bot-game', key: Date.now() })
            else if (room && allReady) startPvp(room, members, pvpBots, pvpTeams)
          }}
          onMenu={screen.summary.mode === 'pvp' ? leaveRoom : toStart}
        />
      )}
    </main>
  )
}
