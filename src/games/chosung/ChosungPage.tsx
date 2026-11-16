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
import { MAX_PLAYERS, MIN_PLAYERS, QUESTIONS } from './constants'
import { GameScreen } from './game/GameScreen'
import type { ChosungMsg } from './play/pvp'
import { type ChosungRecord, type GameSummary, addGame, loadRecord, saveRecord } from './records'
import './chosung.css'

// 초성 퀴즈 (2026-11-16 사용자 요청). 혼자 하기(폰에서) + 친구 대전(우리 게임 서버가 심판)
type Screen =
  | { kind: 'start' }
  | { kind: 'solo'; key: number }
  | { kind: 'lobby' }
  | { kind: 'pvp'; key: number; members: Member[] }
  | { kind: 'result'; summary: GameSummary }

export function ChosungPage() {
  const [screen, setScreen] = useState<Screen>(() => (wantsPvp() ? { kind: 'lobby' } : { kind: 'start' }))
  const [record, setRecord] = useState<ChosungRecord>(() => loadRecord())
  const [room, setRoom] = useState<Room<ChosungMsg> | null>(null)
  const [members, setMembers] = useState<Member[]>([])
  useEffect(installAudioUnlock, [])

  useEffect(() => {
    if (!room) return
    const offMembers = room.onMembers(setMembers)
    const offMsg = room.onMessage((msg) => {
      if (room.role === 'guest' && msg.t === 'start') setScreen({ kind: 'pvp', key: Date.now(), members: [] })
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

  function startPvp(r: Room<ChosungMsg>, with_: Member[]) {
    r.send({ t: 'start' })
    setScreen({ kind: 'pvp', key: Date.now(), members: with_ })
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

  const inGame = screen.kind === 'solo' || screen.kind === 'pvp'
  const friendGuests = members.filter((m) => m.role === 'guest')
  const readyCount = friendGuests.filter((m) => m.ready).length
  const allReady = readyCount === friendGuests.length

  return (
    <main className={`page cs-page arcade${inGame ? ' arcade--play' : ''}`}>
      <PlayHeader className="cs-header" title="초성 퀴즈" playing={inGame}>
        <SoundToggle />
        {inGame ? (
          <button type="button" className="button button--small" onClick={screen.kind === 'pvp' ? leaveRoom : () => setScreen({ kind: 'start' })}>
            그만하기
          </button>
        ) : (
          <HomeLink className="button button--small">나가기</HomeLink>
        )}
      </PlayHeader>

      {screen.kind === 'start' && (
        <section className="cs-start">
          <p className="cs-start__lead">'ㄱㄹ (동물)' → 기린! 초성을 보고 먼저 맞히면 점수.</p>
          <ul className="cs-start__rules">
            <li>한 판 {QUESTIONS}문제 · 한 문제 20초 · 10초가 지나면 글자 하나 힌트 (그 뒤 점수 절반)</li>
            <li>친구 대전은 맞힌 순서대로 10·7·5·3·2점</li>
          </ul>
          <p className="cs-start__career">
            혼자 {record.solo.games}판 · 최고 {record.solo.best}점 · 친구 대전 {record.pvp.games}판 · 우승 {record.pvp.wins}번
          </p>
          <button type="button" className="button button--primary cs-start__go" onClick={() => setScreen({ kind: 'solo', key: Date.now() })}>
            혼자 하기
          </button>
          <button type="button" className="button cs-start__go" onClick={() => setScreen({ kind: 'lobby' })}>
            친구랑 하기
          </button>
        </section>
      )}
      {screen.kind === 'lobby' && (
        <GroupLobby<ChosungMsg>
          gameId="chosung"
          nickname={loadNickname() ?? '익명'}
          capacity={MAX_PLAYERS}
          minPlayers={MIN_PLAYERS}
          noBots
          onConnected={setRoom}
          onStart={(with_) => room && startPvp(room, with_)}
          onBack={() => {
            room?.leave()
            setRoom(null)
            setScreen({ kind: 'start' })
          }}
        />
      )}
      {screen.kind === 'solo' && <GameScreen key={screen.key} mode="solo" onFinish={finish} onQuit={() => setScreen({ kind: 'start' })} />}
      {screen.kind === 'pvp' && room && <GameScreen key={screen.key} mode="pvp" room={room} members={screen.members} onFinish={finish} onQuit={leaveRoom} />}
      {screen.kind === 'result' && (
        <section className="cs-result">
          <div className={`cs-result__headline${screen.summary.mode === 'pvp' && screen.summary.rank === 1 ? ' cs-result__headline--win' : ''}`}>
            <strong>{screen.summary.mode === 'solo' ? `${screen.summary.score}점` : screen.summary.rank === 1 ? '우승!' : `${screen.summary.rank}등`}</strong>
            <span>
              {screen.summary.total}문제 중 {screen.summary.solved}개 맞힘{screen.summary.mode === 'pvp' ? ` · ${screen.summary.score}점` : ''}
            </span>
          </div>
          {screen.summary.mode === 'pvp' && (
            <ol className="cs-result__ranking">
              {screen.summary.ranking.map((r, i) => (
                <li key={`${r.name}-${i}`} className={r.me ? 'cs-result__me' : ''}>
                  <span>{r.rank}등</span> {r.name} <b>{r.score}점</b>
                </li>
              ))}
            </ol>
          )}
          <p className="cs-start__career">
            {screen.summary.mode === 'solo' ? `혼자 ${record.solo.games}판 · 최고 ${record.solo.best}점` : `친구 대전 ${record.pvp.games}판 · 우승 ${record.pvp.wins}번`}
          </p>
          {screen.summary.mode === 'pvp' && room && (
            <RematchReady room={room} gameId="chosung" people={members.length + 1} allReady={allReady} waitText={`친구들이 준비하길 기다려요 (${readyCount}/${friendGuests.length})`} />
          )}
          <div className="cs-result__buttons">
            {(screen.summary.mode === 'solo' || room?.role === 'host') && (
              <button
                type="button"
                className="button button--primary"
                disabled={screen.summary.mode === 'pvp' && (!allReady || members.length + 1 < MIN_PLAYERS)}
                onClick={() => (screen.summary.mode === 'solo' ? setScreen({ kind: 'solo', key: Date.now() }) : room && startPvp(room, members))}
              >
                다시 하기
              </button>
            )}
            <button type="button" className="button" onClick={screen.summary.mode === 'pvp' ? leaveRoom : () => setScreen({ kind: 'start' })}>
              {screen.summary.mode === 'pvp' ? '나가기' : '처음으로'}
            </button>
          </div>
        </section>
      )}
    </main>
  )
}
