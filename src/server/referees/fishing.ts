import type { Referee, RefereeContext, RefereeFactory } from '../hub'
import { type Catch, fishById, isBig, rollBugCatch, rollCatch } from '../../games/fishing/play/fish'
import { isBugId, isNightHour } from '../../games/fishing/play/bugs'
import { gameHour } from '../../games/fishing/game/clock'
import { BEDS, BOAT_SLOTS, BOARD_REACH, CRATES, CRATE_HP, CRATE_RESPAWN_MS, boatSpeed, MAP_VIEW, BUILD_MS, CASTLES, LADDERS, SEATS, nearCastle, nearSeat, RUN_SPEED, SPAWN, boatable, bugSpot, castTarget, CLOVER_COUNT, CLOVER_REACH, KITE_MAX, LUCK_MS, fireOfSeat, kiteOk, onGrass, landingSpot, nearBed, nearLadder, onLadderTop, walkable } from '../../games/fishing/play/map'
import {
  BITE_MAX_MS,
  BITE_MIN_MS,
  BITE_WINDOW_MS,
  BUG_MAX_MS,
  BUG_MIN_MS,
  type BagItem,
  type BoatPub,
  type CastlePub,
  type CratePub,
  BONK_MS,
  BONK_REACH,
  CHAT_MAX,
  JUMP_MS,
  type ClientMsg,
  type PlayerPub,
  ROAST_GOLD_MS,
  ROAST_MAX_MS,
  ROAST_MIN_MS,
  type RoastGrade,
  type Profile,
  type ServerMsg,
  TANK_MAX,
} from '../../games/fishing/play/protocol'
import { loadProfile, markDirty, savingOn, startFlushing } from '../fishingStore'

// 낚시터 심판 (사용자 요청 2026-11-17): 방 하나에 최대 16명이 언제든 들어와 걸어 다니며 낚시.
// 위치는 화면이 보내고 여기서 빠르기·물 검사, 입질 시각·잡힌 물고기·크기·이로치는 여기서만 정함 → 도감·어항에 가짜가 못 들어감.
// 도감·어항은 계정(uid)별로 Supabase에 (fishingStore). 방장이 없어도 계속 돎(회의방처럼 방장을 넘겨받음).

type P = PlayerPub & { uid: string | null; castAt: number; biteAt: number; biteUntil: number; zone: 'sea' | 'fresh' | 'forest' | 'meadow' | null; lastMv: number; lastChat: number; lastBonk: number; lastJump: number; castX: number; castZ: number; roastAt: number; roastFood: 0 | 1; roastCook: number; singing: boolean; luckUntil: number; kiteH: number | null; lastKite: number }

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

let clock = () => Date.now()
const pub = (p: P): PlayerPub => ({
  id: p.id, name: p.name, ...(p.avatar ? { avatar: p.avatar } : {}), x: p.x, z: p.z, r: p.r, bed: p.bed, fishing: p.fishing, bob: p.bob, ...(p.net ? { net: 1 as const } : {}), ride: p.ride, up: p.up, act: p.act, seat: p.seat,
  ...(p.roastAt ? { roast: [p.roastFood, p.roastCook, clock() - p.roastAt] as [0 | 1, number, number] } : {}),
  ...(p.singing ? { sing: 1 as const } : {}),
  ...(p.luckUntil > clock() ? { luck: 1 as const } : {}),
  ...(p.kiteH !== null ? { kite: p.kiteH } : {}),
})
/** 아무도 안 탄 배가 이만큼 그대로면 제자리로 */
const BOAT_HOME_MS = 10 * 60_000

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
  clock = ctx.now
  // 네잎클로버: 풀밭 아무 데나 숨어 있다가 누가 주우면 다른 곳에 새로 (사용자 요청 2026-11-19)
  const cloverSpot = (): [number, number] => {
    for (let i = 0; i < 400; i++) {
      const x = -125 + rand() * 250, z = 18 + rand() * 80
      if (onGrass(x, z) && onGrass(x + 0.5, z) && onGrass(x, z + 0.5)) return [r2(x), r2(z)]
    }
    return [0, 30]
  }
  const clovers: [number, number][] = Array.from({ length: CLOVER_COUNT }, cloverSpot)
  const players = new Map<string, P>()
  const posDirty = new Set<string>()
  let lastPos = 0
  const send = (to: string, m: ServerMsg) => ctx.sendTo(to, m)
  const all = (m: ServerMsg) => ctx.broadcast(m)
  // 배: 앞 5척은 늘 있고, 바다에 빈 배가 없을 때만 한 척씩 더 띄움 (최대 3척, 3분 안 쓰면 다시 사라짐)
  const boats = BOAT_SLOTS.map((b) => ({ x: b.x, z: b.z, r: b.r, rider: null as string | null, passenger: null as string | null, used: 0, active: !b.extra, since: 0 }))
  const boatsPub = (): BoatPub[] => boats.map((b) => [b.x, b.z, b.r, b.rider, b.passenger, b.active ? 1 : 0])
  // 나무 상자: 남은 힘·처음 힘·다시 생기는 때
  const rollHp = () => CRATE_HP.min + Math.floor(rand() * (CRATE_HP.max - CRATE_HP.min + 1))
  const crates = CRATES.map(() => {
    const hp = rollHp()
    return { hp, max: hp, back: 0 }
  })
  const cratesPub = (): CratePub[] => crates.map((c) => [c.hp, c.max])
  const allCrates = () => all({ t: 'crates', l: cratesPub() })
  let lastHome = 0
  const castles = CASTLES.map(() => ({ built: true, buildEnd: 0, builder: null as string | null }))
  const castlesPub = (): CastlePub[] => castles.map((c) => [c.built ? 1 : 0, c.builder ? Math.max(0, c.buildEnd - ctx.now()) : 0, c.builder])
  const allCastles = () => all({ t: 'castles', l: castlesPub() })
  /** 이 사람이 쌓던 모래성은 멈춤 */
  const stopBuilding = (id: string) => {
    let changed = false
    for (const c of castles) if (c.builder === id) ((c.builder = null), (changed = true))
    if (changed) allCastles()
  }
  const nameOf = (key: string) => ctx.members().find((m) => m.id === key)?.nickname ?? '익명'

  function join(key: string) {
    const mem = ctx.members().find((m) => m.id === key)
    if (!mem) return
    let p = players.get(key)
    if (!p) {
      // 빈자리 근처에서 시작 (겹치지 않게 조금씩 흩뿌림)
      const a = rand() * Math.PI * 2
      p = { id: key, name: mem.nickname, ...(mem.avatar ? { avatar: mem.avatar } : {}), x: r2(SPAWN.x + Math.cos(a) * 2.5), z: r2(SPAWN.z + Math.sin(a) * 1.5), r: Math.PI, bed: null, fishing: 'none', bob: null, ride: null, up: null, act: null, seat: null, uid: mem.uid ?? null, castAt: 0, biteAt: 0, biteUntil: 0, zone: null, lastMv: ctx.now(), lastChat: 0, lastBonk: 0, lastJump: 0, castX: 0, castZ: 0, roastAt: 0, roastFood: 0, roastCook: 0, singing: false, luckUntil: 0, kiteH: null, lastKite: 0 }
      players.set(key, p)
      all({ t: 'st', p: pub(p) })
    }
    send(key, { t: 'init', you: key, players: [...players.values()].map(pub), saving: savingOn(), boats: boatsPub(), castles: castlesPub(), crates: cratesPub(), clovers })
    if (p.uid) void loadProfile(p.uid).then((profile) => players.has(key) && send(key, { t: 'profile', profile }))
  }

  function stopFishing(p: P) {
    if (p.fishing === 'none') return false
    p.fishing = 'none'
    p.bob = null
    p.zone = null
    delete p.net
    return true
  }

  function move(p: P, m: Extract<ClientMsg, { t: 'mv' }>) {
    if (!num(m.x, MAP_VIEW.minX - 1, MAP_VIEW.maxX + 1) || !num(m.z, MAP_VIEW.minZ - 1, MAP_VIEW.maxZ + 1) || !num(m.r, -100, 100)) return
    const now = ctx.now()
    // 같이 탄 사람은 배를 못 움직임 (자리는 배를 따라감)
    if (p.ride !== null && boats[p.ride].passenger === p.id) {
      p.lastMv = now
      return
    }
    const dt = Math.min(2, (now - p.lastMv) / 1000)
    p.lastMv = now
    let { x, z } = m
    // 너무 빠르면 갈 수 있는 만큼만, 물·맵 밖이면 그대로
    const far = Math.hypot(x - p.x, z - p.z)
    const allow = (p.ride !== null ? boatSpeed(p.ride) : RUN_SPEED) * dt * 1.6 + 0.6
    if (far > allow) {
      x = p.x + ((x - p.x) / far) * allow
      z = p.z + ((z - p.z) / far) * allow
    }
    // 배는 그 물 위만, 사다리 위는 위 자리 안만, 아니면 걸을 수 있는 곳
    // 앉아 있다가 움직이면: 일어나는 곳에서부터 (자리가 막힌 곳 안일 수 있어서). 제자리 신호(방향만 바뀜)는 무시
    if (p.seat !== null) {
      const here = SEATS[p.seat]
      if (Math.hypot(m.x - here.x, m.z - here.z) < 0.3) {
        p.lastMv = now
        return
      }
      const st = here.stand
      p.seat = null
      p.x = st.x
      p.z = st.z
      all({ t: 'st', p: pub(p) })
    }
    const ok = p.ride !== null ? boatable(x, z, BOAT_SLOTS[p.ride].zone) : p.up !== null ? onLadderTop(p.up, x, z) : walkable(x, z)
    if (!ok) return send(p.id, { t: 'st', p: pub(p) })
    const moved = Math.hypot(x - p.x, z - p.z) > 0.05
    p.x = r2(x)
    p.z = r2(z)
    p.r = r2(m.r)
    if (p.ride !== null) {
      const b = boats[p.ride]
      b.x = p.x
      b.z = p.z
      b.r = p.r
      b.used = now
      // 같이 탄 사람도 배를 따라감
      const q = b.passenger ? players.get(b.passenger) : undefined
      if (q) {
        q.x = p.x
        q.z = p.z
        q.r = p.r
        posDirty.add(q.id)
        if (q.fishing !== 'none' && Math.hypot(q.x - q.castX, q.z - q.castZ) > 4) {
          stopFishing(q)
          all({ t: 'st', p: pub(q) })
        }
      }
    }
    // 움직이면 일어나고, 던진 자리에서 꽤 벗어나면 낚싯대를 거둠
    // (손을 떼도 조금 미끄러지는 것·배가 출렁 밀리는 것으론 안 끊기게 — 배에서 던지자마자 거둬지던 문제)
    const drift = Math.hypot(p.x - p.castX, p.z - p.castZ)
    const reelOff = p.fishing !== 'none' && drift > (p.ride !== null ? 4 : 1)
    if (moved) stopBuilding(p.id)
    if ((moved && (p.bed !== null || p.act)) || reelOff) {
      p.bed = null
      p.act = null
      stopFishing(p)
      all({ t: 'st', p: pub(p) })
    }
    posDirty.add(p.id)
  }

  function cast(p: P) {
    if (p.fishing !== 'none') return
    const bed = p.bed !== null ? BEDS[p.bed] : null
    const water = bed ? castTarget(bed.x, bed.z, bed.r) : castTarget(p.x, p.z, p.r)
    // 물이 없으면 곤충 채집 (숲·꽃밭, 걸어 다닐 때만)
    const bug = !water && !bed && p.ride === null && p.up === null && p.seat === null ? bugSpot(p.x, p.z, p.r) : null
    const t = water ?? bug
    if (!t) return send(p.id, { t: 'st', p: pub(p) })
    const now = ctx.now()
    p.fishing = 'cast'
    p.bob = t.bob
    p.zone = t.zone
    if (bug) p.net = 1
    else delete p.net
    if (!bed) p.r = r2(t.r)
    p.castAt = now
    p.castX = p.x
    p.castZ = p.z
    p.biteAt = now + (bug ? BUG_MIN_MS + rand() * (BUG_MAX_MS - BUG_MIN_MS) : BITE_MIN_MS + rand() * (BITE_MAX_MS - BITE_MIN_MS))
    all({ t: 'st', p: pub(p) })
  }

  function reel(p: P) {
    if (p.fishing === 'cast') {
      stopFishing(p)
      return all({ t: 'st', p: pub(p) })
    }
    if (p.fishing !== 'bite' || !p.zone) return
    const lucky = p.luckUntil > ctx.now()
    const c = p.zone === 'forest' || p.zone === 'meadow' ? rollBugCatch(rand, p.zone, isNightHour(gameHour(Date.now())), lucky) : rollCatch(rand, p.zone, lucky)
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

  const allBoats = () => all({ t: 'boats', l: boatsPub() })
  const bad = (p: P) => send(p.id, { t: 'st', p: pub(p) })

  /** 배에서 빠짐: 젓던 사람이 빠지면 같이 탄 사람이 이어서 저음 */
  function leaveBoat(p: P) {
    if (p.ride === null) return
    const b = boats[p.ride]
    if (b.passenger === p.id) b.passenger = null
    else if (b.rider === p.id) {
      b.rider = b.passenger
      b.passenger = null
    }
    b.used = ctx.now()
  }

  /** 배 타기: 가까운 빈 배에 앉음 (위치 = 배 자리) */
  function board(p: P, i: unknown) {
    if (typeof i !== 'number' || !Number.isInteger(i) || !boats[i]) return
    const b = boats[i]
    // 비었으면 젓는 사람, 한 명 타 있으면 같이 탐 (카약은 한 명만)
    if (!b.active || (BOAT_SLOTS[i].kayak && b.rider) || p.ride !== null || p.up !== null || p.seat !== null || (b.rider && b.passenger) || Math.hypot(b.x - p.x, b.z - p.z) > BOARD_REACH + 0.5) return bad(p)
    stopFishing(p)
    p.bed = null
    p.act = null
    p.ride = i
    if (b.rider) b.passenger = p.id
    else b.rider = p.id
    b.used = ctx.now()
    p.x = b.x
    p.z = b.z
    p.r = b.r
    all({ t: 'st', p: pub(p) })
    allBoats()
  }

  /** 배에서 내리기: 가까운 땅·판자로 (배는 거기 둠) */
  function unboard(p: P) {
    if (p.ride === null) return
    const spot = landingSpot(p.x, p.z)
    if (!spot) return bad(p)
    leaveBoat(p)
    stopFishing(p)
    p.ride = null
    p.x = spot.x
    p.z = spot.z
    all({ t: 'st', p: pub(p) })
    allBoats()
  }

  function climb(p: P, i: unknown) {
    if (typeof i !== 'number' || !Number.isInteger(i) || !LADDERS[i]) return
    if (p.ride !== null || p.up !== null || p.seat !== null || nearLadder(p.x, p.z) !== i) return bad(p)
    stopFishing(p)
    p.bed = null
    p.act = null
    p.up = i
    p.x = LADDERS[i].top.x
    p.z = LADDERS[i].top.z
    all({ t: 'st', p: pub(p) })
  }

  /** 앉기·눕기 (배·썬베드에선 안 됨) */
  function pose(p: P, a: unknown) {
    const act = a === 'sit' || a === 'lie' ? a : null
    if (act && (p.ride !== null || p.bed !== null)) return bad(p)
    if (p.act === act) return
    p.act = act
    all({ t: 'st', p: pub(p) })
  }

  /** 점프: 배·썬베드·사다리 오르는 중엔 안 됨, 앉거나 누웠으면 일어남 */
  function jump(p: P) {
    const now = ctx.now()
    if (p.ride !== null || p.bed !== null || now - p.lastJump < JUMP_MS - 60) return
    p.lastJump = now
    if (p.act) {
      p.act = null
      all({ t: 'st', p: pub(p) })
    }
    all({ t: 'jump', id: p.id })
  }

  function down(p: P) {
    if (p.up === null) return
    const l = LADDERS[p.up]
    stopFishing(p)
    p.up = null
    p.x = l.foot.x
    p.z = l.foot.z
    all({ t: 'st', p: pub(p) })
  }

  /** 앉을 자리에 앉기·눕기 / 일어나기 (i = null) */
  function seat(p: P, i: unknown) {
    if (i === null) {
      if (p.seat === null) return
      const st = SEATS[p.seat].stand
      p.seat = null
      p.x = st.x
      p.z = st.z
      return all({ t: 'st', p: pub(p) })
    }
    if (typeof i !== 'number' || !Number.isInteger(i) || !SEATS[i]) return
    if (p.ride !== null || p.up !== null || p.bed !== null || nearSeat(p.x, p.z) !== i || [...players.values()].some((o) => o !== p && o.seat === i)) return bad(p)
    const st = SEATS[i]
    stopFishing(p)
    p.act = null
    p.seat = i
    p.x = st.x
    p.z = st.z
    p.r = r2(st.r)
    stopBuilding(p.id)
    all({ t: 'st', p: pub(p) })
  }

  function lie(p: P, i: unknown) {
    // 썬베드에서 일어나기
    if (i === -1) {
      if (p.bed === null) return
      p.bed = null
      stopFishing(p)
      return all({ t: 'st', p: pub(p) })
    }
    if (typeof i !== 'number' || !Number.isInteger(i) || !BEDS[i] || p.ride !== null || p.up !== null || p.seat !== null) return
    if (nearBed(p.x, p.z) !== i || [...players.values()].some((o) => o !== p && o.bed === i)) return send(p.id, { t: 'st', p: pub(p) })
    stopFishing(p)
    p.act = null
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
    // 사람이 없으면 앞에 있는 모래성(서 있거나 쌓는 중)이나 나무 상자 중 가까운 것
    if (!best) {
      const front = (x: number, z: number, near: number, reach: number) => {
        const dx = x - p.x, dz = z - p.z
        const d = Math.hypot(dx, dz)
        return d < reach && (d < near || (dx * fx + dz * fz) / d > 0.3) ? d : Infinity
      }
      let kind: 'castle' | 'crate' | null = null
      let at = -1
      let cd = Infinity
      CASTLES.forEach((c, i) => {
        const d = castles[i].built || castles[i].builder ? front(c.x, c.z, 1.1, BONK_REACH + 0.9) : Infinity
        if (d < cd) ((cd = d), (at = i), (kind = 'castle'))
      })
      CRATES.forEach((c, i) => {
        const d = crates[i].hp > 0 ? front(c.x, c.z, 0.9, BONK_REACH + 0.5) : Infinity
        if (d < cd) ((cd = d), (at = i), (kind = 'crate'))
      })
      if (kind === 'castle') {
        castles[at].built = false
        castles[at].builder = null
        all({ t: 'bonk', id: p.id, to: null, castle: at })
        return allCastles()
      }
      if (kind === 'crate') {
        const c = crates[at]
        c.hp -= 1
        if (c.hp <= 0) c.back = now + CRATE_RESPAWN_MS
        all({ t: 'bonk', id: p.id, to: null, crate: at })
        return allCrates()
      }
    }
    all({ t: 'bonk', id: p.id, to: best?.id ?? null })
  }

  /** 무너진 모래성 다시 쌓기 (가까이에서, 아무도 안 쌓고 있을 때) */
  function build(p: P, i: unknown) {
    if (typeof i !== 'number' || !Number.isInteger(i) || !castles[i]) return
    const c = castles[i]
    if (c.built || c.builder || p.ride !== null || p.up !== null || nearCastle(p.x, p.z) !== i) return
    stopFishing(p)
    p.act = null
    p.bed = null
    c.builder = p.id
    c.buildEnd = ctx.now() + BUILD_MS
    all({ t: 'st', p: pub(p) })
    allCastles()
  }

  /** 모닥불 굽기: 모닥불 통나무에 앉아 있을 때 시작, 다시 보내면 빼서 익은 정도를 정함 (알맞은 때는 굽는 사람마다 무작위) */
  function roast(p: P) {
    if (fireOfSeat(p.seat) === null) return bad(p)
    const now = ctx.now()
    if (!p.roastAt) {
      p.roastAt = now
      p.roastFood = rand() < 0.5 ? 0 : 1
      p.roastCook = Math.round(ROAST_MIN_MS + rand() * (ROAST_MAX_MS - ROAST_MIN_MS))
      return all({ t: 'st', p: pub(p) })
    }
    const off = now - p.roastAt - p.roastCook
    const grade: RoastGrade = off < -ROAST_GOLD_MS ? 'raw' : off <= ROAST_GOLD_MS ? 'golden' : 'burnt'
    const food = p.roastFood
    p.roastAt = 0
    all({ t: 'roasted', id: p.id, food, grade })
    all({ t: 'st', p: pub(p) })
  }

  /** 모닥불 노래: 통나무에 앉아 있을 때만 켜고 끔 (앉은 사람·노래하는 사람 수만큼 불이 커지는 건 화면이) */
  function sing(p: P) {
    if (fireOfSeat(p.seat) === null && !p.singing) return bad(p)
    p.singing = !p.singing
    all({ t: 'st', p: pub(p) })
  }

  /** 네잎클로버 줍기: 가까이 있을 때만 → 3분 행운, 그 자리엔 다른 곳에 새로 숨김 */
  function clover(p: P, i: unknown) {
    if (typeof i !== 'number' || !Number.isInteger(i) || !clovers[i]) return
    const [x, z] = clovers[i]
    if (p.ride !== null || Math.hypot(x - p.x, z - p.z) > CLOVER_REACH + 0.6) return
    clovers[i] = cloverSpot()
    p.luckUntil = ctx.now() + LUCK_MS
    all({ t: 'clovers', l: clovers, by: p.id })
    all({ t: 'st', p: pub(p) })
  }

  /** 연날리기: 높이는 화면이 정함(장난감이라) — 서버는 날릴 수 있는 곳·범위만 보고 모두에게 넘김 (1초에 4번까지) */
  function kite(p: P, h: unknown) {
    const now = ctx.now()
    if (h === null) {
      if (p.kiteH === null) return
      p.kiteH = null
      return all({ t: 'kite', id: p.id, h: null })
    }
    if (!num(h, 0, KITE_MAX) || now - p.lastKite < 220) return
    if (p.kiteH === null && (p.ride !== null || p.seat !== null || p.bed !== null || !kiteOk(p.x, p.z))) return bad(p)
    p.lastKite = now
    p.kiteH = Math.round((h as number) * 10) / 10
    all({ t: 'kite', id: p.id, h: p.kiteH })
  }

  async function setTank(p: P, keys: unknown) {
    if (!p.uid || !Array.isArray(keys)) return
    const uid = p.uid
    const profile = await loadProfile(uid)
    const have = new Set(profile.bag.map((x) => x.k))
    profile.tank = [...new Set(keys.filter((k): k is string => typeof k === 'string' && have.has(k) && !isBugId(profile.bag.find((x) => x.k === k)!.f)))].slice(0, TANK_MAX)
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
        case 'board':
          board(p, m.i)
          break
        case 'unboard':
          unboard(p)
          break
        case 'climb':
          climb(p, m.i)
          break
        case 'down':
          down(p)
          break
        case 'pose':
          pose(p, m.p)
          break
        case 'seat':
          seat(p, m.i)
          break
        case 'jump':
          jump(p)
          break
        case 'build':
          build(p, m.i)
          break
        case 'roast':
          roast(p)
          break
        case 'sing':
          sing(p)
          break
        case 'clover':
          clover(p, m.i)
          break
        case 'kite':
          kite(p, m.h)
          break
      }
      return true
    },
    tick(now) {
      for (const p of players.values()) {
        // 모닥불을 떠나면 굽기·노래 끝, 배·자리에 들면 연도 거둠, 행운이 끝나면 알림
        if ((p.roastAt || p.singing) && fireOfSeat(p.seat) === null) {
          p.roastAt = 0
          p.singing = false
          all({ t: 'st', p: pub(p) })
        }
        if (p.kiteH !== null && (p.ride !== null || p.seat !== null || p.bed !== null || p.up !== null)) {
          p.kiteH = null
          all({ t: 'kite', id: p.id, h: null })
        }
        if (p.luckUntil && p.luckUntil <= now) {
          p.luckUntil = 0
          all({ t: 'st', p: pub(p) })
        }
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
      // 부서진 나무 상자 다시 생김
      if (crates.some((c) => c.hp <= 0 && now >= c.back)) {
        for (const c of crates) if (c.hp <= 0 && now >= c.back) ((c.max = rollHp()), (c.hp = c.max))
        allCrates()
      }
      // 다 쌓은 모래성
      if (castles.some((c) => c.builder && now >= c.buildEnd)) {
        for (const c of castles) if (c.builder && now >= c.buildEnd) ((c.built = true), (c.builder = null))
        allCastles()
      }
      // 오래 아무도 안 탄 배는 제자리로 (멀리 두고 가도 다른 사람이 탈 수 있게)
      if (now - lastHome > 10_000) {
        lastHome = now
        let moved = false
        boats.forEach((b, i) => {
          const h = BOAT_SLOTS[i]
          if (b.active && !b.rider && !b.passenger && b.used && now - b.used > BOAT_HOME_MS && (b.x !== h.x || b.z !== h.z)) {
            Object.assign(b, { x: h.x, z: h.z, r: h.r, used: 0 })
            moved = true
          }
        })
        // 바다에 탈 수 있는 배(자리가 남은 배)가 없으면 한 척 더
        const sea = boats.filter((b, i) => b.active && BOAT_SLOTS[i].zone === 'sea' && !BOAT_SLOTS[i].kayak)
        const free = sea.filter((b) => !b.rider || !b.passenger)
        if (free.length === 0) {
          const i = boats.findIndex((b, k) => !b.active && BOAT_SLOTS[k].extra)
          if (i >= 0) {
            const h = BOAT_SLOTS[i]
            Object.assign(boats[i], { active: true, x: h.x, z: h.z, r: h.r, used: 0, since: now })
            moved = true
          }
        }
        // 더 띄운 배는 아무도 안 탄 채 3분 지나고, 다른 빈 바다 배가 있으면 다시 치움
        const emptySea = sea.filter((b) => !b.rider && !b.passenger)
        boats.forEach((b, i) => {
          if (!BOAT_SLOTS[i].extra || !b.active || b.rider || b.passenger || emptySea.length < 2) return
          if (now - Math.max(b.used, b.since) > 3 * 60_000) {
            b.active = false
            emptySea.splice(emptySea.indexOf(b), 1)
            moved = true
          }
        })
        if (moved) allBoats()
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
      const p = players.get(key)
      if (p && p.ride !== null) {
        leaveBoat(p)
        allBoats()
      }
      if (p) stopBuilding(p.id)
      if (players.delete(key)) all({ t: 'gone', id: key })
    },
    finished: () => false,
  }
}

export const fishingRefereeFactory: RefereeFactory = (setup, ctx) => fishingReferee(setup, ctx)
