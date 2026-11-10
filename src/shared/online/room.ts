import type { RealtimeChannel, SupabaseClient } from '@supabase/supabase-js'
import { type Advert, advertiseRoom, cleanId, cleanName, isInt } from './roomList'
import { getRealtimeClient } from './supabase'

// 친구 대전(PvP)용 방. Supabase Realtime 채널 하나 = 방 하나.
// 방장이 4자리 코드로 방을 만들고, 친구들이 그 코드로 들어온다. 서로 메시지를 주고받는다.
// 정원은 기본 2명(1:1 게임), 여럿이 하는 게임은 정원을 정해서 만든다.
// 게임 규칙은 모른다: 메시지 내용은 각 게임이 정한다.

export type RoomRole = 'host' | 'guest'

/** avatar = 상대가 고른 캐릭터 글자 (자기 신고라 쓰는 쪽에서 decodeLook으로 검사) */
/** ready = 친구가 [준비]를 눌렀는지 (방장은 준비 없음, 게임 시작만) */
/** info = 방장이 방 안에서 고른 모드 글자 (예: '종목: 연타전') — 친구 화면에 보여 줌 */
export type Peer = { nickname: string; avatar?: string; ready?: boolean; info?: string }

/** 방에 있는 사람 (나 빼고). id는 방 안에서만 쓰는 접속 번호 */
/** avatar = 그 사람이 고른 캐릭터 (자기 신고라 쓰는 쪽에서 검사) */
export type Member = { id: string; nickname: string; role: RoomRole; avatar?: string; ready?: boolean; info?: string }

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

type Meta = { role: RoomRole; nickname: string; /** 들어온 시각 (먼저 온 사람이 자리를 가진다) */ joinedAt: number; avatar?: string; /** 친구가 [준비]를 눌렀는지 */ ready?: boolean; /** 준비를 바꾼 시각 (보낸 사람 시계) */ readyAt?: number; /** 방장이 고른 모드 글자 */ info?: string }

type Other = Meta & { key: string }

/** presence 상태에서 나 말고 다른 사람들, 먼저 들어온 순서 (방장이 맨 앞) */
export function othersIn(state: Record<string, Meta[]>, myKey: string): Other[] {
  return Object.entries(state)
    .filter(([key]) => key !== myKey)
    .flatMap(([key, metas]) => metas.slice(0, 1).map((m) => ({ ...m, key })))
    .sort((a, b) => rank(a) - rank(b) || a.joinedAt - b.joinedAt || (a.key < b.key ? -1 : 1))
}

const rank = (m: Meta) => (m.role === 'host' ? 0 : 1)

/** 나보다 먼저 자리를 잡은 사람들 (동시에 들어오면 접속 번호로 순서를 정한다) */
export function aheadOf(others: Other[], me: Meta, myKey: string): Other[] {
  return others.filter((o) => o.role === 'host' || o.joinedAt < me.joinedAt || (o.joinedAt === me.joinedAt && o.key < myKey))
}

export type RoomErrorReason = 'not-found' | 'full' | 'offline'

export class RoomError extends Error {
  reason: RoomErrorReason
  constructor(reason: RoomErrorReason) {
    super(reason)
    this.reason = reason
  }
}

/** 게임 방 목록에 올라가는 방 정보 (방장이 올리고, 목록 화면이 본다) */
export type ListedRoom = {
  /** 방 번호 (비공개면 채널 이름엔 여기에 코드가 붙는다) */
  id: string
  name: string
  locked: boolean
  /** 지금 사람 수 (나 포함) · 정원 */
  count: number
  capacity: number
  /** 시작했으면 true (목록에서 못 들어감) */
  playing: boolean
  /** 만든 시각 (최근 것 먼저) */
  at: number
}

/** 목록에서 받은 방 정보 하나를 검사한다 (누구나 올릴 수 있어서). 이상하면 null */
export function readListedRoom(x: Record<string, unknown>): ListedRoom | null {
  const id = cleanId(x.id)
  const name = cleanName(x.name)
  if (!id || !name || typeof x.locked !== 'boolean' || typeof x.playing !== 'boolean') return null
  if (!isInt(x.capacity, 2, 16) || !isInt(x.count, 0, 16) || typeof x.at !== 'number' || !Number.isFinite(x.at)) return null
  return { id, name, locked: x.locked, playing: x.playing, capacity: x.capacity, count: Math.min(x.count, x.capacity), at: x.at }
}

/** 게임마다 따로 보이는 방 목록 이름 */
export const gameListId = (gameId: string) => `game-${gameId}`

/** 비공개 방 코드 자리 수 (숫자) */
export const PIN_LENGTH = 4

/** 방 채널 코드: 비공개면 코드를 붙여서, 코드가 틀리면 다른(빈) 채널이 된다 (서버가 검사하는 건 아님) */
export const channelCode = (id: string, pin: string | null) => (pin ? `${id}-${pin}` : id)

/** 방장이 대기실에서 게임을 바꿀 때 친구들에게 보내는 '여기로 옮겨' (같은 이름·코드로 새 게임 방) */
export type RoomMove = { path: string; id: string; name: string; pin: string | null }

export interface Room<M> {
  code: string
  /** 방 목록에 올린 이름 (방장만) */
  name?: string
  role: RoomRole
  /** 내 접속 번호 (Member.id와 같은 종류) */
  myId: string
  send(msg: M): void
  /** 받은 메시지. 해제 함수를 돌려준다 */
  onMessage(fn: (msg: M) => void): () => void
  /** 1:1 게임용: 상대가 들어오면 Peer, 나가면 null. 등록 직후(바로 다음 틈에) 지금 상태도 한 번 알려준다 */
  onPeer(fn: (peer: Peer | null) => void): () => void
  /** 여럿이 하는 게임용: 나 말고 방에 있는 사람들 (들어온 순서). 바뀔 때마다, 등록 직후에도 한 번 */
  onMembers(fn: (members: Member[]) => void): () => void
  /** 방 목록에 '게임 중'으로 표시 (목록에 올린 방만, 방장만) */
  setPlaying(playing: boolean): void
  /** 친구: 준비했는지 사람 목록(presence)으로 알린다 (사용자 요청 — 모두 준비해야 방장이 시작). 다시 붙을 때도 그대로 */
  setReady(ready: boolean): void
  /** 방장: 방 안에서 고른 모드를 사람 목록으로 알린다 (친구 화면에 표시, 바뀌면 친구 준비가 풀림) */
  setInfo(info: string): void
  /** 방장: 다른 게임 방으로 다 같이 옮기자고 알린다 (게임 메시지와 따로) */
  sendMove(move: RoomMove): void
  /** 친구: 방장이 보낸 '여기로 옮겨' (방장이 보낸 것만) */
  onMove(fn: (move: RoomMove) => void): () => void
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
      // 연결이 끊겼다가 다시 붙으면(폰을 잠깐 다른 앱으로 보냈다 오는 등) Realtime이 채널에 다시 들어가는데,
      // '방에 있음'(presence)은 다시 안 보내 줘서 상대 화면엔 계속 나간 걸로 보인다. 그래서 다시 붙을 때마다 다시 보낸다
      if (settled) {
        if (status === 'SUBSCRIBED') void channel.track(meta)
        return
      }
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

export type RoomOptions = {
  /** 정원 (나 포함). 기본 2 */
  capacity?: number
  /** 방장: 코드를 직접 정할 때 (없으면 무작위 4자리) */
  code?: string
  /** 방장: 그 게임 방 목록에 올린다 (이름·공개 여부). 방장이 나가면 목록에서 사라진다 */
  listing?: { id: string; name: string; locked: boolean }
  /** 내가 고른 캐릭터 (친구들에게 사람 목록으로 알림) */
  avatar?: string
  /** 테스트에서 방장·친구를 서로 다른 연결로 만들 때만 넘긴다 */
  client?: SupabaseClient
}

async function open<M>(gameId: string, code: string, meta: Meta, { capacity = 2, client, listing }: RoomOptions): Promise<Room<M>> {
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
  const memberFns = new Set<(members: Member[]) => void>()
  let peer: Peer | null = null
  let members: Member[] = []
  let synced = false
  // 방 목록에 올린 방 정보 (방장만). 사람 수는 presence가 바뀔 때마다 고친다
  let advert: Advert<ListedRoom> | null = null
  let listed: ListedRoom | null = null
  const updateListing = () => {
    if (!advert || !listed) return
    const count = Math.min(capacity, members.length + 1)
    if (count === listed.count) return
    listed = { ...listed, count }
    advert.update(listed)
  }
  const syncWaiters: (() => void)[] = []

  channel.on('broadcast', { event: 'msg' }, ({ payload }) => {
    for (const fn of messageFns) fn(payload as M)
  })
  // 준비 신호: presence는 반영까지 1~2초 걸려서, 준비를 바꾸면 방 메시지('ready' 이벤트, 게임 메시지와 따로)로도 바로 보낸다.
  // 사람마다 둘 중 최신(보낸 사람 시계로 바꾼 시각이 늦은 것)을 쓴다
  let lastOthers: Other[] = []
  const readySignals = new Map<string, { ready: boolean; at: number }>()
  const readyOf = (o: Other) => {
    const sig = readySignals.get(o.key)
    return sig && sig.at >= (o.readyAt ?? 0) ? sig.ready : o.ready === true
  }
  channel.on('broadcast', { event: 'ready' }, ({ payload }) => {
    const p = payload as { from?: unknown; ready?: unknown; at?: unknown }
    if (typeof p.from !== 'string' || typeof p.ready !== 'boolean' || typeof p.at !== 'number' || !Number.isFinite(p.at)) return
    readySignals.set(p.from, { ready: p.ready, at: p.at })
    publish()
  })
  // 게임 바꾸기: 방장(사람 목록의 방장 줄)이 보낸 것만 받는다
  const moveFns = new Set<(move: RoomMove) => void>()
  channel.on('broadcast', { event: 'move' }, ({ payload }) => {
    const p = payload as { from?: unknown; path?: unknown; id?: unknown; name?: unknown; pin?: unknown }
    if (typeof p.from !== 'string' || !lastOthers.some((o) => o.key === p.from && o.role === 'host')) return
    if (typeof p.path !== 'string' || !/^\/games\/[a-z]+$/.test(p.path) || typeof p.id !== 'string' || !/^[A-Z0-9]{4,12}$/.test(p.id)) return
    const name = typeof p.name === 'string' ? p.name.replace(/[\u0000-\u001f]/g, '').slice(0, 20) : ''
    const pin = typeof p.pin === 'string' && /^\d{4}$/.test(p.pin) ? p.pin : null
    for (const fn of moveFns) fn({ path: p.path, id: p.id, name, pin })
  })
  channel.on('presence', { event: 'sync' }, () => {
    lastOthers = othersIn(channel.presenceState<Meta>(), myKey)
    synced = true
    syncWaiters.splice(0).forEach((w) => w())
    publish()
    updateListing()
  })
  const infoOf = (o: Other) => (o.role === 'host' && typeof o.info === 'string' && o.info ? { info: o.info.replace(/[\u0000-\u001f]/g, '').slice(0, 40) } : {})
  function publish() {
    const others = lastOthers
    const next = others[0]
      ? { nickname: others[0].nickname, ...(typeof others[0].avatar === 'string' ? { avatar: others[0].avatar.slice(0, 48) } : {}), ...(readyOf(others[0]) ? { ready: true } : {}), ...infoOf(others[0]) }
      : null
    if ((next === null) !== (peer === null) || next?.nickname !== peer?.nickname || next?.avatar !== peer?.avatar || next?.ready !== peer?.ready || next?.info !== peer?.info) {
      peer = next
      for (const fn of peerFns) fn(peer)
    }
    const nextMembers = others.map((o) => ({
      id: o.key,
      nickname: o.nickname,
      role: o.role,
      ...(typeof o.avatar === 'string' ? { avatar: o.avatar.slice(0, 48) } : {}),
      ...(readyOf(o) ? { ready: true } : {}),
      ...infoOf(o),
    }))
    if (JSON.stringify(nextMembers) !== JSON.stringify(members)) {
      members = nextMembers
      for (const fn of memberFns) fn(members)
    }
  }

  try {
    await subscribe(channel, meta)
  } catch (e) {
    // 실패한 채널을 닫아서 나중에 혼자 재접속해 상대에게 '들어왔다'로 보이는 일이 없게 한다
    void supabase.removeChannel(channel)
    throw e
  }

  // 화면으로 돌아왔는데 서버 연결이 끊겨 있으면 기다리지 않고 바로 다시 잇는다 (원래는 점점 늘어나는 간격으로 다시 시도)
  const wake = () => {
    if (document.visibilityState === 'visible' && !supabase.realtime.isConnected()) supabase.realtime.connect()
  }
  if (typeof document !== 'undefined') document.addEventListener('visibilitychange', wake)

  if (meta.role === 'host' && listing) {
    listed = { ...listing, count: Math.min(capacity, members.length + 1), capacity, playing: false, at: meta.joinedAt }
    advert = advertiseRoom(gameListId(gameId), listed)
  }

  const room: Room<M> = {
    code,
    ...(listing ? { name: listing.name } : {}),
    role: meta.role,
    myId: myKey,
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
    onMembers(fn) {
      memberFns.add(fn)
      queueMicrotask(() => {
        if (memberFns.has(fn)) fn(members)
      })
      return () => memberFns.delete(fn)
    },
    setReady(ready) {
      if (meta.role !== 'guest' || !!meta.ready === ready) return
      // meta는 다시 붙을 때 다시 보내는 것과 같은 객체라 고쳐 두면 그대로 간다
      meta.ready = ready
      meta.readyAt = Date.now()
      void channel.track(meta)
      void channel.send({ type: 'broadcast', event: 'ready', payload: { from: myKey, ready, at: meta.readyAt } })
    },
    sendMove(move) {
      if (meta.role !== 'host') return
      void channel.send({ type: 'broadcast', event: 'move', payload: { from: myKey, ...move } })
    },
    onMove(fn) {
      moveFns.add(fn)
      return () => moveFns.delete(fn)
    },
    setInfo(info) {
      if (meta.role !== 'host' || meta.info === info) return
      meta.info = info
      void channel.track(meta)
    },
    setPlaying(playing) {
      if (!advert || !listed || listed.playing === playing) return
      listed = { ...listed, playing }
      advert.update(listed)
    },
    leave() {
      advert?.stop()
      advert = null
      if (typeof document !== 'undefined') document.removeEventListener('visibilitychange', wake)
      messageFns.clear()
      peerFns.clear()
      memberFns.clear()
      moveFns.clear()
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
    if (others.some((o) => o.role === 'host')) {
      // 나보다 먼저 온 사람만으로 정원이 차 있으면 못 들어간다
      if (aheadOf(others, meta, myKey).length >= capacity) {
        room.leave()
        throw new RoomError('full')
      }
      return room
    }
    synced = false
  }
  room.leave()
  throw new RoomError('not-found')
}

/** 새 방을 만든다 (방장) */
export function createRoom<M>(gameId: string, nickname: string, opts: RoomOptions = {}): Promise<Room<M>> {
  return open<M>(gameId, opts.code ?? makeRoomCode(), { role: 'host', nickname, joinedAt: Date.now(), ...(opts.avatar ? { avatar: opts.avatar } : {}) }, opts)
}

/** 코드로 친구 방에 들어간다. 정원은 방장과 같게 넘긴다 */
export function joinRoom<M>(gameId: string, code: string, nickname: string, opts: RoomOptions = {}): Promise<Room<M>> {
  return open<M>(gameId, code, { role: 'guest', nickname, joinedAt: Date.now(), ...(opts.avatar ? { avatar: opts.avatar } : {}) }, opts)
}
