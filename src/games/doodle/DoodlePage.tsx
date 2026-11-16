import { useEffect, useRef, useState } from 'react'
import { HomeLink } from '../../shared/ui/HomeLink'
import { wantsPvp } from '../../shared/nav'
import { installAudioUnlock } from '../../shared/audio/synth'
import type { Member, Room } from '../../shared/online/room'
import { loadNickname } from '../../shared/storage/nickname'
import { GroupLobby } from '../../shared/ui/GroupLobby'
import { RematchReady } from '../../shared/ui/Ready'
import { PlayHeader } from '../../shared/ui/PlayHeader'
import { SoundToggle } from '../../shared/ui/SoundToggle'
import { MAX_PLAYERS, MIN_PLAYERS } from './constants'
import { GameScreen } from './game/GameScreen'
import type { DoodleMsg } from './play/pvp'
import { type DoodleRecord, type GameSummary, addGame, loadRecord, saveRecord } from './records'
import { ResultScreen } from './screens/ResultScreen'
import './doodle.css'

// 그림 맞히기 (2026-11-16 사용자 요청). 친구 대전만(봇 없음): 시작 → 대기실 → 경기 → 결과 → 다시 하기(방장) / 나가기
type Screen = { kind: 'start' } | { kind: 'lobby' } | { kind: 'game'; key: number; members: Member[] } | { kind: 'result'; summary: GameSummary }

export function DoodlePage() {
  const [screen, setScreen] = useState<Screen>(() => (wantsPvp() ? { kind: 'lobby' } : { kind: 'start' }))
  const [record, setRecord] = useState<DoodleRecord>(() => loadRecord())
  const [room, setRoom] = useState<Room<DoodleMsg> | null>(null)
  const [members, setMembers] = useState<Member[]>([])
  useEffect(installAudioUnlock, [])

  useEffect(() => {
    if (!room) return
    const offMembers = room.onMembers(setMembers)
    const offMsg = room.onMessage((msg) => {
      if (room.role === 'guest' && msg.t === 'start') setScreen({ kind: 'game', key: Date.now(), members: [] })
    })
    return () => {
      offMembers()
      offMsg()
    }
  }, [room])

  const roomRef = useRef(room)
  useEffect(() => {
    roomRef.current = room
  })
  useEffect(() => () => roomRef.current?.leave(), [])

  function start(r: Room<DoodleMsg>, with_: Member[]) {
    r.send({ t: 'start' })
    setScreen({ kind: 'game', key: Date.now(), members: with_ })
  }

  function finish(summary: GameSummary) {
    const next = addGame(record, summary)
    saveRecord(next)
    setRecord(next)
    setScreen({ kind: 'result', summary })
  }

  function leaveRoom() {
    room?.leave()
    setRoom(null)
    setMembers([])
    setScreen({ kind: 'start' })
  }

  const inGame = screen.kind === 'game'
  const friendGuests = members.filter((m) => m.role === 'guest')
  const readyCount = friendGuests.filter((m) => m.ready).length
  const allReady = readyCount === friendGuests.length

  return (
    <main className={`page dd-page arcade${inGame ? ' arcade--play' : ''}`}>
      <PlayHeader className="dd-header" title="그림 맞히기" playing={inGame}>
        <SoundToggle />
        {inGame ? (
          <button type="button" className="button button--small" onClick={leaveRoom}>
            그만하기
          </button>
        ) : (
          <HomeLink className="button button--small">나가기</HomeLink>
        )}
      </PlayHeader>

      {screen.kind === 'start' && (
        <section className="dd-start">
          <p className="dd-start__lead">한 명이 그리고 나머지가 맞혀요. 빨리 맞힐수록 점수가 높아요.</p>
          <ul className="dd-start__rules">
            <li>2~8명 · 한 사람씩 돌아가며 60초 동안 그려요 (3명 이하면 두 번씩)</li>
            <li>처음 40초는 채팅으로, 마지막 20초엔 보기 4개도 나와요 (보기는 점수 절반)</li>
            <li>그린 사람도 맞힌 사람 1명당 3점</li>
          </ul>
          <p className="dd-start__career">
            친구 대전 {record.games}판 · 우승 {record.wins}번 · 최고 {record.best}점
          </p>
          <button type="button" className="button button--primary dd-start__go" onClick={() => setScreen({ kind: 'lobby' })}>
            친구랑 하기
          </button>
        </section>
      )}
      {screen.kind === 'lobby' && (
        <GroupLobby<DoodleMsg>
          gameId="doodle"
          nickname={loadNickname() ?? '익명'}
          capacity={MAX_PLAYERS}
          minPlayers={MIN_PLAYERS}
          noBots
          onConnected={setRoom}
          onStart={(with_) => room && start(room, with_)}
          onBack={() => {
            room?.leave()
            setRoom(null)
            setScreen({ kind: 'start' })
          }}
        />
      )}
      {screen.kind === 'game' && room && <GameScreen key={screen.key} room={room} members={screen.members} onFinish={finish} onQuit={leaveRoom} />}
      {screen.kind === 'result' && (
        <ResultScreen
          summary={screen.summary}
          record={record}
          isHost={room?.role === 'host'}
          retryLocked={!allReady}
          readySlot={room ? <RematchReady room={room} gameId="doodle" people={members.length + 1} allReady={allReady} waitText={`친구들이 준비하길 기다려요 (${readyCount}/${friendGuests.length})`} /> : undefined}
          canRetry={members.length + 1 >= MIN_PLAYERS}
          onRetry={() => room && allReady && start(room, members)}
          onMenu={leaveRoom}
        />
      )}
    </main>
  )
}
