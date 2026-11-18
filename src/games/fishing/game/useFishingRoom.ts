import { useCallback, useEffect, useRef, useState } from 'react'
import { type Room, RoomError, createRoom, joinRoom } from '../../../shared/online/room'
import { REFEREE_FROM } from '../../../shared/online/hubProtocol'
import { encodeLook } from '../../../shared/art3d/animalKinds'
import { loadLook } from '../../../shared/storage/avatar'
import { type Catch, fishById, isBig } from '../play/fish'
import { castTarget, nearBed, moveBy, RUN_SPEED, WALK_SPEED, BEDS, BOATS, BOAT_REACH, BOAT_SPEED, LADDERS, landingSpot, moveBoat, nearLadder, onLadderTop } from '../play/map'
import {
  type Act,
  type BagItem,
  type BoatPub,
  type ClientMsg,
  FISHING_CAPACITY,
  FISHING_GAME,
  MAX_ROOMS,
  type PlayerPub,
  type Profile,
  type ServerMsg,
  fishingRoomCode,
} from '../play/protocol'
import { playSound } from '../sounds'

// 낚시터 방 들어가기 + 서버(심판)와 주고받기. 3D 화면은 world(매 프레임 읽는 바뀌는 상자)를, 버튼·창은 React 상태를 본다.
// 내 위치는 내 기기가 정하고(조이스틱·키보드) 움직이는 동안 1초 8번 서버로. 다른 사람은 받은 위치로 부드럽게 따라감.

export type Shown = PlayerPub & {
  /** 화면에 그리는 위치 (받은 위치로 부드럽게 따라감) */
  sx: number
  sz: number
  sr: number
  /** 이때까지 걷는 중으로 그림 */
  walkUntil: number
  bubble: { text: string; until: number } | null
  /** 머리 위로 든 물고기 (잡았거나 자랑) — from = 물에서 날아오는 곳(잡았을 때 찌 자리) */
  popup: { c: Catch; start: number; until: number; from: [number, number] | null } | null
  biteAt: number
  /** 뿅망치를 휘두른 때 · 맞은 때 */
  bonkAt: number
  hitAt: number
  /** 사다리 오르내리는 중 (그림만): 시작 시각·걸리는 시간·위로(1)/아래로(-1)·사다리 번호 */
  climb: { start: number; dur: number; dir: 1 | -1; i: number } | null
  /** 받은 위치 기록 (다른 사람): 0.16초 늦게 그 사이를 이어 그려서 툭툭 끊기지 않게 */
  hist: { t: number; x: number; z: number; r: number }[]
  /** 지금 움직이는 빠르기 (m/s, 걷기·달리기 그림) */
  speed: number
}

/** 다른 사람은 이만큼 늦게 그림 (서버가 0.1초마다 보내서 그 사이를 이어 그림) */
const INTERP_MS = 160
const angleLerp = (a: number, b: number, k: number) => a + Math.atan2(Math.sin(b - a), Math.cos(b - a)) * k

/** 사다리 오르내리는 데 걸리는 시간 (ms) — 높이에 비례 */
export const climbMs = (i: number) => 500 + LADDERS[i].y * 180

/** 폰 진동 (안드로이드 크롬 등 — 아이폰 사파리는 안 됨) */
const buzz = (pattern: number | number[]) => {
  try {
    navigator.vibrate?.(pattern)
  } catch {
    /* 안 되는 기기 */
  }
}

export type World = {
  me: string
  players: Map<string, Shown>
  /** 조이스틱·키보드 (x 오른쪽, y 아래쪽 = 화면 기준, 크기 0~1) */
  input: { x: number; y: number; run: boolean }
  /** 내 움직임 빠르기 (부드럽게 출발·멈춤) */
  vel: { x: number; z: number }
  /**
   * 시점 (사용자 요청 2026-11-17): yaw 좌우 돌림(0 = 바다 쪽을 봄), pitch 위아래, dist 3인칭 거리, first 1인칭.
   * spin = Q·E로 돌리는 중(-1·0·1). 내가 직접 돌릴 때만 움직임 (저절로 돌지 않음 — 멀미)
   */
  cam: { yaw: number; pitch: number; dist: number; first: boolean; spin: number }
  /** 탈 수 있는 배들 (탄 사람이 있으면 그 사람 자리를 따라 그림) */
  boats: { x: number; z: number; r: number; rider: string | null }[]
}

export const CAM_LIMITS = { third: { min: 0.2, max: 1.35 }, first: { min: -0.7, max: 1.0 }, dist: { min: 5, max: 24 } }

export type Toast = { key: number; text: string; color: string; c?: Catch }
export type ChatLine = { key: number; name: string; text: string; mine: boolean }
export type Action = 'reel' | 'reelIn' | 'cast' | 'bed' | 'none'
/** 작은 버튼 (E): 배 타기·내리기, 사다리 오르기·내려가기 */
export type Alt = 'board' | 'unboard' | 'climb' | 'down' | 'noLand' | null

const SEND_MS = 125

async function enter(nickname: string): Promise<Room<ClientMsg>> {
  const look = loadLook()
  const opts = { capacity: FISHING_CAPACITY, ...(look ? { avatar: encodeLook(look) } : {}) }
  for (let n = 1; n <= MAX_ROOMS; n++) {
    const code = fishingRoomCode(n)
    try {
      return await joinRoom<ClientMsg>(FISHING_GAME, code, nickname, opts)
    } catch (e) {
      if (!(e instanceof RoomError)) throw e
      if (e.reason === 'full') continue
      if (e.reason !== 'not-found') throw e
    }
    // 아직 아무도 없는 낚시터: 내가 열고 서버 심판을 세움 (방장이 나가도 먼저 온 사람이 이어받아 계속 돎)
    try {
      const room = await createRoom<ClientMsg>(FISHING_GAME, nickname, { ...opts, code })
      room.startReferee?.(FISHING_GAME, {})
      return room
    } catch (e) {
      if (!(e instanceof RoomError) || e.reason !== 'full') throw e
      // 같은 순간 누가 먼저 열었음 → 들어가 보기
      try {
        return await joinRoom<ClientMsg>(FISHING_GAME, code, nickname, opts)
      } catch (e2) {
        if (!(e2 instanceof RoomError) || e2.reason !== 'full') throw e2
      }
    }
  }
  throw new RoomError('full')
}

export function useFishingRoom(nickname: string, active: boolean) {
  const [status, setStatus] = useState<'idle' | 'joining' | 'ready' | 'error'>('idle')
  const [error, setError] = useState('')
  const [roomLabel, setRoomLabel] = useState('')
  const [count, setCount] = useState(0)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [saving, setSaving] = useState(true)
  const [chat, setChat] = useState<ChatLine[]>([])
  const [toasts, setToasts] = useState<Toast[]>([])
  const [myCatch, setMyCatch] = useState<{ c: Catch; best: boolean; key: number } | null>(null)
  const [tankView, setTankView] = useState<{ who: string; name: string; items: BagItem[] } | null>(null)
  const [action, setAction] = useState<Action>('none')
  const [alt, setAlt] = useState<Alt>(null)
  const roomRef = useRef<Room<ClientMsg> | null>(null)
  const world = useRef<World>({ me: '', players: new Map(), input: { x: 0, y: 0, run: false }, cam: { yaw: 0, pitch: 0.82, dist: 11, first: false, spin: 0 }, vel: { x: 0, z: 0 }, boats: BOATS.map((b) => ({ x: b.x, z: b.z, r: b.r, rider: null })) }).current
  const keySeq = useRef(0)
  // 개발 모드에서만: 브라우저 시험이 상태를 볼 수 있게
  if (import.meta.env.DEV) (window as unknown as { __fishWorld?: World }).__fishWorld = world
  const lastSent = useRef({ at: 0, x: 0, z: 0, r: 0 })

  const send = useCallback((m: ClientMsg) => roomRef.current?.send(m), [])

  const toast = useCallback((text: string, color: string, c?: Catch) => {
    const key = ++keySeq.current
    setToasts((ts) => [...ts.slice(-2), { key, text, color, ...(c ? { c } : {}) }])
    setTimeout(() => setToasts((ts) => ts.filter((t) => t.key !== key)), 4200)
  }, [])

  // 방 들어가기
  useEffect(() => {
    if (!active) return
    let alive = true
    let room: Room<ClientMsg> | null = null
    let gotInit = false
    setStatus('joining')
    const upsert = (p: PlayerPub) => {
      const old = world.players.get(p.id)
      if (!old) {
        world.players.set(p.id, { ...p, sx: p.x, sz: p.z, sr: p.r, walkUntil: 0, bubble: null, popup: null, biteAt: 0, bonkAt: 0, hitAt: 0, climb: null, hist: [{ t: performance.now(), x: p.x, z: p.z, r: p.r }], speed: 0 })
        return
      }
      const isMe = p.id === world.me
      // 사다리를 오르내리면 그림으로 천천히
      if (p.up !== old.up) {
        const i = (p.up ?? old.up)!
        old.climb = { start: performance.now(), dur: climbMs(i), dir: p.up !== null ? 1 : -1, i }
      }
      // 내 위치는 내 기기가 정함 — 서버와 많이 어긋났거나(물·막힘) 썬베드에 누웠거나 배·사다리가 바뀌었을 때만 맞춤
      const changedSpot = p.ride !== old.ride || p.up !== old.up
      const snap = !isMe || p.bed !== null || changedSpot || Math.hypot(p.x - old.x, p.z - old.z) > 1.5
      Object.assign(old, { name: p.name, avatar: p.avatar, bed: p.bed, fishing: p.fishing, bob: p.bob, ride: p.ride, up: p.up, act: p.act })
      if (changedSpot) {
        old.sx = old.x = p.x
        old.sz = old.z = p.z
        old.sr = old.r = p.r
        old.hist = [{ t: performance.now(), x: p.x, z: p.z, r: p.r }]
        if (isMe) world.vel.x = world.vel.z = 0
      } else if (!isMe && snap) old.hist.push({ t: performance.now(), x: p.x, z: p.z, r: p.r })
      if (snap) {
        old.x = p.x
        old.z = p.z
        old.r = p.r
        if (isMe || p.bed !== null) {
          old.sx = p.x
          old.sz = p.z
          old.sr = p.r
        }
      } else if (p.fishing !== 'none') old.r = old.sr = p.r
      if (p.fishing !== 'bite') old.biteAt = 0
    }
    const setBoats = (l: BoatPub[]) => {
      l.forEach(([x, z, r, rider], i) => {
        if (world.boats[i]) Object.assign(world.boats[i], { x, z, r, rider })
      })
    }
    const onMsg = (raw: unknown, from?: string) => {
      if (from !== REFEREE_FROM) return
      const m = raw as ServerMsg
      const now = performance.now()
      switch (m.t) {
        case 'init':
          gotInit = true
          world.me = m.you
          world.players.clear()
          for (const p of m.players) upsert(p)
          setSaving(m.saving)
          setBoats(m.boats)
          setCount(m.players.length)
          setStatus('ready')
          return
        case 'boats':
          setBoats(m.l)
          return
        case 'st':
          upsert(m.p)
          setCount(world.players.size)
          return
        case 'pos':
          for (const [id, x, z, r] of m.l) {
            if (id === world.me) continue
            const p = world.players.get(id)
            if (!p) continue
            p.x = x
            p.z = z
            p.r = r
            p.hist.push({ t: now, x, z, r })
            if (p.hist.length > 8) p.hist.splice(0, p.hist.length - 8)
          }
          return
        case 'gone':
          world.players.delete(m.id)
          setCount(world.players.size)
          return
        case 'bite': {
          const p = world.players.get(m.id)
          if (p) p.biteAt = now
          if (m.id === world.me) {
            playSound('bite')
            // 입질이 오면 폰이 부르르 (사용자 요청)
            buzz([90, 60, 90, 60, 140])
          }
          return
        }
        case 'escape':
          if (m.id === world.me) {
            playSound('escape')
            toast('놓쳤어요… 입질이 오면 5초 안에 눌러요', '#c9c4f0')
          }
          return
        case 'catch': {
          const p = world.players.get(m.id)
          if (p) p.popup = { c: m.c, start: now, until: now + 3800, from: p.bob ? [p.bob[0], p.bob[1]] : null }
          const f = fishById(m.c.fish)
          if (m.id === world.me) {
            playSound(isBig(m.c) ? 'big' : f?.rarity === 'junk' ? 'junk' : 'catch')
            buzz(isBig(m.c) ? [60, 40, 60, 40, 260] : 70)
            setMyCatch({ c: m.c, best: m.best, key: ++keySeq.current })
          } else if (m.big) playSound('cheer')
          if (m.big) toast(`${m.name}님이 ${iroName(m.c)}${f?.name ?? ''}${m.c.size ? ` ${m.c.size}cm` : ''}를 낚았어요!`, '#ffd23f', m.c)
          return
        }
        case 'chat': {
          const p = world.players.get(m.id)
          if (p) p.bubble = { text: m.text, until: now + 4500 }
          setChat((ls) => [...ls.slice(-30), { key: ++keySeq.current, name: m.name, text: m.text, mine: m.id === world.me }])
          return
        }
        case 'profile':
          setProfile(m.profile)
          return
        case 'tank':
          setTankView({ who: m.who, name: m.name, items: m.items })
          return
        case 'bonk': {
          const p = world.players.get(m.id)
          if (p) p.bonkAt = now
          const hit = m.to ? world.players.get(m.to) : null
          if (hit) hit.hitAt = now
          if (m.to === world.me) buzz(50)
          // 소리는 나랑 관계있거나 가까울 때만
          const me = world.players.get(world.me)
          if (me && p && (m.id === world.me || m.to === world.me || Math.hypot(p.sx - me.sx, p.sz - me.sz) < 9)) playSound(hit ? 'bonk' : 'whiff')
          return
        }
        case 'brag': {
          const p = world.players.get(m.id)
          const c: Catch = { fish: m.item.f, iro: m.item.i, size: m.item.s }
          if (p) p.popup = { c, start: now, until: now + 3500, from: null }
          toast(`${m.name}님의 자랑: ${iroName(c)}${fishById(c.fish)?.name ?? ''}${c.size ? ` ${c.size}cm` : ''}`, '#ffb3cf', c)
          return
        }
      }
    }
    // 인사 → 서버가 지금 사람들을 보내 줌. 안 오면(심판이 없으면) 방장이 심판을 세우고 다시
    const hello = setInterval(() => {
      if (gotInit || !room) return
      if (room.role === 'host') room.startReferee?.(FISHING_GAME, {})
      room.send({ t: 'hi' })
    }, 2500)
    // 다른 앱에 갔다 오면 지금 상태를 다시 받음 (그동안 놓친 것)
    const onVisible = () => document.visibilityState === 'visible' && room?.send({ t: 'hi' })
    document.addEventListener('visibilitychange', onVisible)
    void enter(nickname)
      .then((r) => {
        if (!alive) return r.leave()
        room = r
        roomRef.current = r
        setRoomLabel(`낚시터 ${r.code.replace('FISH', '')}`)
        r.onMessage(onMsg)
        r.send({ t: 'hi' })
      })
      .catch((e) => {
        if (!alive) return
        setStatus('error')
        setError(e instanceof RoomError && e.reason === 'full' ? '낚시터가 모두 가득 찼어요. 조금 뒤에 다시 와 주세요' : '서버에 연결하지 못했어요. 인터넷 연결을 확인해 주세요')
      })
    return () => {
      alive = false
      clearInterval(hello)
      document.removeEventListener('visibilitychange', onVisible)
      room?.leave()
      roomRef.current = null
      world.players.clear()
    }
  }, [active, nickname, world, toast])

  /** 매 프레임 (3D 화면이 부름): 내 위치 움직이기 + 서버로 보내기 */
  const step = useCallback(
    (dt: number) => {
      const me = world.players.get(world.me)
      if (!me) return
      const cam = world.cam
      if (cam.spin) cam.yaw += cam.spin * 2.2 * dt
      // 화면 기준 입력을 보고 있는 쪽 기준으로 돌림 (위로 밀면 보는 쪽으로 걸음)
      const sx = world.input.x, sy = world.input.y
      const c = Math.cos(cam.yaw), s = Math.sin(cam.yaw)
      const ix = sx * c + sy * s
      const iy = -sx * s + sy * c
      const mag = Math.min(1, Math.hypot(ix, iy))
      const now = performance.now()
      // 다른 사람: 받은 위치 사이를 0.16초 늦게 이어 그림 (툭툭 끊기지 않게)
      const at = now - INTERP_MS
      for (const p of world.players.values()) {
        if (p.id === world.me) continue
        const h = p.hist
        while (h.length > 2 && h[1].t <= at) h.shift()
        let x = p.x, z = p.z, r = p.r
        if (h.length >= 2 && at < h[h.length - 1].t) {
          const a = h[0], b = h[1]
          const k = Math.max(0, Math.min(1, (at - a.t) / Math.max(1, b.t - a.t)))
          x = a.x + (b.x - a.x) * k
          z = a.z + (b.z - a.z) * k
          r = angleLerp(a.r, b.r, k)
        } else if (h.length) ({ x, z, r } = h[h.length - 1])
        const moved = Math.hypot(x - p.sx, z - p.sz)
        p.speed += ((dt > 0 ? moved / dt : 0) - p.speed) * Math.min(1, dt * 8)
        p.sx = x
        p.sz = z
        // 걸어가는 쪽을 보게, 몸은 부드럽게 돌림
        p.sr = angleLerp(p.sr, r, 1 - Math.exp(-dt * 12))
      }
      // 사다리 오르내리는 동안은 못 움직임
      if (me.climb && now - me.climb.start < me.climb.dur) return
      // 1인칭: 몸은 늘 보는 쪽을 향함 (던지는 방향 = 보는 방향)
      if (cam.first && me.bed === null) me.r = me.sr = cam.yaw + Math.PI
      // 빠르기는 부드럽게 붙었다 줄어듦 (확 출발·확 멈춤이 어지러워서)
      const top = me.ride !== null ? BOAT_SPEED : world.input.run ? RUN_SPEED : WALK_SPEED
      const want = mag > 0.15 ? top * mag : 0
      const n = Math.hypot(ix, iy) || 1
      const tvx = mag > 0.15 ? (ix / n) * want : 0, tvz = mag > 0.15 ? (iy / n) * want : 0
      const acc = 1 - Math.exp(-dt * (mag > 0.15 ? (me.ride !== null ? 3 : 10) : me.ride !== null ? 1.5 : 14))
      const vel = world.vel
      vel.x += (tvx - vel.x) * acc
      vel.z += (tvz - vel.z) * acc
      const sp = Math.hypot(vel.x, vel.z)
      me.speed = sp
      if (!cam.first && me.bed === null && mag > 0.15) {
        me.r = Math.atan2(ix, iy)
        // 몸은 부드럽게 돌림 (확 돌면 어지러움)
        me.sr = angleLerp(me.sr, me.r, 1 - Math.exp(-dt * 14))
      } else if (!cam.first) me.sr = angleLerp(me.sr, me.r, 1 - Math.exp(-dt * 14))
      if (sp < 0.05) vel.x = vel.z = 0
      if (sp > 0.05) {
        const dx = vel.x * dt
        const dz = vel.z * dt
        // 배는 그 물 위만, 사다리 위는 위 자리 안만
        const p =
          me.ride !== null
            ? moveBoat(me.x, me.z, dx, dz, BOATS[me.ride].zone)
            : me.up !== null
              ? onLadderTop(me.up, me.x + dx, me.z + dz)
                ? { x: me.x + dx, z: me.z + dz }
                : { x: me.x, z: me.z }
              : moveBy(me.x, me.z, dx, dz)
        if (me.ride !== null) {
          const b = world.boats[me.ride]
          if (b) Object.assign(b, { x: p.x, z: p.z, r: me.r })
        }
        // 벽에 막히면 그 방향 빠르기는 버림
        if (Math.abs(p.x - me.x) < Math.abs(dx) * 0.5) vel.x = 0
        if (Math.abs(p.z - me.z) < Math.abs(dz) * 0.5) vel.z = 0
        me.x = me.sx = p.x
        me.z = me.sz = p.z
        me.walkUntil = now + 120
        // 움직이면 일어나고 낚싯대를 거둠 (서버도 같은 판단)
        if (me.bed !== null || me.fishing !== 'none' || me.act) {
          me.bed = null
          me.act = null
          me.fishing = 'none'
          me.bob = null
        }
      }
      const ls = lastSent.current
      const changed = Math.hypot(me.x - ls.x, me.z - ls.z) > 0.04 || Math.abs(me.r - ls.r) > 0.05
      if (changed && now - ls.at > SEND_MS) {
        send({ t: 'mv', x: round(me.x), z: round(me.z), r: round(me.r) })
        lastSent.current = { at: now, x: me.x, z: me.z, r: me.r }
      }
    },
    [send, world],
  )

  // 오른쪽 큰 버튼이 지금 무엇을 할지 (0.15초마다)
  useEffect(() => {
    if (status !== 'ready') return
    const t = setInterval(() => {
      const me = world.players.get(world.me)
      if (!me) return setAction('none')
      // 썬베드 앞이면 눕기가 먼저 (사용자 요청 — 물가 바로 옆이라 늘 던지기만 떴음)
      const next: Action = me.fishing === 'bite' ? 'reel' : me.fishing === 'cast' ? 'reelIn' : me.bed !== null ? 'cast' : freeBed(world, me) !== null ? 'bed' : canCast(me) ? 'cast' : 'none'
      setAction(next)
      // 작은 버튼: 배에선 내리기(땅이 멀면 안내), 사다리 위면 내려가기, 아니면 가까운 배·사다리
      const ladder = me.ride === null && me.up === null ? nearLadder(me.x, me.z) : null
      setAlt(me.ride !== null ? (landingSpot(me.x, me.z) ? 'unboard' : 'noLand') : me.up !== null ? 'down' : ladder !== null ? 'climb' : freeBoat(world, me) !== null ? 'board' : null)
    }, 150)
    return () => clearInterval(t)
  }, [status, world])

  const act = useCallback(() => {
    const me = world.players.get(world.me)
    if (!me) return
    if (me.fishing === 'bite' || me.fishing === 'cast') return send({ t: 'reel' })
    if (me.bed !== null) {
      playSound('cast')
      return send({ t: 'cast' })
    }
    const bedHere = freeBed(world, me)
    if (bedHere !== null) return send({ t: 'bed', i: bedHere })
    const t = castTarget(me.x, me.z, me.r) ?? castTarget(me.x, me.z, me.r + Math.PI)
    if (t) {
      // 물 쪽으로 돌아서 던짐 (서버는 마지막 위치·방향으로 다시 확인)
      me.r = me.sr = t.r
      send({ t: 'mv', x: round(me.x), z: round(me.z), r: round(t.r) })
      lastSent.current = { at: performance.now(), x: me.x, z: me.z, r: t.r }
      playSound('cast')
      return send({ t: 'cast' })
    }
  }, [send, world])

  /** 작은 버튼 (E) */
  const doAlt = useCallback(() => {
    const me = world.players.get(world.me)
    if (!me || (me.climb && performance.now() - me.climb.start < me.climb.dur)) return
    if (me.ride !== null) {
      if (!landingSpot(me.x, me.z)) return toast('물가나 부두 가까이 가서 내려요', '#c9c4f0')
      playSound('board')
      return send({ t: 'unboard' })
    }
    if (me.up !== null) return send({ t: 'down' })
    const l = nearLadder(me.x, me.z)
    if (l !== null) return send({ t: 'climb', i: l })
    const b = freeBoat(world, me)
    if (b !== null) {
      playSound('board')
      send({ t: 'board', i: b })
    }
  }, [send, world, toast])

  /** 앉기·눕기 (같은 걸 다시 누르면 일어남) */
  const setPose = useCallback(
    (a: Exclude<Act, null>) => {
      const me = world.players.get(world.me)
      if (!me || me.ride !== null || me.bed !== null) return
      const next = me.act === a ? null : a
      me.act = next
      world.vel.x = world.vel.z = 0
      send({ t: 'pose', p: next })
    },
    [send, world],
  )

  /** 뿅망치 (F) — 내 화면은 바로 휘두르고, 맞았는지는 서버가 알려 줌 */
  const bonk = useCallback(() => {
    const me = world.players.get(world.me)
    if (!me || performance.now() - me.bonkAt < 700) return
    me.bonkAt = performance.now()
    send({ t: 'bonk' })
  }, [send, world])

  return { status, error, roomLabel, count, profile, saving, chat, toasts, myCatch, setMyCatch, tankView, setTankView, action, act, alt, doAlt, setPose, bonk, step, send, world }
}

const round = (v: number) => Math.round(v * 100) / 100
/** 가까운 빈 썬베드 (다른 사람이 누워 있으면 없음) */
function freeBed(world: World, me: Shown): number | null {
  const i = nearBed(me.x, me.z)
  if (i === null || !BEDS[i]) return null
  for (const p of world.players.values()) if (p.id !== me.id && p.bed === i) return null
  return i
}
/** 가까운 빈 배 */
function freeBoat(world: World, me: Shown): number | null {
  let best: number | null = null
  let bestD = BOAT_REACH
  world.boats.forEach((b, i) => {
    const d = Math.hypot(b.x - me.x, b.z - me.z)
    if (!b.rider && d < bestD) {
      bestD = d
      best = i
    }
  })
  return best
}
const canCast = (p: { x: number; z: number; r: number }) => !!(castTarget(p.x, p.z, p.r) ?? castTarget(p.x, p.z, p.r + Math.PI))
export const iroName = (c: Catch) => (c.iro ? `${{ silver: '은빛', sakura: '벚꽃', gold: '금빛', neon: '형광', obsidian: '흑요석', ghost: '유령', rainbow: '무지개' }[c.iro]} ` : '')
