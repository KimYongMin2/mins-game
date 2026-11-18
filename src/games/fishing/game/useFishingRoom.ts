import { useCallback, useEffect, useRef, useState } from 'react'
import { type Room, RoomError, createRoom, joinRoom } from '../../../shared/online/room'
import { REFEREE_FROM } from '../../../shared/online/hubProtocol'
import { encodeLook } from '../../../shared/art3d/animalKinds'
import { loadLook } from '../../../shared/storage/avatar'
import { type Catch, fishById, isBig } from '../play/fish'
import { castTarget, nearBed, moveBy, WALK_SPEED, BEDS } from '../play/map'
import {
  type BagItem,
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
}

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
  input: { x: number; y: number }
  /**
   * 시점 (사용자 요청 2026-11-17): yaw 좌우 돌림(0 = 바다 쪽을 봄), pitch 위아래, dist 3인칭 거리, first 1인칭.
   * spin = Q·E로 돌리는 중(-1·0·1). 내가 직접 돌릴 때만 움직임 (저절로 돌지 않음 — 멀미)
   */
  cam: { yaw: number; pitch: number; dist: number; first: boolean; spin: number }
}

export const CAM_LIMITS = { third: { min: 0.2, max: 1.35 }, first: { min: -0.7, max: 1.0 }, dist: { min: 5, max: 18 } }

export type Toast = { key: number; text: string; color: string; c?: Catch }
export type ChatLine = { key: number; name: string; text: string; mine: boolean }
export type Action = 'reel' | 'reelIn' | 'cast' | 'bed' | 'none'

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
  const roomRef = useRef<Room<ClientMsg> | null>(null)
  const world = useRef<World>({ me: '', players: new Map(), input: { x: 0, y: 0 }, cam: { yaw: 0, pitch: 0.82, dist: 11, first: false, spin: 0 } }).current
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
        world.players.set(p.id, { ...p, sx: p.x, sz: p.z, sr: p.r, walkUntil: 0, bubble: null, popup: null, biteAt: 0, bonkAt: 0, hitAt: 0 })
        return
      }
      const isMe = p.id === world.me
      // 내 위치는 내 기기가 정함 — 서버와 많이 어긋났거나(물·막힘) 썬베드에 누웠을 때만 맞춤
      const snap = !isMe || p.bed !== null || Math.hypot(p.x - old.x, p.z - old.z) > 1.5
      Object.assign(old, { name: p.name, avatar: p.avatar, bed: p.bed, fishing: p.fishing, bob: p.bob })
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
          setCount(m.players.length)
          setStatus('ready')
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
            p.walkUntil = now + 260
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
      // 1인칭: 몸은 늘 보는 쪽을 향함 (던지는 방향 = 보는 방향)
      if (cam.first && me.bed === null) me.r = me.sr = cam.yaw + Math.PI
      if (mag > 0.15) {
        const speed = WALK_SPEED * mag
        const dx = (ix / (Math.hypot(ix, iy) || 1)) * speed * dt
        const dz = (iy / (Math.hypot(ix, iy) || 1)) * speed * dt
        const p = moveBy(me.x, me.z, dx, dz)
        me.x = me.sx = p.x
        me.z = me.sz = p.z
        if (!cam.first) me.r = me.sr = Math.atan2(ix, iy)
        me.walkUntil = now + 120
        // 움직이면 일어나고 낚싯대를 거둠 (서버도 같은 판단)
        if (me.bed !== null || me.fishing !== 'none') {
          me.bed = null
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

  /** 뿅망치 (F) — 내 화면은 바로 휘두르고, 맞았는지는 서버가 알려 줌 */
  const bonk = useCallback(() => {
    const me = world.players.get(world.me)
    if (!me || performance.now() - me.bonkAt < 700) return
    me.bonkAt = performance.now()
    send({ t: 'bonk' })
  }, [send, world])

  return { status, error, roomLabel, count, profile, saving, chat, toasts, myCatch, setMyCatch, tankView, setTankView, action, act, bonk, step, send, world }
}

const round = (v: number) => Math.round(v * 100) / 100
/** 가까운 빈 썬베드 (다른 사람이 누워 있으면 없음) */
function freeBed(world: World, me: Shown): number | null {
  const i = nearBed(me.x, me.z)
  if (i === null || !BEDS[i]) return null
  for (const p of world.players.values()) if (p.id !== me.id && p.bed === i) return null
  return i
}
const canCast = (p: { x: number; z: number; r: number }) => !!(castTarget(p.x, p.z, p.r) ?? castTarget(p.x, p.z, p.r + Math.PI))
export const iroName = (c: Catch) => (c.iro ? `${{ silver: '은빛', sakura: '벚꽃', gold: '금빛', neon: '형광', obsidian: '흑요석', ghost: '유령', rainbow: '무지개' }[c.iro]} ` : '')
