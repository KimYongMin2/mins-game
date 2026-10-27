import { useEffect, useRef, useState } from 'react'
import { CODE_LENGTH, type Member, type Room, RoomError, createRoom, joinRoom, normalizeCode } from '../online/room'

// 여럿이 하는 게임의 대기실: 방 만들기(코드 보여주기) 또는 코드 입력해서 들어가기 → 모인 사람 목록.
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
  | { kind: 'waiting' }
  | { kind: 'error'; text: string }

const ERROR_TEXT: Record<RoomError['reason'], string> = {
  'not-found': '그 코드의 방이 없어요. 코드를 다시 확인해 주세요',
  full: '방이 가득 찼어요',
  offline: '서버에 연결하지 못했어요. 인터넷 연결을 확인해 주세요',
}

export function GroupLobby<M>({ gameId, nickname, capacity, minPlayers, onConnected, onStart, onBack }: Props<M>) {
  const [view, setView] = useState<View>({ kind: 'menu' })
  const [input, setInput] = useState('')
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

  function connected(r: Room<M>) {
    if (!mountedRef.current) {
      r.leave()
      return
    }
    setRoom(r)
    setView({ kind: 'waiting' })
    onConnected(r)
  }

  function fail(e: unknown) {
    if (!(e instanceof RoomError)) console.warn('[room] 방 접속 오류', e)
    setView({ kind: 'error', text: e instanceof RoomError ? ERROR_TEXT[e.reason] : ERROR_TEXT.offline })
  }

  async function host() {
    setView({ kind: 'busy', text: '방을 만드는 중…' })
    try {
      connected(await createRoom<M>(gameId, nickname, { capacity }))
    } catch (e) {
      fail(e)
    }
  }

  async function join() {
    const code = normalizeCode(input)
    if (!code) {
      setView({ kind: 'error', text: `코드 ${CODE_LENGTH}자리를 입력해 주세요` })
      return
    }
    setView({ kind: 'busy', text: '방에 들어가는 중…' })
    try {
      connected(await joinRoom<M>(gameId, code, nickname, { capacity }))
    } catch (e) {
      fail(e)
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
        <div className="pvp-lobby__code-box">
          <span className="pvp-lobby__label">{isHost ? '친구들에게 이 코드를 알려 주세요' : '들어온 방 코드'}</span>
          <strong className="pvp-lobby__code">{room.code}</strong>
          <span className="pvp-lobby__wait">
            {count}/{capacity}명
          </span>
        </div>
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
            <button type="button" className="button button--primary pvp-lobby__big" disabled={count < minPlayers} onClick={() => onStart(members, bots)}>
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
        <>
          <button type="button" className="button button--primary pvp-lobby__big" onClick={host}>
            방 만들기
          </button>
          <form
            className="pvp-lobby__join"
            onSubmit={(e) => {
              e.preventDefault()
              void join()
            }}
          >
            <input
              className="input pvp-lobby__input"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="코드 입력"
              maxLength={CODE_LENGTH + 2}
              autoCapitalize="characters"
              autoComplete="off"
              aria-label="방 코드"
            />
            <button type="submit" className="button">
              들어가기
            </button>
          </form>
          {view.kind === 'error' && (
            <p className="error pvp-lobby__error" role="alert">
              {view.text}
            </p>
          )}
        </>
      )}
      <button type="button" className="button button--small pvp-lobby__back" onClick={onBack}>
        돌아가기
      </button>
    </section>
  )
}
