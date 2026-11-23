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
import type { SpotMsg } from './play/pvp'
import { type GameSummary, type SpotRecord, addGame, formatMs, loadRecord, saveRecord } from './records'
import './spotdiff.css'

// 다른 그림 찾기 (2026-11-23 사용자 요청). 혼자 하기(폰에서, 점수) + 친구 대전(우리 게임 서버가 심판, 총 걸린 시간)
type Screen =
  | { kind: 'start' }
  | { kind: 'solo'; key: number }
  | { kind: 'lobby' }
  | { kind: 'pvp'; key: number; members: Member[] }
  | { kind: 'result'; summary: GameSummary }

export function SpotdiffPage() {
  const [screen, setScreen] = useState<Screen>(() => (wantsPvp() ? { kind: 'lobby' } : { kind: 'start' }))
  const [record, setRecord] = useState<SpotRecord>(() => loadRecord())
  const [room, setRoom] = useState<Room<SpotMsg> | null>(null)
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

  function startPvp(r: Room<SpotMsg>, with_: Member[]) {
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
    <main className={`page sd-page arcade${inGame ? ' arcade--play' : ''}`}>
      <PlayHeader className="sd-header" title="다른 그림 찾기" playing={inGame}>
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
        <section className="sd-start">
          <p className="sd-start__lead">두 그림에서 다른 곳 7개를 찾아요.</p>
          <ul className="sd-start__rules">
            <li>한 판 {QUESTIONS}문제 · 문제마다 60초 · 틀린 곳을 누르면 3초 쉬어요</li>
            <li>혼자 하기: 찾을 때마다 100점 + 다 찾으면 남은 초 × 10점</li>
            <li>친구 대전: 같은 그림을 각자 풀고, 총 걸린 시간이 짧은 사람이 1등 (못 찾은 곳은 하나에 10초씩 더함)</li>
          </ul>
          <p className="sd-start__career">
            혼자 {record.solo.games}판 · 최고 {record.solo.best}점 · 친구 대전 {record.pvp.games}판 · 우승 {record.pvp.wins}번
            {record.pvp.fastest ? ` · 가장 빠름 ${formatMs(record.pvp.fastest)}` : ''}
          </p>
          <button type="button" className="button button--primary sd-start__go" onClick={() => setScreen({ kind: 'solo', key: Date.now() })}>
            혼자 하기
          </button>
          <button type="button" className="button sd-start__go" onClick={() => setScreen({ kind: 'lobby' })}>
            친구랑 하기
          </button>
        </section>
      )}
      {screen.kind === 'lobby' && (
        <GroupLobby<SpotMsg>
          gameId="spotdiff"
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
        <section className="sd-result">
          <div className={`sd-result__headline${screen.summary.mode === 'pvp' && screen.summary.rank === 1 ? ' sd-result__headline--win' : ''}`}>
            <strong>{screen.summary.mode === 'solo' ? `${screen.summary.score}점` : screen.summary.rank === 1 ? '우승!' : `${screen.summary.rank}등`}</strong>
            <span>
              {screen.summary.total}곳 중 {screen.summary.found}곳 찾음 · {screen.summary.mode === 'pvp' ? '총 ' : ''}
              {formatMs(screen.summary.ms)}
            </span>
          </div>
          {screen.summary.mode === 'pvp' && (
            <ol className="sd-result__ranking">
              {screen.summary.ranking.map((r, i) => (
                <li key={`${r.name}-${i}`} className={r.me ? 'sd-result__me' : ''}>
                  <span>{r.rank}등</span> {r.name} <b>{r.left ? '나감' : formatMs(r.ms)}</b>
                </li>
              ))}
            </ol>
          )}
          <p className="sd-start__career">
            {screen.summary.mode === 'solo'
              ? `혼자 ${record.solo.games}판 · 최고 ${record.solo.best}점`
              : `친구 대전 ${record.pvp.games}판 · 우승 ${record.pvp.wins}번${record.pvp.fastest ? ` · 가장 빠름 ${formatMs(record.pvp.fastest)}` : ''}`}
          </p>
          {screen.summary.mode === 'pvp' && room && (
            <RematchReady room={room} gameId="spotdiff" people={members.length + 1} allReady={allReady} waitText={`친구들이 준비하길 기다려요 (${readyCount}/${friendGuests.length})`} />
          )}
          <div className="sd-result__buttons">
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
