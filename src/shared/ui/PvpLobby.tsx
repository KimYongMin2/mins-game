import { useEffect, useRef, useState } from 'react'
import { type ListedRoom, type Peer, type Room, RoomError, channelCode, createRoom, joinRoom, makeRoomCode } from '../online/room'
import { RoomBadge, RoomPicker } from './RoomPicker'

// 친구 대전 대기실(1:1): 열린 방 목록에서 고르거나 방 만들기(이름 · 전체 공개 / 비공개 코드).
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
  | { kind: 'hosting'; name: string; pin: string | null }
  | { kind: 'error'; text: string }

const ERROR_TEXT: Record<RoomError['reason'], string> = {
  'not-found': '방이 없어졌어요',
  full: '방이 가득 찼어요',
  offline: '서버에 연결하지 못했어요. 인터넷 연결을 확인해 주세요',
}

export function PvpLobby<M>({ gameId, nickname, onConnected, onBack }: Props<M>) {
  const [view, setView] = useState<View>({ kind: 'menu' })
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

  function fail(e: unknown, wrongPin = false) {
    if (!(e instanceof RoomError)) console.warn('[room] 방 접속 오류', e)
    // 반쯤 열린 방이 남아 있으면 닫는다 (다시 시도할 때 부딪히지 않게)
    roomRef.current?.leave()
    roomRef.current = null
    const text = e instanceof RoomError ? (e.reason === 'not-found' && wrongPin ? '코드가 틀렸어요 (방이 없어졌을 수도 있어요)' : ERROR_TEXT[e.reason]) : ERROR_TEXT.offline
    setView({ kind: 'error', text })
  }

  async function host(name: string, pin: string | null) {
    setView({ kind: 'busy', text: '방을 만드는 중…' })
    try {
      const id = makeRoomCode()
      const room = await createRoom<M>(gameId, nickname, { code: channelCode(id, pin), listing: { id, name, locked: !!pin } })
      roomRef.current = room
      setView({ kind: 'hosting', name, pin })
      handOff(room)
    } catch (e) {
      fail(e)
    }
  }

  async function join(r: ListedRoom, pin: string | null) {
    setView({ kind: 'busy', text: '방에 들어가는 중…' })
    try {
      const room = await joinRoom<M>(gameId, channelCode(r.id, pin), nickname)
      roomRef.current = room
      setView({ kind: 'busy', text: '방장과 연결하는 중…' })
      handOff(room)
    } catch (e) {
      fail(e, !!pin)
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
        <>
          <RoomBadge name={view.name} pin={view.pin} />
          <span className="pvp-lobby__wait">친구를 기다리는 중…</span>
          <button type="button" className="button" onClick={cancel}>
            취소
          </button>
        </>
      ) : view.kind === 'busy' ? (
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
