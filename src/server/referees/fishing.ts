import type { Referee, RefereeContext, RefereeFactory } from '../hub'
import { type Catch, fishById, isBig, rollCatch } from '../../games/fishing/play/fish'
import { BEDS, BOUNDS, WALK_SPEED, castTarget, nearBed, walkable } from '../../games/fishing/play/map'
import {
  BITE_MAX_MS,
  BITE_MIN_MS,
  BITE_WINDOW_MS,
  type BagItem,
  BONK_MS,
  BONK_REACH,
  CHAT_MAX,
  type ClientMsg,
  type PlayerPub,
  type Profile,
  type ServerMsg,
  TANK_MAX,
} from '../../games/fishing/play/protocol'
import { loadProfile, markDirty, savingOn, startFlushing } from '../fishingStore'

// 낚시터 심판 (사용자 요청 2026-11-17): 방 하나에 최대 16명이 언제든 들어와 걸어 다니며 낚시.
// 위치는 화면이 보내고 여기서 빠르기·물 검사, 입질 시각·잡힌 물고기·크기·이로치는 여기서만 정함 → 도감·어항에 가짜가 못 들어감.
// 도감·어항은 계정(uid)별로 Supabase에 (fishingStore). 방장이 없어도 계속 돎(회의방처럼 방장을 넘겨받음).

type P = PlayerPub & { uid: string | null; castAt: number; biteAt: number; biteUntil: number; zone: 'sea' | 'fresh' | null; lastMv: number; lastChat: number; lastBonk: number }

/** 가방: 최근 것 + 자랑할 만한 것, 모두 이만큼까지 */
const BAG_RECENT = 40
const BAG_MAX = 150
/** 위치는 모아서 0.1초마다 */
const POS_MS = 100

const rand = () => crypto.getRandomValues(new Uint32Array(1))[0] / 2 ** 32
const num = (v: unknown, lo: number, hi: number) => typeof v === 'number' && Number.isFinite(v) && v >= lo && v <= hi
// eslint-disable-next-line no-control-regex -- 보이지 않는 제어 문자 지우기
const cleanText = (v: unknown) => (typeof v === 'string' ? [...v.replace(/[\u0000-\u001f\u007f]/g, ' ').trim()].slice(0, CHAT_MAX).join('') : '')
const r2 = (v: number) => Math.round(v * 100) / 100

const pub = (p: P): PlayerPub => ({ id: p.id, name: p.name, ...(p.avatar ? { avatar: p.avatar } : {}), x: p.x, z: p.z, r: p.r, bed: p.bed, fishing: p.fishing, bob: p.bob })

/** 가방에 넣기: 자랑할 만한 것은 남기고 흔한 것부터 버림 */
export function addToBag(bag: BagItem[], item: BagItem): BagItem[] {
  const next = [...bag, item]
  if (next.length <= BAG_MAX) return next
  const recent = new Set(next.slice(-BAG_RECENT).map((x) => x.k))
  const idx = next.findIndex((x) => !recent.has(x.k) && !isBig({ fish: x.f, iro: x.i, size: x.s }))
  next.splice(idx >= 0 ? idx : 0, 1)
  return next
}

/** 도감에 넣기. 최고 기록이면 true */
export function addToDex(p: Profile, c: Catch): boolean {
  const def = fishById(c.fish)
  if (!def || def.rarity === 'junk') return false
  const e = p.dex[c.fish] ?? { n: 0, best: 0, iros: [] }
  const best = c.size > e.best
  p.dex[c.fish] = { n: e.n + 1, best: Math.max(e.best, c.size), iros: c.iro && !e.iros.includes(c.iro) ? [...e.iros, c.iro] : e.iros }
  return best
}

export function fishingReferee(_setup: unknown, ctx: RefereeContext): Referee {
  startFlushing()
  const players = new Map<string, P>()
  const posDirty = new Set<string>()
  let lastPos = 0
  const send = (to: string, m: ServerMsg) => ctx.sendTo(to, m)
  const all = (m: ServerMsg) => ctx.broadcast(m)
  const nameOf = (key: string) => ctx.members().find((m) => m.id === key)?.nickname ?? '익명'

  function join(key: string) {
    const mem = ctx.members().find((m) => m.id === key)
    if (!mem) return
    let p = players.get(key)
    if (!p) {
      // 빈자리 근처에서 시작 (겹치지 않게 조금씩 흩뿌림)
      const a = rand() * Math.PI * 2
      p = { id: key, name: mem.nickname, ...(mem.avatar ? { avatar: mem.avatar } : {}), x: r2(Math.cos(a) * 2.5), z: r2(5 + Math.sin(a) * 1.5), r: Math.PI, bed: null, fishing: 'none', bob: null, uid: mem.uid ?? null, castAt: 0, biteAt: 0, biteUntil: 0, zone: null, lastMv: ctx.now(), lastChat: 0, lastBonk: 0 }
      players.set(key, p)
      all({ t: 'st', p: pub(p) })
    }
    send(key, { t: 'init', you: key, players: [...players.values()].map(pub), saving: savingOn() })
    if (p.uid) void loadProfile(p.uid).then((profile) => players.has(key) && send(key, { t: 'profile', profile }))
  }

  function stopFishing(p: P) {
    if (p.fishing === 'none') return false
    p.fishing = 'none'
    p.bob = null
    p.zone = null
    return true
  }

  function move(p: P, m: Extract<ClientMsg, { t: 'mv' }>) {
    if (!num(m.x, BOUNDS.minX - 1, BOUNDS.maxX + 1) || !num(m.z, BOUNDS.minZ - 1, BOUNDS.maxZ + 1) || !num(m.r, -100, 100)) return
    const now = ctx.now()
    const dt = Math.min(2, (now - p.lastMv) / 1000)
    p.lastMv = now
    let { x, z } = m
    // 너무 빠르면 갈 수 있는 만큼만, 물·맵 밖이면 그대로
    const far = Math.hypot(x - p.x, z - p.z)
    const allow = WALK_SPEED * dt * 1.6 + 0.6
    if (far > allow) {
      x = p.x + ((x - p.x) / far) * allow
      z = p.z + ((z - p.z) / far) * allow
    }
    if (!walkable(x, z)) return send(p.id, { t: 'st', p: pub(p) })
    const moved = Math.hypot(x - p.x, z - p.z) > 0.05
    p.x = r2(x)
    p.z = r2(z)
    p.r = r2(m.r)
    // 움직이면 일어나고 낚싯대를 거둠
    if (moved && (p.bed !== null || p.fishing !== 'none')) {
      p.bed = null
      stopFishing(p)
      all({ t: 'st', p: pub(p) })
    }
    posDirty.add(p.id)
  }

  function cast(p: P) {
    if (p.fishing !== 'none') return
    const bed = p.bed !== null ? BEDS[p.bed] : null
    const t = bed ? castTarget(bed.x, bed.z, bed.r) : castTarget(p.x, p.z, p.r)
    if (!t) return send(p.id, { t: 'st', p: pub(p) })
    const now = ctx.now()
    p.fishing = 'cast'
    p.bob = t.bob
    p.zone = t.zone
    if (!bed) p.r = r2(t.r)
    p.castAt = now
    p.biteAt = now + BITE_MIN_MS + rand() * (BITE_MAX_MS - BITE_MIN_MS)
    all({ t: 'st', p: pub(p) })
  }

  function reel(p: P) {
    if (p.fishing === 'cast') {
      stopFishing(p)
      return all({ t: 'st', p: pub(p) })
    }
    if (p.fishing !== 'bite' || !p.zone) return
    const c = rollCatch(rand, p.zone)
    stopFishing(p)
    const item: BagItem = { k: crypto.randomUUID().slice(0, 12), f: c.fish, i: c.iro, s: c.size, at: Date.now() }
    let best = false
    if (p.uid) {
      const uid = p.uid
      void loadProfile(uid).then((profile) => {
        best = addToDex(profile, c)
        profile.bag = addToBag(profile.bag, item)
        markDirty(uid, p.name)
        all({ t: 'catch', id: p.id, name: p.name, c, big: isBig(c), best })
        if (players.has(p.id)) send(p.id, { t: 'profile', profile })
        all({ t: 'st', p: pub(p) })
      })
    } else {
      all({ t: 'catch', id: p.id, name: p.name, c, big: isBig(c), best })
      all({ t: 'st', p: pub(p) })
    }
  }

  function lie(p: P, i: unknown) {
    if (typeof i !== 'number' || !Number.isInteger(i) || !BEDS[i]) return
    if (nearBed(p.x, p.z) !== i || [...players.values()].some((o) => o !== p && o.bed === i)) return send(p.id, { t: 'st', p: pub(p) })
    stopFishing(p)
    p.bed = i
    p.x = BEDS[i].x
    p.z = BEDS[i].z
    p.r = r2(BEDS[i].r)
    all({ t: 'st', p: pub(p) })
  }

  function chat(p: P, text: unknown) {
    const t = cleanText(text)
    const now = ctx.now()
    if (!t || now - p.lastChat < 600) return
    p.lastChat = now
    all({ t: 'chat', id: p.id, name: p.name, text: t })
  }

  /** 뿅망치: 바라보는 쪽 가까운 사람 하나 (누워 있는 사람도 맞음). 맞아도 낚시·눕기는 그대로 */
  function bonk(p: P) {
    const now = ctx.now()
    if (now - p.lastBonk < BONK_MS) return
    p.lastBonk = now
    const fx = Math.sin(p.r), fz = Math.cos(p.r)
    let best: P | null = null
    let bestD = BONK_REACH
    for (const o of players.values()) {
      if (o === p) continue
      const dx = o.x - p.x, dz = o.z - p.z
      const d = Math.hypot(dx, dz)
      if (d < bestD && (d < 0.4 || (dx * fx + dz * fz) / d > 0.35)) {
        best = o
        bestD = d
      }
    }
    all({ t: 'bonk', id: p.id, to: best?.id ?? null })
  }

  async function setTank(p: P, keys: unknown) {
    if (!p.uid || !Array.isArray(keys)) return
    const uid = p.uid
    const profile = await loadProfile(uid)
    const have = new Set(profile.bag.map((x) => x.k))
    profile.tank = [...new Set(keys.filter((k): k is string => typeof k === 'string' && have.has(k)))].slice(0, TANK_MAX)
    markDirty(uid, p.name)
    send(p.id, { t: 'profile', profile })
  }

  async function look(p: P, who: unknown) {
    const target = typeof who === 'string' ? players.get(who) : undefined
    if (!target?.uid) return send(p.id, { t: 'tank', who: typeof who === 'string' ? who : '', name: target?.name ?? '', items: [] })
    const profile = await loadProfile(target.uid)
    const byKey = new Map(profile.bag.map((x) => [x.k, x]))
    send(p.id, { t: 'tank', who: target.id, name: target.name, items: profile.tank.map((k) => byKey.get(k)).filter((x): x is BagItem => !!x) })
  }

  async function brag(p: P, key: unknown) {
    if (!p.uid || typeof key !== 'string') return
    const now = ctx.now()
    if (now - p.lastChat < 1500) return
    p.lastChat = now
    const profile = await loadProfile(p.uid)
    const item = profile.bag.find((x) => x.k === key)
    if (item) all({ t: 'brag', id: p.id, name: p.name, item })
  }

  return {
    tickMs: 100,
    input(from, raw) {
      const m = raw as ClientMsg
      if (!m || typeof m !== 'object') return true
      if (m.t === 'hi') {
        join(from)
        return true
      }
      const p = players.get(from)
      if (!p) return true
      if (p.name !== nameOf(from)) p.name = nameOf(from)
      switch (m.t) {
        case 'mv':
          move(p, m)
          break
        case 'cast':
          cast(p)
          break
        case 'reel':
          reel(p)
          break
        case 'bed':
          lie(p, m.i)
          break
        case 'chat':
          chat(p, m.text)
          break
        case 'tank':
          void setTank(p, m.keys)
          break
        case 'look':
          void look(p, m.who)
          break
        case 'brag':
          void brag(p, m.key)
          break
        case 'bonk':
          bonk(p)
          break
      }
      return true
    },
    tick(now) {
      for (const p of players.values()) {
        if (p.fishing === 'cast' && now >= p.biteAt) {
          p.fishing = 'bite'
          p.biteUntil = now + BITE_WINDOW_MS
          all({ t: 'bite', id: p.id })
          all({ t: 'st', p: pub(p) })
        } else if (p.fishing === 'bite' && now > p.biteUntil) {
          stopFishing(p)
          all({ t: 'escape', id: p.id })
          all({ t: 'st', p: pub(p) })
        }
      }
      if (posDirty.size && now - lastPos >= POS_MS) {
        lastPos = now
        all({ t: 'pos', l: [...posDirty].flatMap((id) => {
          const p = players.get(id)
          return p ? [[p.id, p.x, p.z, p.r] as [string, number, number, number]] : []
        }) })
        posDirty.clear()
      }
    },
    leave(key) {
      if (players.delete(key)) all({ t: 'gone', id: key })
    },
    finished: () => false,
  }
}

export const fishingRefereeFactory: RefereeFactory = (setup, ctx) => fishingReferee(setup, ctx)
