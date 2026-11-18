import type { Member, Room } from './room'

// 지금 들어가 있는 게임 방 (2026-11-18 사용자 요청 — 모든 게임 방에 글자 채팅·음성).
// 게임마다 고치지 않고: 우리 게임 서버로 방을 열면 room.ts가 여기 올리고, 나가면 내림 → 화면 맨 위 공통 창(RoomDock)이 이걸 보고 붙는다.
// 회의방(채팅·통화가 이미 있음)과 낚시터(채팅이 따로 있음)는 뺀다.

const SKIP = new Set(['meeting', 'fishing'])

export type CurrentRoom = {
  gameId: string
  room: Room<unknown>
  /** 지금 방 사람들 (나 빼고) */
  members: Member[]
}

let current: CurrentRoom | null = null
let stopMembers: (() => void) | null = null
const fns = new Set<(r: CurrentRoom | null) => void>()
const emit = () => fns.forEach((fn) => fn(current))

export function registerRoom(gameId: string, room: Room<unknown>, members: Member[], watch: (fn: (m: Member[]) => void) => () => void) {
  if (SKIP.has(gameId)) return
  stopMembers?.()
  current = { gameId, room, members }
  stopMembers = watch((m) => {
    if (current?.room !== room) return
    current = { ...current, members: m }
    emit()
  })
  emit()
}

export function unregisterRoom(room: Room<unknown>) {
  if (current?.room !== room) return
  stopMembers?.()
  stopMembers = null
  current = null
  emit()
}

export function watchCurrentRoom(fn: (r: CurrentRoom | null) => void): () => void {
  fns.add(fn)
  fn(current)
  return () => fns.delete(fn)
}
