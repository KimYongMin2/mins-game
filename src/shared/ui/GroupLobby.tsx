import { useEffect, useRef, useState } from 'react'
import { type ListedRoom, type Member, type Room, RoomError, channelCode, createRoom, joinRoom, makeRoomCode } from '../online/room'
import { RoomBadge, RoomPicker } from './RoomPicker'

// 여럿이 하는 게임의 대기실: 열린 방 목록에서 고르거나 방 만들기(이름 · 전체 공개 / 비공개 코드) → 모인 사람 목록.
// 방장이 시작하면 목록에 '게임 중'으로 바뀌어 새로 못 들어온다.
// 방장은 빈자리에 봇을 채울 수 있다(사람이 모자랄 때). 방장이 [시작]을 누르면 onStart로 사람 목록과 봇 수를 넘긴다. 친구 쪽 시작은 게임이 메시지로 처리한다.
// 연결되면 바로 onConnected로 방을 넘기고, 그 뒤로 방을 닫는 건 게임(페이지)이 한다. 게임 규칙은 모른다.

type Props<M> = {
  gameId: string
  nickname: string
  /** 정원 (나 포함) */
  capacity: number
  /** 이만큼 모여야 시작할 수 있다 (나 포함) */
  minPlayers: number
  onConnected: (room: Room<M>) => void
  /** 방장이 시작함. 나 말고 방에 있는 사람들 (들어온 순서)과 채울 봇 수 */
  onStart: (members: Member[], bots: number) => void
  /** 돌아가기 (연결된 방이 있으면 이미 닫은 뒤) */
  onBack: () => void
}

type View =
  | { kind: 'menu' }
  | { kind: 'busy'; text: string }
  | { kind: 'waiting'; name: string; pin: string | null }
  | { kind: 'error'; text: string }

const ERROR_TEXT: Record<RoomError['reason'], string> = {
  'not-found': '방이 없어졌어요',
  full: '방이 가득 찼어요',
  offline: '서버에 연결하지 못했어요. 인터넷 연결을 확인해 주세요',
}

export function GroupLobby<M>({ gameId, nickname, capacity, minPlayers, onConnected, onStart, onBack }: Props<M>) {
  const [view, setView] = useState<View>({ kind: 'menu' })
  const [room, setRoom] = useState<Room<M> | null>(null)
  const [members, setMembers] = useState<Member[]>([])
  const [botsWanted, setBotsWanted] = useState(0)
  // 방에 들어가는 도중에 화면을 떠나면, 다 열린 방을 바로 닫는다
  const mountedRef = useRef(true)
  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
    }
  }, [])

  useEffect(() => {
    if (!room) return
    return room.onMembers(setMembers)
  }, [room])

  function connected(r: Room<M>, name: string, pin: string | null) {
    if (!mountedRef.current) {
      r.leave()
      return
    }
    setRoom(r)
    setView({ kind: 'waiting', name, pin })
    onConnected(r)
  }

  function fail(e: unknown, wrongPin = false) {
    if (!(e instanceof RoomError)) console.warn('[room] 방 접속 오류', e)
    const text = e instanceof RoomError ? (e.reason === 'not-found' && wrongPin ? '코드가 틀렸어요 (방이 없어졌을 수도 있어요)' : ERROR_TEXT[e.reason]) : ERROR_TEXT.offline
    setView({ kind: 'error', text })
  }

  async function host(name: string, pin: string | null) {
    setView({ kind: 'busy', text: '방을 만드는 중…' })
    try {
      const id = makeRoomCode()
      connected(await createRoom<M>(gameId, nickname, { capacity, code: channelCode(id, pin), listing: { id, name, locked: !!pin } }), name, pin)
    } catch (e) {
      fail(e)
    }
  }

  async function join(r: ListedRoom, pin: string | null) {
    setView({ kind: 'busy', text: '방에 들어가는 중…' })
    try {
      connected(await joinRoom<M>(gameId, channelCode(r.id, pin), nickname, { capacity }), r.name, pin)
    } catch (e) {
      fail(e, !!pin)
    }
  }

  function leave() {
    room?.leave()
    onBack()
  }

  if (view.kind === 'waiting' && room) {
    const isHost = room.role === 'host'
    const hostGone = !isHost && !members.some((m) => m.role === 'host')
    // 친구가 더 들어와 자리가 모자라면 봇을 그만큼 줄인다
    const bots = Math.min(botsWanted, capacity - members.length - 1)
    const count = members.length + 1 + bots
    return (
      <section className="pvp-lobby">
        <RoomBadge name={view.name} pin={view.pin} />
        <span className="pvp-lobby__wait">
          {count}/{capacity}명
        </span>
        <ul className="group-lobby__members">
          <li className="group-lobby__member group-lobby__member--me">
            {nickname} <span>(나{isHost ? ' · 방장' : ''})</span>
          </li>
          {members.map((m) => (
            <li key={m.id} className="group-lobby__member">
              {m.nickname} {m.role === 'host' && <span>(방장)</span>}
            </li>
          ))}
          {Array.from({ length: bots }, (_, i) => (
            <li key={`bot${i}`} className="group-lobby__member group-lobby__member--bot">
              봇 {i + 1}
            </li>
          ))}
        </ul>
        {isHost ? (
          <>
            <div className="group-lobby__bots" role="group" aria-label="봇 수">
              <span>빈자리에 봇</span>
              <button type="button" className="button button--small" disabled={bots <= 0} onClick={() => setBotsWanted(bots - 1)} aria-label="봇 빼기">
                −
              </button>
              <strong>{bots}</strong>
              <button
                type="button"
                className="button button--small"
                disabled={members.length + 1 + bots >= capacity}
                onClick={() => setBotsWanted(bots + 1)}
                aria-label="봇 더하기"
              >
                +
              </button>
            </div>
            <button type="button" className="button button--primary pvp-lobby__big" disabled={count < minPlayers} onClick={() => {
                room.setPlaying(true)
                onStart(members, bots)
              }}>
              {count < minPlayers ? `${minPlayers}명부터 시작할 수 있어요` : `${count}명으로 시작${bots > 0 ? ` (봇 ${bots})` : ''}`}
            </button>
          </>
        ) : (
          <p className="pvp-lobby__status">{hostGone ? '방장이 나갔어요' : '방장이 시작하길 기다리는 중…'}</p>
        )}
        <button type="button" className="button button--small pvp-lobby__back" onClick={leave}>
          나가기
        </button>
      </section>
    )
  }

  return (
    <section className="pvp-lobby">
      {view.kind === 'busy' ? (
        <p className="pvp-lobby__status">{view.text}</p>
      ) : (
        <RoomPicker gameId={gameId} nickname={nickname} onCreate={(name, pin) => void host(name, pin)} onJoin={(r, pin) => void join(r, pin)} error={view.kind === 'error' ? view.text : undefined} />
      )}
      <button type="button" className="button button--small pvp-lobby__back" onClick={onBack}>
        돌아가기
      </button>
    </section>
  )
}
