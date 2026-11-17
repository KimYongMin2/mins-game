import { type ClientMsg, type HubMember, type HubRole, type JoinError, REFEREE_FROM, type ServerMsg } from '../shared/online/hubProtocol'

// 게임 서버의 속: 방·사람 목록·비공개 코드 검사·방 목록·메시지 전달. 통신(WebSocket)은 모른다 — game-server/main.ts가 붙인다.
// 보안 (2026-11-16 조작 막기 2단계):
// - 접속하면 먼저 우리 익명 로그인 토큰을 확인한다 (verify)
// - 접속 번호는 서버가 정하고, 메시지·게임 바꾸기엔 서버가 보낸 사람을 붙인다 → 남인 척 못 함
// - 비공개 방은 방장이 만들 때의 코드와 맞아야 들어온다 (예전엔 채널 이름에 붙이기만 해서 서버가 검사 안 함)
// - 방 목록은 그 방의 방장만 올릴 수 있다 → 가짜 방 못 올림
// - 메시지 크기·초당 개수·방 수를 제한한다 → 메시지 폭탄 막기
// - 익명 계정은 얼마든지 새로 만들 수 있어서 IP 주소별로도 센다 (접속 수·틀린 방 코드, 2026-11-17)
// - 회의방 음성·화상 입장권은 그 방에 들어와 있는 사람에게만 준다 (비공개 코드를 서버가 검사한 뒤라 몰래 듣기 막힘)
// - 회의방은 방장이 나가면 남은 사람 중 먼저 온 사람이 방장 (디스코드처럼 방이 이어짐)

export type Conn = { send(text: string): void; close(code?: number): void }

/** 서버 심판 (게임마다 하나, src/server/referees). 경기 규칙은 각 게임 코드를 그대로 돌린다 */
export type Referee = {
  /** 사람이 보낸 메시지 (from = 서버가 정한 접속 번호). 심판이 쓰는 메시지면 true (다른 사람에게 안 보냄), 아니면 false (예전처럼 전달) */
  input(from: string, msg: unknown): boolean
  tick(now: number): void
  /** 사람이 방에서 빠짐 */
  leave(key: string): void
  /** 끝나서 그만 돌려도 되는지 */
  finished(): boolean
  /** 이 심판만 다른 박자 (점프 배구 물리는 1초에 60번) */
  tickMs?: number
}

export type RefereeContext = {
  now: () => number
  /** 지금 방 사람들 (접속 번호·방장 여부) */
  members: () => { id: string; role: HubRole; nickname: string; avatar?: string }[]
  /** 모두에게 */
  broadcast(msg: unknown): void
  /** 한 사람에게만 (각자 패 같은 비밀) */
  sendTo(key: string, msg: unknown): void
}

export type RefereeFactory = (setup: unknown, ctx: RefereeContext) => Referee | null

export type HubOptions = {
  /** 서버 심판을 둘 수 있는 게임 */
  referees?: Record<string, RefereeFactory>
  /** 심판 박자 (ms) */
  tickMs?: number
  /** 로그인 토큰 확인 → 사용자 ID (아니면 null) */
  verify: (token: string, apikey: string) => Promise<string | null>
  now?: () => number
  /** 끊긴 사람 자리를 이만큼 들고 있는다 (폰을 잠깐 다른 앱에 보냈다 와도 그대로) */
  graceMs?: number
  /** 회의방 음성·화상 입장권 만들기 (LiveKit 방 이름, 참가자 이름, 보이는 이름). 없으면 입장권 안 줌 */
  sfuToken?: (room: string, identity: string, name: string) => Promise<string>
}

const LIMIT = {
  /** 메시지 한 개 최대 글자 수 */
  text: 16_000,
  /** 1초에 보낼 수 있는 메시지 (배구 방장이 상태를 1초에 60번 + 키·핑, 넉넉히) */
  perSecond: 150,
  rooms: 4,
  watches: 20,
  adverts: 4,
  advertText: 1000,
  capacity: 16,
  /** 한 계정(익명 로그인)이 동시에 열 수 있는 접속 (탭 여러 개 정도만) */
  connPerUser: 6,
  /** 틀린 방 코드를 이만큼 넣으면 잠깐 막음 (비공개 코드 숫자 4자리를 다 넣어 보는 것 막기) */
  badJoins: 8,
  badJoinWindowMs: 5 * 60_000,
  /** 한 IP에서 동시에 열 수 있는 접속 (집·학교 와이파이에서 여럿이 같이 해도 넉넉히) */
  connPerIp: 40,
  /** 한 IP에서 틀린 방 코드 (계정을 바꿔 가며 다 넣어 보는 것 막기) */
  badJoinsPerIp: 24,
}

/** 방장이 나가면 남은 사람에게 방장을 넘기는 방 (회의방) */
const HOST_TRANSFER = new Set(['meeting'])
/** 음성·화상 입장권을 주는 방 */
const SFU_GAMES = new Set(['meeting'])

/** 이만큼 메시지가 없으면 '지금 하는 중'으로 안 침 (서버 업데이트를 미룰지 볼 때) */
const ACTIVE_MS = 15 * 60_000
/** 이만큼 아무 일 없는 방은 서버가 닫음 (탭만 켜 두고 자리를 뜬 방이 영영 남지 않게) */
const IDLE_CLOSE_MS = 3 * 60 * 60_000

const ID_RE = /^[A-Z0-9]{4,12}$/
const PIN_RE = /^\d{4}$/
const GAME_RE = /^[a-z0-9-]{2,24}$/
const LIST_RE = /^[a-z0-9-]{2,40}$/
// eslint-disable-next-line no-control-regex -- 보이지 않는 제어 문자 지우기
const clean = (v: unknown, max: number) => (typeof v === 'string' ? [...v.replace(/[\u0000-\u001f\u007f]/g, '')].slice(0, max).join('') : '')

type Member = {
  key: string
  resume: string
  session: Session | null
  role: HubRole
  nickname: string
  avatar?: string
  ready?: boolean
  info?: string
  joinedAt: number
  grace: ReturnType<typeof setTimeout> | null
}

type HubRoom = {
  topic: string
  id: string
  pin: string | null
  capacity: number
  members: Map<string, Member>
  /** 마지막으로 무슨 일이 있었던 시각 (들어옴·메시지·준비 등) */
  lastActive: number
  referee: { game: string; ref: Referee; timer: ReturnType<typeof setInterval> } | null
}

const randomKey = (prefix: string) => `${prefix}-${Array.from(crypto.getRandomValues(new Uint8Array(6)), (b) => b.toString(36).padStart(2, '0')).join('')}`

class Session {
  uid: string | null = null
  /** 접속한 IP (Caddy가 넘겨준 것) */
  ip = ''
  /** 이 접속이 들어가 있는 방 topic → 내 접속 번호 */
  rooms = new Map<string, string>()
  watches = new Set<string>()
  /** 목록 이름 → 올린 방 topic */
  adverts = new Map<string, string>()
  tokens = LIMIT.perSecond
  lastRefill = 0
  conn: Conn
  constructor(conn: Conn) {
    this.conn = conn
  }
  push(msg: ServerMsg) {
    try {
      this.conn.send(JSON.stringify(msg))
    } catch {
      // 닫히는 중
    }
  }
}

export class Hub {
  private rooms = new Map<string, HubRoom>()
  /** 목록 이름 → (방 topic → 올린 정보) */
  private lists = new Map<string, Map<string, Record<string, unknown>>>()
  private watchers = new Map<string, Set<Session>>()
  private opts: HubOptions
  private now: () => number

  /** 계정별: 열린 접속 수, 틀린 방 코드 기록 */
  private conns = new Map<string, number>()
  /** 'u:계정' 또는 'i:IP' → 틀린 방 코드 시각들 */
  private badJoins = new Map<string, number[]>()
  /** IP별 열린 접속 수 */
  private ipConns = new Map<string, number>()

  constructor(opts: HubOptions) {
    this.opts = opts
    this.now = opts.now ?? Date.now
  }

  /** 오래 아무 일 없는 방 닫기 (game-server/main.ts가 10분마다 부름) */
  sweep() {
    const now = this.now()
    for (const room of [...this.rooms.values()]) if (now - room.lastActive > IDLE_CLOSE_MS) this.dropRoom(room)
    for (const [uid, ts] of this.badJoins) if (ts.every((t) => now - t > LIMIT.badJoinWindowMs)) this.badJoins.delete(uid)
  }

  /** 새 접속 (ip = 접속한 곳). 받은 글자는 receive, 끊기면 close. IP 접속이 너무 많으면 바로 끊음 */
  open(conn: Conn, ip = '') {
    const s = new Session(conn)
    s.lastRefill = this.now()
    s.ip = ip
    if (ip) {
      const n = this.ipConns.get(ip) ?? 0
      if (n >= LIMIT.connPerIp) {
        s.push({ t: 'error', reason: 'too-many' })
        conn.close(4002)
        return { receive: () => {}, close: () => {} }
      }
      this.ipConns.set(ip, n + 1)
    }
    return {
      receive: (text: string) => void this.receive(s, text),
      close: () => this.closeSession(s),
    }
  }

  /** 지금 방 수 (테스트·상태 보기) */
  stats() {
    const now = this.now()
    // active = 최근 15분 안에 무슨 일이 있었고 접속한 사람이 있는 방 (서버 업데이트는 이게 0일 때)
    const active = [...this.rooms.values()].filter((r) => now - r.lastActive < ACTIVE_MS && [...r.members.values()].some((m) => m.session)).length
    return { rooms: this.rooms.size, active, lists: this.lists.size }
  }

  private allow(s: Session): boolean {
    const now = this.now()
    s.tokens = Math.min(LIMIT.perSecond, s.tokens + ((now - s.lastRefill) / 1000) * LIMIT.perSecond)
    s.lastRefill = now
    if (s.tokens < 1) return false
    s.tokens -= 1
    return true
  }

  private async receive(s: Session, text: string) {
    if (text.length > LIMIT.text) return s.conn.close(1009)
    if (!this.allow(s)) return // 너무 빨리 보내면 버림
    let m: ClientMsg
    try {
      m = JSON.parse(text) as ClientMsg
    } catch {
      return
    }
    if (!m || typeof m !== 'object') return
    if (m.t === 'ping') return s.push({ t: 'pong' })
    if (m.t === 'hello') {
      if (s.uid) return
      const uid = typeof m.token === 'string' && typeof m.apikey === 'string' ? await this.opts.verify(m.token, m.apikey) : null
      if (!uid) {
        s.push({ t: 'error', reason: 'unauthorized' })
        return s.conn.close(4001)
      }
      const open = this.conns.get(uid) ?? 0
      if (open >= LIMIT.connPerUser) {
        s.push({ t: 'error', reason: 'too-many' })
        return s.conn.close(4002)
      }
      this.conns.set(uid, open + 1)
      s.uid = uid
      return s.push({ t: 'hello-ok', referees: Object.keys(this.opts.referees ?? {}) })
    }
    if (!s.uid) return // 로그인 확인 전엔 아무것도 안 받음
    switch (m.t) {
      case 'join':
        return this.join(s, m)
      case 'leave':
        return this.leave(s, m.room)
      case 'send':
        return this.relay(s, m.room, m.msg)
      case 'referee':
        return this.startReferee(s, m.room, m.game, m.setup)
      case 'ready':
        return this.setMeta(s, m.room, 'guest', (mem) => (mem.ready = m.ready === true))
      case 'info':
        return this.setMeta(s, m.room, 'host', (mem) => (mem.info = clean(m.info, 40) || undefined))
      case 'move':
        return this.move(s, m.room, m.move)
      case 'advertise':
        return this.advertise(s, m.list, m.info)
      case 'watch':
        return this.watch(s, m.list)
      case 'unwatch':
        return this.unwatch(s, m.list)
      case 'sfu':
        return this.sfu(s, m.ref, m.room)
    }
  }

  private join(s: Session, m: Extract<ClientMsg, { t: 'join' }>) {
    const fail = (reason: JoinError) => s.push({ t: 'join-error', ref: m.ref, reason })
    // 틀린 코드를 너무 많이 넣었으면 잠깐은 맞는 코드여도 '방 없음' (다 넣어 보기 막기)
    const now = this.now()
    const recent = (k: string) => (this.badJoins.get(k) ?? []).filter((t) => now - t < LIMIT.badJoinWindowMs)
    const bad = recent(`u:${s.uid}`)
    const badIp = s.ip ? recent(`i:${s.ip}`) : []
    if (m.role === 'guest' && (bad.length >= LIMIT.badJoins || badIp.length >= LIMIT.badJoinsPerIp)) return fail('not-found')
    const failJoin = () => {
      this.badJoins.set(`u:${s.uid}`, [...bad, now])
      if (s.ip) this.badJoins.set(`i:${s.ip}`, [...badIp, now])
      return fail('not-found')
    }
    if (typeof m.game !== 'string' || !GAME_RE.test(m.game) || typeof m.code !== 'string') return fail('not-found')
    const [id, pin = null, ...rest] = m.code.split('-')
    if (!ID_RE.test(id) || rest.length || (pin !== null && !PIN_RE.test(pin))) return fail('not-found')
    if (m.role !== 'host' && m.role !== 'guest') return fail('not-found')
    const topic = `${m.game}:${id}`
    if (s.rooms.has(topic)) this.leave(s, topic)
    if (s.rooms.size >= LIMIT.rooms) return fail('full')
    let room = this.rooms.get(topic)

    // 끊겼다 다시 붙음: 예전 자리를 되찾는다
    if (room && typeof m.resume === 'string') {
      // 되찾기 표(resume)는 그 사람만 아는 무작위 글자라 그것만 맞으면 됨 (회의방에서 방장을 넘겨받았으면 역할이 바뀌어 있음)
      const mem = [...room.members.values()].find((x) => x.resume === m.resume)
      if (mem) {
        if (mem.session && mem.session !== s) mem.session.rooms.delete(topic)
        if (mem.grace) clearTimeout(mem.grace)
        mem.grace = null
        mem.session = s
        s.rooms.set(topic, mem.key)
        s.push({ t: 'joined', ref: m.ref, room: topic, key: mem.key, resume: mem.resume })
        return this.pushMembers(room)
      }
    }

    const hostOf = (r: HubRoom) => [...r.members.values()].find((x) => x.role === 'host')
    if (m.role === 'host') {
      // 방장이 떠난 빈 방이면 새로 (게임 바꾸기는 정해 둔 번호로 다시 만든다)
      if (room && hostOf(room)) return fail('full')
      if (room) this.dropRoom(room)
      const capacity = Number.isInteger(m.capacity) ? Math.min(LIMIT.capacity, Math.max(2, m.capacity)) : 2
      room = { topic, id, pin, capacity, members: new Map(), referee: null, lastActive: this.now() }
      this.rooms.set(topic, room)
    } else {
      // 방장이 있고, 코드가 맞아야 (비공개 코드는 서버가 검사)
      if (!room || !hostOf(room) || room.pin !== pin) return failJoin()
      if (room.members.size >= room.capacity) return fail('full')
    }
    const mem: Member = {
      key: randomKey(m.role),
      resume: randomKey('r'),
      session: s,
      role: m.role,
      nickname: clean(m.nickname, 20).trim() || '익명',
      avatar: clean(m.avatar, 48) || undefined,
      joinedAt: this.now(),
      grace: null,
    }
    room.members.set(mem.key, mem)
    room.lastActive = this.now()
    s.rooms.set(topic, mem.key)
    s.push({ t: 'joined', ref: m.ref, room: topic, key: mem.key, resume: mem.resume })
    this.pushMembers(room)
  }

  private memberOf(s: Session, topic: unknown): { room: HubRoom; mem: Member } | null {
    if (typeof topic !== 'string') return null
    const key = s.rooms.get(topic)
    const room = key ? this.rooms.get(topic) : undefined
    const mem = key ? room?.members.get(key) : undefined
    return room && mem ? { room, mem } : null
  }

  /** 회의방 음성·화상 입장권: 그 방 사람에게만, LiveKit 방 이름은 방 번호(+비공개 코드) — 코드를 몰라 못 들어온 사람은 못 받음 */
  private async sfu(s: Session, ref: unknown, topic: unknown) {
    if (typeof ref !== 'number') return
    const at = this.memberOf(s, topic)
    const game = typeof topic === 'string' ? topic.split(':')[0] : ''
    if (!at || !SFU_GAMES.has(game) || !this.opts.sfuToken) return s.push({ t: 'sfu', ref, token: null })
    const room = `${game}-${at.room.id}${at.room.pin ? `-${at.room.pin}` : ''}`
    // 참가자 이름 = '접속 번호.계정 앞 8자' (같은 이름이 들어오면 LiveKit이 먼저 사람을 내보내서, 남의 번호로는 못 받게)
    const identity = `${at.mem.key}.${(s.uid ?? '').replace(/-/g, '').slice(0, 8)}`
    try {
      s.push({ t: 'sfu', ref, token: await this.opts.sfuToken(room, identity, at.mem.nickname) })
    } catch (e) {
      console.warn('[hub] 입장권 실패', e)
      s.push({ t: 'sfu', ref, token: null })
    }
  }

  private relay(s: Session, topic: string, msg: unknown) {
    const at = this.memberOf(s, topic)
    if (!at) return
    at.room.lastActive = this.now()
    // 서버가 심판이면 입력은 심판에게만 (다른 사람에게 안 감 — 고른 것·비밀이 새지 않게)
    if (at.room.referee?.ref.input(at.mem.key, msg)) return
    for (const other of at.room.members.values()) {
      if (other !== at.mem) other.session?.push({ t: 'msg', room: topic, from: at.mem.key, msg })
    }
  }

  private startReferee(s: Session, topic: string, game: unknown, setup: unknown) {
    const at = this.memberOf(s, topic)
    if (!at || at.mem.role !== 'host' || typeof game !== 'string' || JSON.stringify(setup ?? null).length > 8000) return
    const factory = this.opts.referees?.[game]
    if (!factory || !topic.startsWith(`${game}:`)) return
    const room = at.room
    this.stopReferee(room)
    const ctx: RefereeContext = {
      now: this.now,
      members: () => [...room.members.values()].map((m) => ({ id: m.key, role: m.role, nickname: m.nickname, ...(m.avatar ? { avatar: m.avatar } : {}) })),
      broadcast: (msg) => {
        for (const m of room.members.values()) m.session?.push({ t: 'msg', room: topic, from: REFEREE_FROM, msg })
      },
      sendTo: (key, msg) => room.members.get(key)?.session?.push({ t: 'msg', room: topic, from: REFEREE_FROM, msg }),
    }
    let ref: Referee | null = null
    try {
      ref = factory(setup, ctx)
    } catch (e) {
      console.warn('[hub] 심판 만들기 실패', game, e)
    }
    if (!ref) return
    const timer = setInterval(() => {
      try {
        // 심판이 도는 동안은 하는 중으로 침
        room.lastActive = this.now()
        ref.tick(this.now())
        if (ref.finished()) this.stopReferee(room)
      } catch (e) {
        console.warn('[hub] 심판 오류', game, e)
        this.stopReferee(room)
      }
    }, ref.tickMs ?? this.opts.tickMs ?? 50)
    room.referee = { game, ref, timer }
  }

  private stopReferee(room: HubRoom) {
    if (!room.referee) return
    clearInterval(room.referee.timer)
    room.referee = null
  }

  private setMeta(s: Session, topic: string, role: HubRole, change: (m: Member) => void) {
    const at = this.memberOf(s, topic)
    if (!at || at.mem.role !== role) return
    change(at.mem)
    this.pushMembers(at.room)
  }

  private move(s: Session, topic: string, move: unknown) {
    const at = this.memberOf(s, topic)
    if (!at || at.mem.role !== 'host' || JSON.stringify(move ?? null).length > 500) return
    for (const other of at.room.members.values()) {
      if (other !== at.mem) other.session?.push({ t: 'move', room: topic, from: at.mem.key, move })
    }
  }

  private advertise(s: Session, list: unknown, info: Record<string, unknown> | null) {
    if (typeof list !== 'string' || !LIST_RE.test(list)) return
    const old = s.adverts.get(list)
    if (info === null) {
      if (old) this.removeAdvert(list, old)
      s.adverts.delete(list)
      return
    }
    if (!info || typeof info !== 'object' || JSON.stringify(info).length > LIMIT.advertText) return
    // 그 방의 방장만 목록에 올릴 수 있다 (가짜 방 막기)
    const topic = [...s.rooms.keys()].find((t) => {
      const room = this.rooms.get(t)
      const key = s.rooms.get(t)
      return room && room.id === info.id && key && room.members.get(key)?.role === 'host'
    })
    if (!topic) return
    if (!old && s.adverts.size >= LIMIT.adverts) return
    if (old && old !== topic) this.removeAdvert(list, old)
    s.adverts.set(list, topic)
    let entries = this.lists.get(list)
    if (!entries) this.lists.set(list, (entries = new Map()))
    entries.set(topic, info)
    this.pushList(list)
  }

  private removeAdvert(list: string, topic: string) {
    const entries = this.lists.get(list)
    if (!entries?.delete(topic)) return
    if (entries.size === 0) this.lists.delete(list)
    this.pushList(list)
  }

  private watch(s: Session, list: unknown) {
    if (typeof list !== 'string' || !LIST_RE.test(list) || s.watches.has(list) || s.watches.size >= LIMIT.watches) return
    s.watches.add(list)
    let set = this.watchers.get(list)
    if (!set) this.watchers.set(list, (set = new Set()))
    set.add(s)
    s.push({ t: 'rooms', list, rooms: [...(this.lists.get(list)?.values() ?? [])] })
  }

  private unwatch(s: Session, list: string) {
    s.watches.delete(list)
    const set = this.watchers.get(list)
    set?.delete(s)
    if (set?.size === 0) this.watchers.delete(list)
  }

  private pushList(list: string) {
    const rooms = [...(this.lists.get(list)?.values() ?? [])]
    for (const s of this.watchers.get(list) ?? []) s.push({ t: 'rooms', list, rooms })
  }

  private pushMembers(room: HubRoom) {
    const members: HubMember[] = [...room.members.values()].map((m) => ({
      id: m.key,
      nickname: m.nickname,
      role: m.role,
      joinedAt: m.joinedAt,
      ...(m.avatar ? { avatar: m.avatar } : {}),
      ...(m.ready ? { ready: true } : {}),
      ...(m.info ? { info: m.info } : {}),
    }))
    for (const m of room.members.values()) m.session?.push({ t: 'members', room: room.topic, members })
  }

  /** 사람 하나를 방에서 뺀다. 방장이면 그 방 목록 줄도 내린다 */
  private removeMember(room: HubRoom, mem: Member) {
    if (mem.grace) clearTimeout(mem.grace)
    room.members.delete(mem.key)
    mem.session?.rooms.delete(room.topic)
    room.referee?.ref.leave(mem.key)
    if (mem.role === 'host') {
      for (const [list, entries] of this.lists) if (entries.has(room.topic)) this.removeAdvert(list, room.topic)
      if (mem.session) for (const [list, t] of mem.session.adverts) if (t === room.topic) mem.session.adverts.delete(list)
      // 회의방: 남은 사람 중 먼저 온 사람이 방장 (그 사람 화면이 목록에 다시 올림)
      const next = HOST_TRANSFER.has(room.topic.split(':')[0]) ? [...room.members.values()].sort((a, b) => a.joinedAt - b.joinedAt)[0] : undefined
      if (next) next.role = 'host'
    }
    if (room.members.size === 0) {
      this.stopReferee(room)
      this.rooms.delete(room.topic)
    } else this.pushMembers(room)
  }

  private dropRoom(room: HubRoom) {
    for (const mem of [...room.members.values()]) this.removeMember(room, mem)
    this.rooms.delete(room.topic)
  }

  private leave(s: Session, topic: string) {
    const at = this.memberOf(s, topic)
    if (at) this.removeMember(at.room, at.mem)
  }

  private closeSession(s: Session) {
    if (s.ip) {
      const n = (this.ipConns.get(s.ip) ?? 1) - 1
      if (n <= 0) this.ipConns.delete(s.ip)
      else this.ipConns.set(s.ip, n)
      s.ip = ''
    }
    if (s.uid) {
      const n = (this.conns.get(s.uid) ?? 1) - 1
      if (n <= 0) this.conns.delete(s.uid)
      else this.conns.set(s.uid, n)
    }
    for (const list of [...s.watches]) this.unwatch(s, list)
    // 들어가 있던 방은 잠깐 자리를 들고 있다가 (다시 붙으면 그대로) 안 오면 뺀다
    for (const [topic, key] of s.rooms) {
      const room = this.rooms.get(topic)
      const mem = room?.members.get(key)
      if (!room || !mem) continue
      mem.session = null
      mem.grace = setTimeout(() => {
        if (this.rooms.get(topic) === room && room.members.get(key) === mem && !mem.session) this.removeMember(room, mem)
      }, this.opts.graceMs ?? 20_000)
    }
    s.rooms.clear()
  }
}
