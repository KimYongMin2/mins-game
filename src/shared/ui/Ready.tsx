import { useEffect, useState } from 'react'
import type { Member, Peer, Room } from '../online/room'

// 친구 대전 '준비' (사용자 요청, 2026-11-10): 친구는 [준비]를 눌러야 하고, 방장은 준비 없이 모두 준비했을 때만 [게임 시작].
// 다음 판(다시 하기)도 매번 다시 준비. 준비 여부는 방 사람 목록(presence)으로 알린다 — 게임 규칙은 모른다.
// 친구의 준비 버튼은 나타날 때·사라질 때(= 경기가 시작될 때) 준비를 끈다 → 다음 판엔 다시 눌러야 한다.

type ReadyRoom = Pick<Room<never>, 'role' | 'setReady' | 'onPeer' | 'onMembers'>

/** 1:1 게임: 상대(친구)가 준비했는지 */
export function usePeerReady(room: ReadyRoom | null): boolean {
  const [ready, setReady] = useState(false)
  useEffect(() => {
    if (!room) return
    return room.onPeer((p: Peer | null) => setReady(!!p?.ready))
  }, [room])
  return ready
}

/** 여럿 게임: 방에 있는 친구들(나 빼고, 방장 빼고)이 모두 준비했는지와 몇 명인지 */
export function useMembersReady(room: ReadyRoom | null): { all: boolean; ready: number; total: number; members: Member[] } {
  const [members, setMembers] = useState<Member[]>([])
  useEffect(() => {
    if (!room) return
    return room.onMembers(setMembers)
  }, [room])
  const guests = members.filter((m) => m.role === 'guest')
  const ready = guests.filter((m) => m.ready).length
  return { all: ready === guests.length, ready, total: guests.length, members }
}

/** 친구 쪽 [준비] / [준비 취소] 버튼 */
export function ReadyButton({ room, note }: { room: ReadyRoom; note?: string }) {
  const [ready, setReady] = useState(false)
  useEffect(() => {
    room.setReady(false)
    return () => room.setReady(false)
  }, [room])
  const toggle = () => {
    room.setReady(!ready)
    setReady(!ready)
  }
  return (
    <div className="ready">
      <button type="button" className={`button ready__button${ready ? ' ready__button--on' : ' button--primary'}`} onClick={toggle} aria-pressed={ready}>
        {ready ? '준비 완료 · 누르면 취소' : '준비'}
      </button>
      <p className="ready__note">{ready ? '방장이 시작하길 기다려요…' : (note ?? '준비를 누르면 방장이 시작할 수 있어요')}</p>
    </div>
  )
}

/** 방장 쪽 [게임 시작] (모두 준비해야 눌림) */
export function StartButton({ canStart, waitText, label = '게임 시작', onStart }: { canStart: boolean; waitText: string; label?: string; onStart: () => void }) {
  return (
    <div className="ready">
      <button type="button" className="button button--primary ready__button" disabled={!canStart} onClick={onStart}>
        {label}
      </button>
      <p className="ready__note">{canStart ? '모두 준비했어요' : waitText}</p>
    </div>
  )
}

/** 1:1 게임 대기 화면: 나 · 상대 이름과 준비 표시, 친구는 [준비], 방장은 [게임 시작] */
export function DuelReadyRoom({ room, me, peer, peerReady, onStart }: { room: ReadyRoom; me: string; peer: string; peerReady: boolean; onStart: () => void }) {
  const host = room.role === 'host'
  return (
    <div className="ready-room">
      <ul className="ready-room__people">
        <li className="ready-room__person">
          <span className="ready-room__name">{me} (나)</span>
          <span className={`ready-room__tag${host ? ' ready-room__tag--host' : ''}`}>{host ? '방장' : '친구'}</span>
        </li>
        <li className="ready-room__vs" aria-hidden>
          VS
        </li>
        <li className="ready-room__person">
          <span className="ready-room__name">{peer}</span>
          <span className={`ready-room__tag${!host ? ' ready-room__tag--host' : peerReady ? ' ready-room__tag--ready' : ''}`}>{!host ? '방장' : peerReady ? '준비 완료' : '준비 중'}</span>
        </li>
      </ul>
      {host ? <StartButton canStart={peerReady} waitText={`${peer}님이 준비하길 기다려요`} onStart={onStart} /> : <ReadyButton room={room} />}
    </div>
  )
}

/** 다시 하기 전 (결과 화면): 친구는 [준비], 방장은 누가 준비했는지. 방장의 [다시 하기]는 게임이 모두 준비했을 때만 켠다 */
export function RematchReady({ room, waitText, allReady }: { room: ReadyRoom; waitText: string; allReady: boolean }) {
  if (room.role === 'guest') return <ReadyButton room={room} note="준비를 누르면 방장이 다시 시작할 수 있어요" />
  return <p className="ready__note ready__note--host">{allReady ? '모두 준비했어요 · 다시 하기를 누르세요' : waitText}</p>
}
