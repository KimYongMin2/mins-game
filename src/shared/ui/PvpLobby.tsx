import { useEffect, useRef, useState } from 'react'
import { CODE_LENGTH, type Peer, type Room, RoomError, createRoom, joinRoom, normalizeCode } from '../online/room'

// 친구 대전 대기실: 방 만들기(코드 보여주기) 또는 코드 입력해서 들어가기.
// 둘이 모이면 onConnected로 방을 넘긴다. 게임 규칙은 모른다.

type Props<M> = {
  gameId: string
  nickname: string
  onConnected: (room: Room<M>, peer: Peer) => void
  onBack: () => void
}

type View =
  | { kind: 'menu' }
  | { kind: 'busy'; text: string }
  | { kind: 'hosting'; code: string }
  | { kind: 'error'; text: string }

const ERROR_TEXT: Record<RoomError['reason'], string> = {
  'not-found': '그 코드의 방이 없어요. 코드를 다시 확인해 주세요',
  full: '이미 두 명이 들어간 방이에요',
  offline: '서버에 연결하지 못했어요. 인터넷 연결을 확인해 주세요',
}

export function PvpLobby<M>({ gameId, nickname, onConnected, onBack }: Props<M>) {
  const [view, setView] = useState<View>({ kind: 'menu' })
  const [input, setInput] = useState('')
  const roomRef = useRef<Room<M> | null>(null)
  const handedOff = useRef(false)
  const connectedRef = useRef(onConnected)
  useEffect(() => {
    connectedRef.current = onConnected
  })

  // 대기실을 그냥 나가면 만든 방을 닫는다 (넘겨준 방은 게임이 관리)
  useEffect(
    () => () => {
      if (!handedOff.current) roomRef.current?.leave()
    },
    [],
  )

  function handOff(room: Room<M>) {
    // 상대가 이미 있으면 등록하자마자 불릴 수 있어서, 해제 함수는 등록이 끝난 뒤에만 쓴다
    let off: (() => void) | null = null
    off = room.onPeer((peer) => {
      if (!peer || handedOff.current) return
      handedOff.current = true
      off?.()
      connectedRef.current(room, peer)
    })
  }

  function fail(e: unknown) {
    if (!(e instanceof RoomError)) console.warn('[room] 방 접속 오류', e)
    // 반쯤 열린 방이 남아 있으면 닫는다 (다시 시도할 때 부딪히지 않게)
    roomRef.current?.leave()
    roomRef.current = null
    setView({ kind: 'error', text: e instanceof RoomError ? ERROR_TEXT[e.reason] : ERROR_TEXT.offline })
  }

  async function host() {
    setView({ kind: 'busy', text: '방을 만드는 중…' })
    try {
      const room = await createRoom<M>(gameId, nickname)
      roomRef.current = room
      setView({ kind: 'hosting', code: room.code })
      handOff(room)
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
      const room = await joinRoom<M>(gameId, code, nickname)
      roomRef.current = room
      setView({ kind: 'busy', text: '방장과 연결하는 중…' })
      handOff(room)
    } catch (e) {
      fail(e)
    }
  }

  function cancel() {
    roomRef.current?.leave()
    roomRef.current = null
    setView({ kind: 'menu' })
  }

  return (
    <section className="pvp-lobby">
      {view.kind === 'hosting' ? (
        <div className="pvp-lobby__code-box">
          <span className="pvp-lobby__label">친구에게 이 코드를 알려 주세요</span>
          <strong className="pvp-lobby__code">{view.code}</strong>
          <span className="pvp-lobby__wait">친구를 기다리는 중…</span>
          <button type="button" className="button" onClick={cancel}>
            취소
          </button>
        </div>
      ) : view.kind === 'busy' ? (
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
