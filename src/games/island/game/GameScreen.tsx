import { useEffect, useRef, useState } from 'react'
import { BotDriver, type BotLevel } from '../bot/islandBot'
import { H, HP, TEAM_SIZE, W, WEAPONS, type WeaponId, weaponOf } from '../constants'
import { FAR, MINI, Renderer, VH, VW, type Cam } from '../field/renderer'
import { type Keys, World } from '../play/world'
import type { GameSummary } from '../records'
import { type SoundName, playSound } from '../sounds'

type Props = {
  mode: 'bot' | 'local'
  level: BotLevel
  onFinish: (s: GameSummary) => void
}

type Hud = { sec: number; hp: [number, number]; weapon: WeaponId; team: 0 | 1; canAct: boolean; far: boolean }

const KEYMAP: Record<string, keyof Keys> = { ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right', ArrowUp: 'up', KeyW: 'up', ArrowDown: 'down', KeyS: 'down' }
const FX_SOUND: Partial<Record<string, SoundName>> = { bounce: 'bounce', land: 'land', boing: 'boing', whiff: 'whiff', turn: 'turn', throw: 'throw', reel: 'reel', gull: 'gull', jump: 'jump', dig: 'dig', splash: 'splash', hurt: 'ouch' }

export function GameScreen({ mode, level, onFinish }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const worldRef = useRef<World | null>(null)
  const keys = useRef<Keys>({ left: false, right: false, up: false, down: false })
  const cam = useRef<Cam>({ x: 0, y: 0, s: 1 })
  const userZoom = useRef(1)
  const [hud, setHud] = useState<Hud | null>(null)
  const finishRef = useRef(onFinish)
  useEffect(() => {
    finishRef.current = onFinish
  })

  const names: readonly [string, string] = mode === 'bot' ? ['나', '봇'] : ['파랑 팀', '빨강 팀']
  const human = (w: World) => mode === 'local' || w.team === 0

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

  useEffect(() => {
    const canvas = canvasRef.current!
    const dpr = Math.min(2, window.devicePixelRatio || 1)
    canvas.width = Math.round(VW * dpr)
    canvas.height = Math.round(VH * dpr)
    const ctx = canvas.getContext('2d')!
    const seed = (Math.random() * 2 ** 31) | 0
    const w = new World(seed)
    worldRef.current = w
    const r = new Renderer(w, dpr)
    const bot = mode === 'bot' ? new BotDriver(level, seed + 1) : null
    let lastTurn = -1
    let lastPhase = w.phase
    let lastHud = ''
    let doneAt = 0
    let raf = 0
    let last = performance.now()
    let acc = 0

    const follow = () => {
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

    const tick = () => {
      if (bot && w.team === 1) bot.step(w)
      const k = human(w) ? keys.current : { left: false, right: false, up: false, down: false }
      w.step(k)
      if (w.turnNo !== lastTurn) {
        lastTurn = w.turnNo
        if (w.weapon === 'gull') setFar()
        else setNear(w)
      }
      if (w.phase !== lastPhase) {
        if (lastPhase === 'aim' && (w.phase === 'flying' || w.phase === 'over') && (w.projs.length || w.gull)) setFar()
        lastPhase = w.phase
      }
      if (human(w) && (k.left || k.right) && w.weapon !== 'gull') follow()
      if (w.phase === 'reel' || w.phase === 'dig') {
        if (human(w)) follow()
      }
    }

    const loop = (now: number) => {
      acc += Math.min(100, now - last)
      last = now
      while (acc >= 1000 / 60) {
        tick()
        acc -= 1000 / 60
      }
      for (const f of r.absorb(w)) {
        if (f.t === 'boom') playSound(f.r > 50 ? 'bigBoom' : f.r > 30 ? 'boom' : 'pop')
        else if (f.t === 'win') playSound(mode === 'bot' && w.winner === 1 ? 'lose' : 'win')
        else {
          const s = FX_SOUND[f.t]
          if (s) playSound(s)
        }
      }
      r.draw(ctx, w, cam.current, { showMini: !isFar(), names, myTurn: human(w) })
      const hp: [number, number] = [0, 1].map((t) => w.alive(t as 0 | 1).reduce((s, a) => s + a.hp, 0)) as [number, number]
      const next: Hud = { sec: Math.ceil(w.timer / 60), hp, weapon: w.weapon, team: w.team, canAct: w.canAct() && human(w), far: isFar() }
      const key = JSON.stringify(next)
      if (key !== lastHud) {
        lastHud = key
        setHud(next)
      }
      if (w.winner && !doneAt) doneAt = now
      if (doneAt && now - doneAt > 2200) {
        finishRef.current({ mode, level, winner: w.winner!, left: [w.alive(0).length, w.alive(1).length], turns: w.turnNo })
        return
      }
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

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
      if (!human(w)) return
      if (e.code === 'Space') {
        e.preventDefault()
        if (!e.repeat) press(w)
      } else if (e.code === 'Enter') {
        e.preventDefault()
        w.jump()
      } else if (e.code === 'Tab') {
        e.preventDefault()
        toggleView()
      } else if (/^Digit[1-6]$/.test(e.code)) pick(WEAPONS[Number(e.code.slice(5)) - 1].id)
    }
    const up = (e: KeyboardEvent) => {
      const k = KEYMAP[e.code]
      if (k) keys.current[k] = false
      if (e.code === 'Space') worldRef.current?.release()
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

  const press = (w: World) => w.press()

  function pick(id: WeaponId) {
    const w = worldRef.current
    if (!w || !human(w)) return
    const was = w.weapon
    w.pick(id)
    if (w.weapon === 'gull' && was !== 'gull') setFar()
    else if (was === 'gull' && w.weapon !== 'gull') setNear(w)
  }

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
    const r = canvasRef.current!.getBoundingClientRect()
    return [((e.clientX - r.left) / r.width) * VW, ((e.clientY - r.top) / r.height) * VH]
  }
  const inMini = (px: number, py: number) => !isFar() && px >= MINI.x - 6 && px <= MINI.x + MINI.w + 6 && py >= MINI.y - 6 && py <= MINI.y + MINI.h + 6
  const camToMini = (px: number, py: number) => {
    const c = cam.current
    c.x = ((px - MINI.x) / MINI.w) * W - VW / 2 / c.s
    c.y = ((py - MINI.y) / MINI.h) * H - VH / 2 / c.s
    clampCam()
  }

  useEffect(() => {
    const cv = canvasRef.current!
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
  }, [])

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
      w.setTarget(cam.current.x + px / cam.current.s)
    }
    drag.current = null
  }

  const hold = (k: keyof Keys) => ({
    onPointerDown: (e: React.PointerEvent<HTMLButtonElement>) => {
      if (e.pointerType === 'mouse' && e.button !== 0) return
      e.preventDefault()
      e.currentTarget.setPointerCapture(e.pointerId)
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

  const total = HP * TEAM_SIZE
  const wInfo = weaponOf(hud?.weapon ?? 'balloon')
  return (
    <div className="il-game" onContextMenu={(e) => e.preventDefault()}>
      <div className="il-teams">
        <div className="il-team il-team--b">
          <b>{names[0]}</b>
          <div className="il-bar">
            <i style={{ width: `${((hud?.hp[0] ?? total) / total) * 100}%` }} />
          </div>
        </div>
        <div className={`il-turn${hud && hud.canAct && hud.sec <= 5 ? ' il-turn--low' : ''}`}>{hud && hud.canAct ? hud.sec : hud && hud.team === 1 && mode === 'bot' ? '봇' : '·'}</div>
        <div className="il-team il-team--r">
          <b>{names[1]}</b>
          <div className="il-bar">
            <i style={{ width: `${((hud?.hp[1] ?? total) / total) * 100}%` }} />
          </div>
        </div>
      </div>

      <div className="il-stage">
        <canvas
          ref={canvasRef}
          className="il-canvas"
          aria-label="섬 경기 장면"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerEnd}
          onPointerCancel={onPointerEnd}
        />
        <div className="il-zoom">
          <button type="button" className="button button--small" aria-label="멀리 보기" onClick={() => zoomAt(VW / 2, VH / 2, cam.current.s / 1.25)}>
            −
          </button>
          <button type="button" className="button button--small" aria-label="가까이 보기" onClick={() => zoomAt(VW / 2, VH / 2, cam.current.s * 1.25)}>
            +
          </button>
          <button type="button" className="button button--small" onClick={toggleView}>
            {hud?.far ? '가까이' : '전체 보기'}
          </button>
        </div>
      </div>

      <div className="il-weapons" role="group" aria-label="무기">
        {WEAPONS.map((wp, i) => (
          <button
            key={wp.id}
            type="button"
            className="button il-wp"
            aria-pressed={hud?.weapon === wp.id}
            disabled={!hud?.canAct}
            title={wp.desc}
            onClick={() => pick(wp.id)}
          >
            <kbd>{i + 1}</kbd>
            {wp.name}
            <small>{wp.sub}</small>
          </button>
        ))}
      </div>

      <div className="il-pad">
        <button type="button" className="button" aria-label="왼쪽으로" disabled={!hud?.canAct} {...hold('left')}>
          ◀
        </button>
        <button type="button" className="button" aria-label="오른쪽으로" disabled={!hud?.canAct} {...hold('right')}>
          ▶
        </button>
        <button type="button" className="button" disabled={!hud?.canAct} onPointerDown={() => worldRef.current?.jump()}>
          점프
        </button>
        <span className="il-pad__sp" />
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
            e.currentTarget.setPointerCapture(e.pointerId)
            const w = worldRef.current
            if (w) press(w)
          }}
          onPointerUp={() => worldRef.current?.release()}
          onPointerCancel={() => worldRef.current?.release()}
        >
          {wInfo.action}
        </button>
      </div>
      <p className="il-help">
        PC: ←→ 걷기 · ↑↓ 조준 · Enter 점프 · 1~6 무기 · Space 꾹 눌렀다 떼기 · Tab 전체 보기 · 휠·두 손가락으로 크기 · 화면이나 위 작은 지도 네모를 끌어 둘러보기
      </p>
    </div>
  )
}
