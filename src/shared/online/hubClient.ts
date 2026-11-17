import type { ClientMsg, HubMember, HubRole, JoinError, ServerMsg } from './hubProtocol'
import { ensurePlayerId, getSupabase, recoverSession } from './supabase'

// 우리 게임 서버(민스서버)와 잇는 연결 하나 (사이트 전체가 나눠 씀). 끊기면 저절로 다시 붙고,
// 다시 붙으면 들어가 있던 방에 예전 자리로 돌아가고(resume) 지켜보던 목록·올린 방도 다시 건다.
// room.ts·roomList.ts가 이걸로 방·목록을 만든다 (주소 VITE_GAME_SERVER_URL이 있을 때만, 없으면 예전 Supabase).

export const GAME_SERVER_URL = import.meta.env.VITE_GAME_SERVER_URL as string | undefined

type RoomHandlers = {
  onMembers: (members: HubMember[]) => void
  onMessage: (from: string, msg: unknown) => void
  onMove: (from: string, move: unknown) => void
}

type JoinedRoom = { game: string; code: string; role: HubRole; nickname: string; avatar?: string; capacity: number; resume: string; key: string; handlers: RoomHandlers }

class HubClient {
  private ws: WebSocket | null = null
  private ready: Promise<void> | null = null
  private refSeq = 0
  private waiting = new Map<number, { resolve: (r: { room: string; key: string; resume: string }) => void; reject: (e: JoinError) => void }>()
  /** 회의방 입장권 기다리는 중 */
  private sfuWaiting = new Map<number, (token: string | null) => void>()
  private rooms = new Map<string, JoinedRoom>()
  private lists = new Map<string, Set<(rooms: Record<string, unknown>[]) => void>>()
  private adverts = new Map<string, Record<string, unknown>>()
  private retry = 0
  /** 서버가 심판을 맡을 수 있는 게임 */
  referees: string[] = []
  private timer: ReturnType<typeof setTimeout> | null = null

  constructor() {
    if (typeof document !== 'undefined') {
      // 화면으로 돌아왔는데 끊겨 있으면 기다리지 않고 바로 다시
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible' && (!this.ws || this.ws.readyState > 1)) this.reconnectNow()
      })
      // 창을 닫거나 다른 주소로 가면 방에서 바로 나간다 (안 그러면 15초 동안 남아 보임)
      window.addEventListener('pagehide', () => {
        for (const room of this.rooms.keys()) this.raw({ t: 'leave', room })
      })
    }
  }

  private raw(m: ClientMsg) {
    if (this.ws?.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify(m))
  }

  /** 연결하고 로그인 확인까지 (이미 됐으면 바로) */
  connect(): Promise<void> {
    if (this.ready) return this.ready
    this.ready = new Promise<void>((resolve, reject) => {
      if (!GAME_SERVER_URL) return reject(new Error('게임 서버 주소 없음'))
      const ws = new WebSocket(GAME_SERVER_URL)
      this.ws = ws
      let opened = false
      ws.onopen = async () => {
        try {
          await ensurePlayerId()
          const { data } = await (await getSupabase()).auth.getSession()
          ws.send(JSON.stringify({ t: 'hello', token: data.session?.access_token ?? '', apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string } satisfies ClientMsg))
        } catch {
          ws.close()
        }
      }
      ws.onmessage = (e) => {
        let m: ServerMsg
        try {
          m = JSON.parse(String(e.data)) as ServerMsg
        } catch {
          return
        }
        if (m.t === 'hello-ok') {
          opened = true
          this.referees = Array.isArray(m.referees) ? m.referees : []
          this.retry = 0
          resolve()
          void this.restore()
          return
        }
        if (m.t === 'error' && m.reason === 'unauthorized') void recoverSession().catch(() => {})
        this.dispatch(m)
      }
      ws.onclose = () => {
        if (this.ws !== ws) return
        this.ws = null
        this.ready = null
        if (!opened) reject(new Error('게임 서버 연결 실패'))
        // 방에 있거나 목록을 보는 중이면 다시 붙는다 (점점 늘어나는 간격, 최대 10초)
        if (this.rooms.size || this.lists.size) this.schedule()
      }
    })
    this.ready.catch(() => {})
    return this.ready
  }

  private schedule() {
    if (this.timer) return
    const ms = Math.min(10_000, 500 * 2 ** this.retry++)
    this.timer = setTimeout(() => {
      this.timer = null
      void this.connect().catch(() => this.schedule())
    }, ms)
  }

  private reconnectNow() {
    if (this.timer) clearTimeout(this.timer)
    this.timer = null
    if (this.rooms.size || this.lists.size) void this.connect().catch(() => this.schedule())
  }

  /** 다시 붙었을 때: 방은 예전 자리로, 목록·올린 방은 다시 */
  private async restore() {
    for (const [topic, r] of [...this.rooms]) {
      try {
        const res = await this.request(r)
        if (res.room !== topic) this.rooms.delete(topic)
        r.key = res.key
        r.resume = res.resume
        this.rooms.set(res.room, r)
      } catch {
        // 자리가 없어짐(오래 끊겨 있었음): 사람 목록을 비워 '나갔어요'가 보이게
        r.handlers.onMembers([])
      }
    }
    for (const list of this.lists.keys()) this.raw({ t: 'watch', list })
    for (const [list, info] of this.adverts) this.raw({ t: 'advertise', list, info })
  }

  private dispatch(m: ServerMsg) {
    switch (m.t) {
      case 'joined':
        return this.waiting.get(m.ref)?.resolve(m)
      case 'join-error':
        return this.waiting.get(m.ref)?.reject(m.reason)
      case 'members':
        return this.rooms.get(m.room)?.handlers.onMembers(m.members)
      case 'msg':
        return this.rooms.get(m.room)?.handlers.onMessage(m.from, m.msg)
      case 'move':
        return this.rooms.get(m.room)?.handlers.onMove(m.from, m.move)
      case 'rooms':
        for (const fn of this.lists.get(m.list) ?? []) fn(m.rooms)
        return
      case 'sfu':
        this.sfuWaiting.get(m.ref)?.(typeof m.token === 'string' ? m.token : null)
        return this.sfuWaiting.delete(m.ref)
    }
  }

  private request(r: Omit<JoinedRoom, 'key' | 'handlers'> & { resume?: string }): Promise<{ room: string; key: string; resume: string }> {
    const ref = ++this.refSeq
    return new Promise((resolve, reject) => {
      const done = () => this.waiting.delete(ref)
      const t = setTimeout(() => {
        done()
        reject('offline')
      }, 10_000)
      this.waiting.set(ref, {
        resolve: (x) => (clearTimeout(t), done(), resolve(x)),
        reject: (e) => (clearTimeout(t), done(), reject(e)),
      })
      this.raw({ t: 'join', ref, game: r.game, code: r.code, role: r.role, nickname: r.nickname, avatar: r.avatar, capacity: r.capacity, ...(r.resume ? { resume: r.resume } : {}) })
    })
  }

  /** 방 들어가기 (방장은 만들기). 실패하면 JoinError를 던진다 */
  async join(opts: { game: string; code: string; role: HubRole; nickname: string; avatar?: string; capacity: number }, handlers: RoomHandlers) {
    try {
      await this.connect()
    } catch {
      throw 'offline' as JoinError
    }
    const res = await this.request({ ...opts, resume: '' })
    const joined: JoinedRoom = { ...opts, resume: res.resume, key: res.key, handlers }
    this.rooms.set(res.room, joined)
    const topic = () => [...this.rooms].find(([, r]) => r === joined)?.[0] ?? res.room
    return {
      key: () => joined.key,
      send: (msg: unknown) => this.raw({ t: 'send', room: topic(), msg }),
      ready: (ready: boolean) => this.raw({ t: 'ready', room: topic(), ready }),
      info: (info: string) => this.raw({ t: 'info', room: topic(), info }),
      move: (move: unknown) => this.raw({ t: 'move', room: topic(), move }),
      referee: (game: string, setup: unknown) => this.raw({ t: 'referee', room: topic(), game, setup }),
      /** 회의방 음성·화상 입장권 (서버가 이 방 사람인지 보고 줌, 못 받으면 null) */
      sfu: () => this.sfu(topic()),
      leave: () => {
        const t = topic()
        this.raw({ t: 'leave', room: t })
        this.rooms.delete(t)
      },
    }
  }

  private async sfu(room: string): Promise<string | null> {
    await this.connect()
    const ref = ++this.refSeq
    return new Promise((resolve) => {
      const t = setTimeout(() => {
        this.sfuWaiting.delete(ref)
        resolve(null)
      }, 4000)
      this.sfuWaiting.set(ref, (token) => (clearTimeout(t), resolve(token)))
      this.raw({ t: 'sfu', ref, room })
    })
  }

  advertise(list: string, info: Record<string, unknown> | null) {
    if (info) this.adverts.set(list, info)
    else this.adverts.delete(list)
    this.raw({ t: 'advertise', list, info })
  }

  watch(list: string, fn: (rooms: Record<string, unknown>[]) => void, onError: () => void): () => void {
    let set = this.lists.get(list)
    if (!set) {
      this.lists.set(list, (set = new Set()))
      void this.connect().then(
        () => this.raw({ t: 'watch', list }),
        () => onError(),
      )
    }
    set.add(fn)
    return () => {
      set.delete(fn)
      if (set.size) return
      this.lists.delete(list)
      this.raw({ t: 'unwatch', list })
    }
  }
}

let client: HubClient | null = null
export const hub = () => (client ??= new HubClient())
