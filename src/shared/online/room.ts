import type { RealtimeChannel, SupabaseClient } from '@supabase/supabase-js'
import { getRealtimeClient } from './supabase'

// 친구 대전(PvP)용 방. Supabase Realtime 채널 하나 = 방 하나.
// 방장이 4자리 코드로 방을 만들고, 친구가 그 코드로 들어온다. 둘이 메시지를 주고받는다.
// 게임 규칙은 모른다: 메시지 내용은 각 게임이 정한다.

export type RoomRole = 'host' | 'guest'

export type Peer = { nickname: string }

/** 헷갈리는 글자(0·O·1·I·L)는 뺀다 */
const CODE_CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'
export const CODE_LENGTH = 4

/** 친구가 이만큼 기다려도 방장이 안 보이면 '방이 없음' (모바일 데이터는 느릴 수 있어 넉넉히) */
const JOIN_TIMEOUT_MS = 8000
/** 채널 접속을 이만큼 기다린다. 첫 시도가 실패해도 Realtime이 스스로 다시 시도하므로 바로 포기하지 않는다 */
const SUBSCRIBE_TIMEOUT_MS = 12000

export function makeRoomCode(random: () => number = Math.random): string {
  return Array.from({ length: CODE_LENGTH }, () => CODE_CHARS[Math.floor(random() * CODE_CHARS.length)]).join('')
}

/** 입력한 코드를 정리한다 (소문자·공백 허용). 형식이 틀리면 null */
export function normalizeCode(input: string): string | null {
  const code = input.toUpperCase().replace(/\s/g, '')
  if (code.length !== CODE_LENGTH) return null
  return [...code].every((c) => CODE_CHARS.includes(c)) ? code : null
}

type Meta = { role: RoomRole; nickname: string }

/** presence 상태에서 나 말고 다른 사람들 */
export function othersIn(state: Record<string, Meta[]>, myKey: string): Meta[] {
  return Object.entries(state)
    .filter(([key]) => key !== myKey)
    .flatMap(([, metas]) => metas.slice(0, 1))
}

export type RoomErrorReason = 'not-found' | 'full' | 'offline'

export class RoomError extends Error {
  reason: RoomErrorReason
  constructor(reason: RoomErrorReason) {
    super(reason)
    this.reason = reason
  }
}

export interface Room<M> {
  code: string
  role: RoomRole
  send(msg: M): void
  /** 받은 메시지. 해제 함수를 돌려준다 */
  onMessage(fn: (msg: M) => void): () => void
  /** 상대가 들어오면 Peer, 나가면 null. 등록 직후(바로 다음 틈에) 지금 상태도 한 번 알려준다 */
  onPeer(fn: (peer: Peer | null) => void): () => void
  leave(): void
}

function subscribe(channel: RealtimeChannel, meta: Meta): Promise<void> {
  return new Promise((resolve, reject) => {
    let settled = false
    const timer = setTimeout(() => {
      if (settled) return
      settled = true
      reject(new RoomError('offline'))
    }, SUBSCRIBE_TIMEOUT_MS)
    channel.subscribe(async (status, err) => {
      if (settled) return
      if (status === 'SUBSCRIBED') {
        // 상대에게 내가 들어온 걸 알린다. 한 번 실패하면 한 번 더
        if ((await channel.track(meta)) !== 'ok') await channel.track(meta)
        settled = true
        clearTimeout(timer)
        resolve()
      } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
        // 바로 포기하지 않는다: Realtime이 곧 다시 접속을 시도한다. 원인은 콘솔에 남긴다
        console.warn('[room] 채널 접속 재시도', status, err?.message)
      }
    })
  })
}

/** client: 테스트에서 방장·친구를 서로 다른 연결로 만들 때만 넘긴다 */
async function open<M>(gameId: string, code: string, meta: Meta, client?: SupabaseClient): Promise<Room<M>> {
  const supabase =
    client ??
    (await getRealtimeClient().catch(() => {
      throw new RoomError('offline')
    }))
  const myKey = `${meta.role}-${Math.random().toString(36).slice(2, 10)}`
  const topic = `pvp:${gameId}:${code}`
  // 같은 방에 다시 들어가면 Supabase가 예전 채널을 그대로 돌려줘서 오류가 난다. 남은 게 있으면 먼저 닫는다
  for (const old of supabase.getChannels()) {
    if (old.topic === `realtime:${topic}`) await supabase.removeChannel(old)
  }
  const channel = supabase.channel(topic, {
    config: { broadcast: { self: false }, presence: { key: myKey } },
  })

  const messageFns = new Set<(msg: M) => void>()
  const peerFns = new Set<(peer: Peer | null) => void>()
  let peer: Peer | null = null
  let synced = false
  const syncWaiters: (() => void)[] = []

  channel.on('broadcast', { event: 'msg' }, ({ payload }) => {
    for (const fn of messageFns) fn(payload as M)
  })
  channel.on('presence', { event: 'sync' }, () => {
    const others = othersIn(channel.presenceState<Meta>(), myKey)
    const next = others[0] ? { nickname: others[0].nickname } : null
    synced = true
    syncWaiters.splice(0).forEach((w) => w())
    if ((next === null) !== (peer === null) || next?.nickname !== peer?.nickname) {
      peer = next
      for (const fn of peerFns) fn(peer)
    }
  })

  try {
    await subscribe(channel, meta)
  } catch (e) {
    // 실패한 채널을 닫아서 나중에 혼자 재접속해 상대에게 '들어왔다'로 보이는 일이 없게 한다
    void supabase.removeChannel(channel)
    throw e
  }

  const room: Room<M> = {
    code,
    role: meta.role,
    send(msg) {
      void channel.send({ type: 'broadcast', event: 'msg', payload: msg })
    },
    onMessage(fn) {
      messageFns.add(fn)
      return () => messageFns.delete(fn)
    },
    onPeer(fn) {
      peerFns.add(fn)
      // 등록하는 쪽이 해제 함수를 받기 전에 불리지 않게 한 박자 늦게 알려준다
      queueMicrotask(() => {
        if (peerFns.has(fn)) fn(peer)
      })
      return () => peerFns.delete(fn)
    },
    leave() {
      messageFns.clear()
      peerFns.clear()
      void supabase.removeChannel(channel)
    },
  }

  if (meta.role === 'host') return room

  // 친구: 방장이 있는지, 자리가 남았는지 확인한다
  const waitSync = () => new Promise<void>((r) => (synced ? r() : syncWaiters.push(r)))
  const deadline = Date.now() + JOIN_TIMEOUT_MS
  while (Date.now() < deadline) {
    await Promise.race([waitSync(), new Promise((r) => setTimeout(r, 500))])
    const others = othersIn(channel.presenceState<Meta>(), myKey)
    if (others.some((o) => o.role === 'guest')) {
      room.leave()
      throw new RoomError('full')
    }
    if (others.some((o) => o.role === 'host')) return room
    synced = false
  }
  room.leave()
  throw new RoomError('not-found')
}

/** 새 방을 만든다 (방장) */
export function createRoom<M>(gameId: string, nickname: string, client?: SupabaseClient): Promise<Room<M>> {
  return open<M>(gameId, makeRoomCode(), { role: 'host', nickname }, client)
}

/** 코드로 친구 방에 들어간다 */
export function joinRoom<M>(gameId: string, code: string, nickname: string, client?: SupabaseClient): Promise<Room<M>> {
  return open<M>(gameId, code, { role: 'guest', nickname }, client)
}
