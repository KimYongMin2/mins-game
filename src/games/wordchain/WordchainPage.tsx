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
import { type GameSummary, GameScreen } from './game/GameScreen'
import type { WordchainMsg } from './play/pvp'
import { type WordchainRecord, addGame, loadRecord, saveRecord } from './records'
import './wordchain.css'

// 끝말잇기 (2026-11-16 사용자 요청). 친구 대전만(봇 없음), 표준국어대사전으로 명사 확인
type Screen = { kind: 'start' } | { kind: 'lobby' } | { kind: 'game'; key: number; members: Member[] } | { kind: 'result'; summary: GameSummary }

export function WordchainPage() {
  const [screen, setScreen] = useState<Screen>(() => (wantsPvp() ? { kind: 'lobby' } : { kind: 'start' }))
  const [record, setRecord] = useState<WordchainRecord>(() => loadRecord())
  const [room, setRoom] = useState<Room<WordchainMsg> | null>(null)
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

  function start(r: Room<WordchainMsg>, with_: Member[]) {
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
    <main className={`page wc-page arcade${inGame ? ' arcade--play' : ''}`}>
      <PlayHeader className="wc-header" title="끝말잇기" playing={inGame}>
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
        <section className="wc-start">
          <p className="wc-start__lead">앞 낱말의 끝 글자로 시작하는 낱말을 10초 안에!</p>
          <ul className="wc-start__rules">
            <li>2~8명이 돌아가며 · 두 글자 이상 명사 (표준국어대사전에 있는 낱말)</li>
            <li>두음법칙 인정 (력 → 역, 라 → 나) · 이미 나온 낱말은 안 돼요</li>
            <li>틀리면 시간 안에 다시 낼 수 있고, 10초가 지나면 탈락 · 마지막까지 남으면 우승</li>
          </ul>
          <p className="wc-start__career">
            친구 대전 {record.games}판 · 우승 {record.wins}번 · 한 판 최다 {record.bestWords}개
          </p>
          <button type="button" className="button button--primary wc-start__go" onClick={() => setScreen({ kind: 'lobby' })}>
            친구랑 하기
          </button>
        </section>
      )}
      {screen.kind === 'lobby' && (
        <GroupLobby<WordchainMsg>
          gameId="wordchain"
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
        <section className="wc-result">
          <div className={`wc-result__headline${screen.summary.rank === 1 ? ' wc-result__headline--win' : ''}`}>
            <strong>{screen.summary.rank === 1 ? '우승!' : `${screen.summary.rank}등`}</strong>
            <span>
              모두 {screen.summary.total}개 이음 · 내가 {screen.summary.words}개
            </span>
          </div>
          <ol className="wc-result__ranking">
            {screen.summary.ranking.map((r, i) => (
              <li key={`${r.name}-${i}`} className={r.me ? 'wc-result__me' : ''}>
                <span>{r.rank}등</span> {r.name}
              </li>
            ))}
          </ol>
          {room && <RematchReady room={room} gameId="wordchain" people={members.length + 1} allReady={allReady} waitText={`친구들이 준비하길 기다려요 (${readyCount}/${friendGuests.length})`} />}
          <div className="wc-result__buttons">
            {room?.role === 'host' && (
              <button type="button" className="button button--primary" disabled={!allReady || members.length + 1 < MIN_PLAYERS} onClick={() => start(room, members)}>
                다시 하기
              </button>
            )}
            <button type="button" className="button" onClick={leaveRoom}>
              나가기
            </button>
          </div>
        </section>
      )}
    </main>
  )
}
