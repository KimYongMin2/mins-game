import { useEffect, useRef, useState } from 'react'
import { REFEREE_FROM } from '../../../shared/online/hubProtocol'
import type { Member, Room } from '../../../shared/online/room'
import { loadNickname } from '../../../shared/storage/nickname'
import { type TeamPick, assignTeams, teamsReady } from '../../../shared/team/teams'
import { BotDriver, type BotLevel } from '../bot/islandBot'
import { H, HP, TEAM_SIZE, W, WEAPONS, type WeaponId, weaponOf } from '../constants'
import { FAR, MINI, Renderer, TEAM_COLOR, VH, VW, type Cam } from '../field/renderer'
import { type IslandMsg, type RosterPlayer, type Snap, applySnap } from '../play/net'
import { type Keys, type Team, World, chargePower } from '../play/world'
import type { GameSummary } from '../records'
import { type SoundName, playSound } from '../sounds'

type Props =
  | { mode: 'bot' | 'local'; level: BotLevel; onFinish: (s: GameSummary) => void }
  | { mode: 'pvp'; level: BotLevel; room: Room<IslandMsg>; members: Member[]; bots: number; teams: TeamPick | null; onFinish: (s: GameSummary) => void }

type Hud = { live: boolean; sec: number; hp: number[]; weapon: WeaponId; team: Team; canAct: boolean; far: boolean; ctlName: string; names: string[] }

const KEYMAP: Record<string, keyof Keys> = { ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right', ArrowUp: 'up', KeyW: 'up', ArrowDown: 'down', KeyS: 'down' }
const FX_SOUND: Partial<Record<string, SoundName>> = { bounce: 'bounce', land: 'land', boing: 'boing', whiff: 'whiff', turn: 'turn', throw: 'throw', reel: 'reel', gull: 'gull', jump: 'jump', dig: 'dig', splash: 'splash', hurt: 'ouch' }
const STEP = 1000 / 60

export function GameScreen(props: Props) {
  const { mode, level } = props
  const pvp = props.mode === 'pvp'
  const room = props.mode === 'pvp' ? props.room : null
  const [serverOk] = useState(() => !pvp || !!room?.hasReferee?.('island'))
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const worldRef = useRef<World | null>(null)
  const keys = useRef<Keys>({ left: false, right: false, up: false, down: false })
  const cam = useRef<Cam>({ x: 0, y: 0, s: 1 })
  const userZoom = useRef(1)
  const [hud, setHud] = useState<Hud | null>(null)
  const finishRef = useRef(props.onFinish)
  useEffect(() => {
    finishRef.current = props.onFinish
  })

  // 친구 대전: 서버 상태
  const net = useRef<{ roster: RosterPlayer[]; cur: { s: Snap; at: number } | null; prev: { s: Snap; at: number } | null; applied: number; aim: number; charging: boolean; chargeT: number; aimSentAt: number; aimSent: number; turn: number }>({
    roster: [], cur: null, prev: null, applied: 0, aim: 40, charging: false, chargeT: 0, aimSentAt: 0, aimSent: 40, turn: -1,
  })
  const myId = room?.myId ?? ''
  /** 방장이 심판을 한 번만 세우게 (개발 모드는 effect가 두 번 돌아 섬이 둘 생겼었음) */
  const refereeStarted = useRef(false)
  const send = (m: IslandMsg) => room?.send(m)

  /** 지금 내가 조작할 차례인지 */
  const human = (w: World) => {
    if (mode === 'local') return true
    if (mode === 'bot') return w.team === 0
    return net.current.cur?.s.ctl === myId && !!myId
  }

  // 카메라: 내가 걷거나 끌 때만 움직이고, 차례·던지기 때는 한 번에 바뀜 (멀미 — 저절로 미끄러지지 않게)
  const clampCam = () => {
    const c = cam.current
    c.x = Math.max(0, Math.min(W - VW / c.s, c.x))
    c.y = Math.max(0, Math.min(H - VH / c.s, c.y))
  }
  const isFar = () => cam.current.s <= FAR + 0.01
  const setNear = (w: World) => {
    const c = cam.current
    c.s = userZoom.current
    c.x = w.active.x - VW / 2 / c.s
    c.y = w.active.y - (VH * 0.6) / c.s
    clampCam()
  }
  const setFar = () => {
    cam.current.s = FAR
    cam.current.x = 0
    cam.current.y = 0
  }
  const zoomAt = (px: number, py: number, s: number) => {
    const c = cam.current
    const wx = c.x + px / c.s
    const wy = c.y + py / c.s
    c.s = Math.max(FAR, Math.min(1.8, s))
    c.x = wx - px / c.s
    c.y = wy - py / c.s
    clampCam()
    if (!isFar()) userZoom.current = c.s
  }

  // 행동 (혼자는 엔진에 바로, 친구 대전은 서버로)
  const act = {
    press() {
      const w = worldRef.current
      if (!w || !human(w) || !w.canAct()) return
      if (!pvp) return w.press()
      const n = net.current
      if (weaponOf(w.weapon).charge) {
        n.charging = true
        n.chargeT = 0
      }
      send({ t: 'aim', a: n.aim })
      send({ t: 'press' })
    },
    release() {
      const w = worldRef.current
      if (!w) return
      if (!pvp) return w.release()
      const n = net.current
      if (!n.charging) return
      n.charging = false
      send({ t: 'release', p: chargePower(n.chargeT) })
    },
    jump() {
      const w = worldRef.current
      if (!w || !human(w)) return
      if (pvp) send({ t: 'jump' })
      else w.jump()
    },
    pick(id: WeaponId) {
      const w = worldRef.current
      if (!w || !human(w) || !w.canAct()) return
      const was = w.weapon
      if (pvp) {
        if (net.current.charging) return
        send({ t: 'pick', w: id })
        w.weapon = id
      } else w.pick(id)
      if (id === 'gull' && was !== 'gull') setFar()
      else if (was === 'gull' && id !== 'gull') setNear(w)
    },
    target(x: number) {
      const w = worldRef.current
      if (!w) return
      if (pvp) {
        send({ t: 'target', x: Math.round(x) })
        w.target = x
      } else w.setTarget(x)
    },
  }

  useEffect(() => {
    if (!serverOk) return
    const canvas = canvasRef.current!
    const dpr = Math.min(2, window.devicePixelRatio || 1)
    canvas.width = Math.round(VW * dpr)
    canvas.height = Math.round(VH * dpr)
    const ctx = canvas.getContext('2d')!
    let r: Renderer | null = null
    let bot: BotDriver | null = null
    let cleanupNet = () => {}
    let seedNow = -1
    worldRef.current = null

    const begin = (w: World) => {
      worldRef.current = w
      r = new Renderer(w, dpr)
    }

    if (!pvp) {
      const seed = (Math.random() * 2 ** 31) | 0
      begin(new World(seed))
      if (mode === 'bot') bot = new BotDriver(level, seed + 1)
    } else if (room) {
      // 방장: 서버에 심판을 맡김 (사람은 두 팀에 번갈아, 빈자리 봇)
      if (props.mode === 'pvp' && room.role === 'host' && !refereeStarted.current) {
        refereeStarted.current = true
        const people = [{ id: room.myId, name: loadNickname() ?? '나' }, ...props.members.map((m) => ({ id: m.id, name: m.nickname }))]
        const bots = Array.from({ length: props.bots }, (_, i) => ({ id: `bot${i}`, name: `봇${i + 1}` }))
        const players = [...people, ...bots].slice(0, 4)
        // 팀전이면 대기실에서 고른 팀(빈 팀이 생기면 번갈아), 아니면 개인전
        let teams: number[] | null = null
        if (props.teams) {
          const t = assignTeams(players.map((p) => p.id), props.teams)
          teams = teamsReady(t) ? t : players.map((_, i) => i % 2)
        }
        room.startReferee?.('island', { players, teams })
      }
      const n = net.current
      const hello = setInterval(() => {
        if (!worldRef.current) send({ t: 'hello' })
      }, 1000)
      send({ t: 'hello' })
      const off = room.onMessage((msg, from) => {
        if (from !== REFEREE_FROM) return
        if (msg.t === 'init') {
          if (worldRef.current && msg.seed === seedNow) {
            // 놓친 파인 곳 다시 받기
            const w = worldRef.current
            for (let i = n.applied; i < msg.carves.length; i++) w.carve(...(msg.carves[i].slice(0, 3) as [number, number, number]), msg.carves[i][3] === 1)
            n.applied = Math.max(n.applied, msg.carves.length)
            return
          }
          // 처음이거나 심판이 새로 섰으면(씨앗값이 다르면) 섬을 새로 만듦
          const w = new World(msg.seed, msg.sides)
          for (const c of msg.carves) w.carve(c[0], c[1], c[2], c[3] === 1)
          w.carves.length = 0
          w.fx.length = 0
          seedNow = msg.seed
          n.applied = msg.carves.length
          n.roster = msg.players
          n.cur = null
          n.prev = null
          begin(w)
        } else if (msg.t === 'snap') {
          const w = worldRef.current
          if (!w) return
          if (msg.sd !== undefined && msg.sd !== seedNow) {
            send({ t: 'hello' })
            return
          }
          if (msg.cs > n.applied) send({ t: 'hello' })
          else
            for (let i = n.applied - msg.cs; i < msg.c.length; i++) {
              const c = msg.c[i]
              w.carve(c[0], c[1], c[2], c[3] === 1)
              n.applied++
            }
          w.fx.push(...msg.fx)
          n.prev = n.cur
          n.cur = { s: msg, at: performance.now() }
        }
      })
      cleanupNet = () => {
        clearInterval(hello)
        off()
      }
    }

    let lastTurn = -1
    let lastPhase = ''
    let lastHud = ''
    let doneAt = 0
    let raf = 0
    let last = performance.now()
    let acc = 0
    let keysSent = ''
    let keysSentAt = 0

    const follow = (w: World) => {
      if (isFar()) return
      const c = cam.current
      const a = w.active
      const sx = (a.x - c.x) * c.s
      const sy = (a.y - c.y) * c.s
      if (sx < VW * 0.3) c.x = a.x - (VW * 0.3) / c.s
      if (sx > VW * 0.7) c.x = a.x - (VW * 0.7) / c.s
      if (sy < VH * 0.35) c.y = a.y - (VH * 0.35) / c.s
      if (sy > VH * 0.78) c.y = a.y - (VH * 0.78) / c.s
      clampCam()
    }

    /** 친구 대전 한 스텝: 내 조준·힘은 내 폰에서 */
    const netStep = (w: World) => {
      const n = net.current
      const mine = human(w)
      const k = keys.current
      if (mine && w.canAct()) {
        if (k.up) n.aim = Math.min(88, n.aim + 1.2)
        if (k.down) n.aim = Math.max(-60, n.aim - 1.2)
        if (n.charging) n.chargeT++
      }
    }

    const netFrame = (w: World, now: number) => {
      const n = net.current
      if (!n.cur) return
      const span = n.prev ? Math.max(16, n.cur.at - n.prev.at) : 33
      const k = n.prev ? Math.min(1, (now - n.cur.at) / span) : 1
      applySnap(w, n.cur.s, n.prev?.s ?? null, k)
      if (n.cur.s.n !== n.turn) {
        n.turn = n.cur.s.n
        n.aim = n.cur.s.aim
        n.aimSent = n.aim
        n.charging = false
      }
      const mine = human(w)
      if (mine && w.canAct()) {
        w.aim = n.aim
        if (n.charging) {
          w.charging = true
          w.chargeT = n.chargeT
        }
        if (Math.abs(n.aim - n.aimSent) > 0.05 && now - n.aimSentAt > 66) {
          send({ t: 'aim', a: Math.round(n.aim * 10) / 10 })
          n.aimSent = n.aim
          n.aimSentAt = now
        }
        const kk = keys.current
        const ks = `${kk.left ? 1 : 0}${kk.right ? 1 : 0}`
        if (ks !== keysSent || (ks !== '00' && now - keysSentAt > 400)) {
          send({ t: 'keys', l: kk.left, r: kk.right })
          keysSent = ks
          keysSentAt = now
        }
      } else if (keysSent !== '00') {
        keysSent = '00'
      }
    }

    const step = (w: World) => {
      if (pvp) return netStep(w)
      if (bot && w.team === 1) bot.step(w)
      w.step(human(w) ? keys.current : { left: false, right: false, up: false, down: false })
    }

    const loop = (now: number) => {
      const w = worldRef.current
      if (w && r) {
        acc += Math.min(100, now - last)
        last = now
        while (acc >= STEP) {
          step(w)
          acc -= STEP
        }
        if (pvp) netFrame(w, now)
        if (w.turnNo !== lastTurn) {
          lastTurn = w.turnNo
          if (w.weapon === 'gull' && human(w)) setFar()
          else setNear(w)
        }
        if (w.phase !== lastPhase) {
          if (lastPhase === 'aim' && (w.phase === 'flying' || w.phase === 'over') && (w.projs.length || w.gull)) setFar()
          lastPhase = w.phase
        }
        const k = keys.current
        if (human(w) && (((k.left || k.right) && w.weapon !== 'gull') || w.phase === 'reel' || w.phase === 'dig')) follow(w)

        for (const f of r.absorb(w)) {
          if (f.t === 'boom') playSound(f.r > 50 ? 'bigBoom' : f.r > 30 ? 'boom' : 'pop')
          else if (f.t === 'win') playSound(winOf(w) === 'lose' ? 'lose' : 'win')
          else {
            const s = FX_SOUND[f.t]
            if (s) playSound(s)
          }
        }
        const names = teamNames()
        const ctlName = pvp ? (net.current.roster.find((p) => p.id === net.current.cur?.s.ctl)?.name ?? names[w.team]) : names[w.team]
        const label = [...names]
        label[w.team] = ctlName
        r.draw(ctx, w, cam.current, { showMini: !isFar(), names: label, myTurn: human(w) })
        const hp = Array.from({ length: w.sides }, (_, t) => w.alive(t).reduce((s, a) => s + a.hp, 0))
        const next: Hud = { live: w.canAct(), sec: Math.ceil(w.timer / 60), hp, weapon: w.weapon, team: w.team, canAct: w.canAct() && human(w), far: isFar(), ctlName, names }
        const key = JSON.stringify(next)
        if (key !== lastHud) {
          lastHud = key
          setHud(next)
        }
        if (w.winner !== null && !doneAt) doneAt = now
        if (doneAt && now - doneAt > 2200) {
          finishRef.current(summaryOf(w))
          return
        }
      } else last = now
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => {
      cancelAnimationFrame(raf)
      cleanupNet()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serverOk])

  /** 내 팀 (봇 연습은 파랑 = 나, 둘이서는 없음) */
  const myTeam = (): Team | null => (mode === 'bot' ? 0 : pvp ? (net.current.roster.find((p) => p.id === myId)?.team ?? null) : null)
  const winOf = (w: World): 'win' | 'lose' | 'draw' | 'none' => {
    const t = myTeam()
    if (w.winner === 'draw') return 'draw'
    if (t === null || w.winner === null) return 'none'
    return w.winner === t ? 'win' : 'lose'
  }
  function teamNames(): string[] {
    if (mode === 'bot') return ['나', '봇']
    if (mode === 'local') return ['파랑 팀', '빨강 팀']
    const r = net.current.roster
    const sides = worldRef.current?.sides ?? 2
    const of = (t: Team) => r.filter((p) => p.team === t).map((p) => (p.id === myId ? `${p.name}(나)` : p.name)).join('·') || `${t + 1}편`
    return Array.from({ length: sides }, (_, t) => of(t))
  }
  function summaryOf(w: World): GameSummary {
    return {
      mode,
      level,
      winner: w.winner ?? 'draw',
      myTeam: myTeam() ?? 0,
      left: Array.from({ length: w.sides }, (_, t) => w.alive(t).length),
      turns: w.turnNo,
      names: teamNames(),
      ffa: pvp && net.current.roster.length === w.sides,
    }
  }

  // 키보드
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      const w = worldRef.current
      if (!w) return
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
      const k = KEYMAP[e.code]
      if (k) {
        keys.current[k] = true
        e.preventDefault()
      }
      if (e.code === 'Tab') {
        e.preventDefault()
        toggleView()
        return
      }
      if (!human(w)) return
      if (e.code === 'Space') {
        e.preventDefault()
        if (!e.repeat) act.press()
      } else if (e.code === 'Enter') {
        e.preventDefault()
        act.jump()
      } else if (/^Digit[1-6]$/.test(e.code)) act.pick(WEAPONS[Number(e.code.slice(5)) - 1].id)
    }
    const up = (e: KeyboardEvent) => {
      const k = KEYMAP[e.code]
      if (k) keys.current[k] = false
      if (e.code === 'Space') act.release()
    }
    const blur = () => {
      keys.current = { left: false, right: false, up: false, down: false }
    }
    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    window.addEventListener('blur', blur)
    return () => {
      window.removeEventListener('keydown', down)
      window.removeEventListener('keyup', up)
      window.removeEventListener('blur', blur)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function toggleView() {
    const w = worldRef.current
    if (!w) return
    if (isFar()) setNear(w)
    else setFar()
  }

  // 화면 누르기: 한 손가락 끌기 = 둘러보기, 작은 지도 = 네모 옮기기, 두 손가락 = 크기, 그냥 누르기 = 갈매기 목표
  const ptrs = useRef(new Map<number, [number, number]>())
  const drag = useRef<{ mini: boolean; x: number; y: number; cx: number; cy: number; moved: boolean } | null>(null)
  const pinch = useRef<{ d: number; s: number; wx: number; wy: number } | null>(null)
  const canvasPt = (e: { clientX: number; clientY: number }): [number, number] => {
    const rc = canvasRef.current!.getBoundingClientRect()
    return [((e.clientX - rc.left) / rc.width) * VW, ((e.clientY - rc.top) / rc.height) * VH]
  }
  const inMini = (px: number, py: number) => !isFar() && px >= MINI.x - 6 && px <= MINI.x + MINI.w + 6 && py >= MINI.y - 6 && py <= MINI.y + MINI.h + 6
  const camToMini = (px: number, py: number) => {
    const c = cam.current
    c.x = ((px - MINI.x) / MINI.w) * W - VW / 2 / c.s
    c.y = ((py - MINI.y) / MINI.h) * H - VH / 2 / c.s
    clampCam()
  }

  useEffect(() => {
    const cv = canvasRef.current
    if (!cv) return
    const wheel = (e: WheelEvent) => {
      e.preventDefault()
      const [px, py] = canvasPt(e)
      const pan = !e.ctrlKey && (Math.abs(e.deltaX) > 0.5 || (e.deltaMode === 0 && Math.abs(e.deltaY) < 40))
      if (pan) {
        cam.current.x += e.deltaX / cam.current.s
        cam.current.y += e.deltaY / cam.current.s
        clampCam()
        return
      }
      const dy = e.deltaMode === 1 ? e.deltaY * 33 : e.deltaY
      zoomAt(px, py, cam.current.s * Math.exp(-dy * (e.ctrlKey ? 0.01 : 0.0015)))
    }
    let gestureS = 1
    const gs = (e: Event) => {
      e.preventDefault()
      gestureS = cam.current.s
    }
    const gc = (e: Event) => {
      e.preventDefault()
      zoomAt(VW / 2, VH / 2, gestureS * ((e as unknown as { scale: number }).scale ?? 1))
    }
    cv.addEventListener('wheel', wheel, { passive: false })
    cv.addEventListener('gesturestart', gs)
    cv.addEventListener('gesturechange', gc)
    return () => {
      cv.removeEventListener('wheel', wheel)
      cv.removeEventListener('gesturestart', gs)
      cv.removeEventListener('gesturechange', gc)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serverOk])

  function onPointerDown(e: React.PointerEvent<HTMLCanvasElement>) {
    if (e.pointerType === 'mouse' && e.button !== 0) return
    e.currentTarget.setPointerCapture(e.pointerId)
    const [px, py] = canvasPt(e)
    ptrs.current.set(e.pointerId, [px, py])
    if (ptrs.current.size === 2) {
      const [a, b] = [...ptrs.current.values()]
      const mx = (a[0] + b[0]) / 2
      const my = (a[1] + b[1]) / 2
      const c = cam.current
      pinch.current = { d: Math.hypot(a[0] - b[0], a[1] - b[1]) || 1, s: c.s, wx: c.x + mx / c.s, wy: c.y + my / c.s }
      drag.current = null
      return
    }
    if (ptrs.current.size > 2) return
    if (inMini(px, py)) {
      drag.current = { mini: true, x: px, y: py, cx: 0, cy: 0, moved: true }
      camToMini(px, py)
      return
    }
    drag.current = { mini: false, x: px, y: py, cx: cam.current.x, cy: cam.current.y, moved: false }
  }

  function onPointerMove(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!ptrs.current.has(e.pointerId)) return
    const [px, py] = canvasPt(e)
    ptrs.current.set(e.pointerId, [px, py])
    const pc = pinch.current
    if (pc && ptrs.current.size >= 2) {
      const [a, b] = [...ptrs.current.values()]
      const mx = (a[0] + b[0]) / 2
      const my = (a[1] + b[1]) / 2
      const c = cam.current
      c.s = Math.max(FAR, Math.min(1.8, (pc.s * (Math.hypot(a[0] - b[0], a[1] - b[1]) || 1)) / pc.d))
      c.x = pc.wx - mx / c.s
      c.y = pc.wy - my / c.s
      clampCam()
      if (!isFar()) userZoom.current = c.s
      return
    }
    const d = drag.current
    if (!d) return
    if (d.mini) {
      camToMini(px, py)
      return
    }
    const dx = px - d.x
    const dy = py - d.y
    if (!d.moved && Math.hypot(dx, dy) > 10) d.moved = true
    if (d.moved) {
      cam.current.x = d.cx - dx / cam.current.s
      cam.current.y = d.cy - dy / cam.current.s
      clampCam()
    }
  }

  function onPointerEnd(e: React.PointerEvent<HTMLCanvasElement>) {
    ptrs.current.delete(e.pointerId)
    if (pinch.current) {
      if (ptrs.current.size < 2) pinch.current = null
      drag.current = null
      return
    }
    const d = drag.current
    const w = worldRef.current
    if (d && !d.mini && !d.moved && e.type === 'pointerup' && w && human(w) && w.canAct() && w.weapon === 'gull') {
      const [px] = canvasPt(e)
      act.target(cam.current.x + px / cam.current.s)
    }
    drag.current = null
  }

  const hold = (k: keyof Keys) => ({
    onPointerDown: (e: React.PointerEvent<HTMLButtonElement>) => {
      if (e.pointerType === 'mouse' && e.button !== 0) return
      e.preventDefault()
      try {
        e.currentTarget.setPointerCapture(e.pointerId)
      } catch {
        /* 이미 뗀 손가락 */
      }
      keys.current[k] = true
    },
    onPointerUp: () => {
      keys.current[k] = false
    },
    onPointerCancel: () => {
      keys.current[k] = false
    },
    onLostPointerCapture: () => {
      keys.current[k] = false
    },
  })

  if (!serverOk) return <p className="il-notice">게임 서버를 준비하는 중이에요. 잠시 뒤 다시 시작해 주세요.</p>

  const total = HP * TEAM_SIZE
  const wInfo = weaponOf(hud?.weapon ?? 'balloon')
  const names = hud?.names ?? ['', '']
  const waiting = pvp && !hud
  const half = Math.ceil(names.length / 2)
  const sideBar = (t: number) => (
    <div key={t} className={`il-team${t >= half ? ' il-team--r' : ''}${hud?.live && hud.team === t ? ' il-team--turn' : ''}`}>
      <b style={{ color: TEAM_COLOR[t] }}>{names[t]}</b>
      <div className="il-bar">
        <i style={{ width: `${((hud?.hp[t] ?? total) / total) * 100}%`, background: TEAM_COLOR[t] }} />
      </div>
    </div>
  )
  return (
    <div className="il-game" onContextMenu={(e) => e.preventDefault()}>
      <div className="il-teams">
        <div className="il-side">{names.slice(0, half).map((_, t) => sideBar(t))}</div>
        <div className={`il-turn${hud?.live && hud.sec <= 5 ? ' il-turn--low' : ''}`}>{hud?.live ? hud.sec : '·'}</div>
        <div className="il-side">{names.slice(half).map((_, i) => sideBar(half + i))}</div>
      </div>

      <div className="il-stage">
        <canvas ref={canvasRef} className="il-canvas" aria-label="섬 경기 장면" onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerEnd} onPointerCancel={onPointerEnd} />
        {waiting && <div className="il-wait">섬을 불러오는 중…</div>}
        {hud && !hud.canAct && pvp && !waiting && <div className="il-whose">{hud.ctlName} 차례</div>}
        <div className="il-zoom">
          <button type="button" className="button button--small" aria-label="멀리 보기" onClick={() => zoomAt(VW / 2, VH / 2, cam.current.s / 1.25)}>
            −
          </button>
          <button type="button" className="button button--small" aria-label="가까이 보기" onClick={() => zoomAt(VW / 2, VH / 2, cam.current.s * 1.25)}>
            +
          </button>
          <button type="button" className="button button--small" onClick={toggleView}>
            {hud?.far ? '가까이' : '전체'}
          </button>
        </div>
      </div>

      <div className="il-weapons" role="group" aria-label="무기">
        {WEAPONS.map((wp, i) => (
          <button key={wp.id} type="button" className="button il-wp" aria-pressed={hud?.weapon === wp.id} disabled={!hud?.canAct} title={wp.desc} onClick={() => act.pick(wp.id)}>
            <kbd>{i + 1}</kbd>
            {wp.name}
            <small>{wp.sub}</small>
          </button>
        ))}
      </div>

      <div className="il-move">
        <button type="button" className="button" aria-label="왼쪽으로" disabled={!hud?.canAct} {...hold('left')}>
          ◀
        </button>
        <button type="button" className="button" aria-label="오른쪽으로" disabled={!hud?.canAct} {...hold('right')}>
          ▶
        </button>
        <button type="button" className="button" disabled={!hud?.canAct} onPointerDown={() => act.jump()}>
          점프
        </button>
      </div>
      <div className="il-act">
        <button type="button" className="button" aria-label="조준 위로" disabled={!hud?.canAct} {...hold('up')}>
          조준 ▲
        </button>
        <button type="button" className="button" aria-label="조준 아래로" disabled={!hud?.canAct} {...hold('down')}>
          조준 ▼
        </button>
        <button
          type="button"
          className="button button--primary il-fire"
          disabled={!hud?.canAct}
          onPointerDown={(e) => {
            if (e.pointerType === 'mouse' && e.button !== 0) return
            e.preventDefault()
            try {
              e.currentTarget.setPointerCapture(e.pointerId)
            } catch {
              /* 이미 뗀 손가락 */
            }
            act.press()
          }}
          onPointerUp={() => act.release()}
          onPointerCancel={() => act.release()}
        >
          {wInfo.action}
        </button>
      </div>
      <p className="il-help">PC: ←→ 걷기 · ↑↓ 조준 · Enter 점프 · 1~6 무기 · Space 꾹 눌렀다 떼기 · Tab 전체 보기 · 휠·두 손가락으로 크기 · 화면이나 위 작은 지도 네모를 끌어 둘러보기</p>
    </div>
  )
}
