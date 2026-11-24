import { H, PINE_FUSE, W, WATER, weaponOf } from '../constants'
import { type Animal, type AnimalKind, type Fx, type World, chargePower } from '../play/world'

// 섬 그리기 (canvas 2D). 카메라는 내가 걷거나 끌 때만 움직이고(멀미), 흔들림은 없음.

export const VW = 960
export const VH = 540
export const FAR = Math.min(VW / W, VH / H)
export const SC = 1.5
export const MINI = { w: 240, h: 135, x: VW / 2 - 120, y: 10 }

export type Cam = { x: number; y: number; s: number }

const INK = '#1a1430'
export const TEAM_COLOR = ['#4aa3ff', '#ff5a5f'] as const
const KINDS: Record<AnimalKind, { fur: string; name: string }> = {
  bear: { fur: '#a8734a', name: '곰' },
  cat: { fur: '#f0b45a', name: '고양이' },
  rabbit: { fur: '#f3efe6', name: '토끼' },
  fox: { fur: '#ee7a32', name: '여우' },
  panda: { fur: '#f7f7f2', name: '판다' },
  frog: { fur: '#6cc04a', name: '개구리' },
}
export const kindName = (k: AnimalKind) => KINDS[k].name

type Part = { x: number; y: number; vx: number; vy: number; t: number; life: number; c: string; s: number }
type Ring = { x: number; y: number; r: number; t: number; water: boolean }
type Float = { x: number; y: number; text: string; c: string; t: number }

function hash(x: number, y: number) {
  let h = x * 374761393 + y * 668265263
  h = (h ^ (h >> 13)) * 1274126177
  return ((h ^ (h >> 16)) >>> 0) / 4294967295
}
const rnd = (a: number, b: number) => a + Math.random() * (b - a)

export class Renderer {
  readonly terr: HTMLCanvasElement
  private tctx: CanvasRenderingContext2D
  private hills: { x: number; w: number; h: number }[] = []
  private parts: Part[] = []
  private rings: Ring[] = []
  private floats: Float[] = []
  private trails = new Map<object, [number, number][]>()
  frame = 0
  /** 화면 배율 (레티나면 2) — 캔버스는 VW×VH × k 칸 */
  private k: number

  constructor(world: World, k = 1) {
    this.k = k
    this.terr = document.createElement('canvas')
    this.terr.width = W
    this.terr.height = H
    this.tctx = this.terr.getContext('2d')!
    this.paintTerrain(world.mask)
    for (let k = 0; k < 7; k++) this.hills.push({ x: hash(k, 3) * W * 1.3, w: 160 + hash(k, 5) * 160, h: 40 + hash(k, 7) * 70 })
  }

  private paintTerrain(mask: Uint8Array) {
    const img = this.tctx.createImageData(W, H)
    const d = img.data
    for (let x = 0; x < W; x++) {
      let depth = 0
      for (let y = 0; y < H; y++) {
        const i = y * W + x
        if (!mask[i]) {
          depth = 0
          continue
        }
        depth++
        const n = hash(x, y)
        let c: number[]
        if (depth < 5) c = n > 0.5 ? [112, 206, 98] : [96, 190, 88]
        else if (depth < 10) c = n > 0.6 ? [64, 150, 70] : [56, 138, 64]
        else if (depth < 14) c = [120, 88, 56]
        else {
          const band = Math.sin(y * 0.05 + Math.sin(x * 0.01) * 2) > 0.85
          c = n > 0.95 ? [118, 82, 52] : n < 0.04 ? [214, 172, 118] : band ? [160, 112, 70] : [178, 128, 80]
          if (depth > 90) c = c.map((v) => v * 0.8)
          if (depth > 200) c = c.map((v) => v * 0.85)
        }
        const o = i * 4
        d[o] = c[0]
        d[o + 1] = c[1]
        d[o + 2] = c[2]
        d[o + 3] = 255
      }
    }
    this.tctx.putImageData(img, 0, 0)
  }

  /** 엔진이 쌓아 둔 파인 곳·일을 그림에 옮긴다. 소리 낼 일은 돌려준다 */
  absorb(world: World): Fx[] {
    const t = this.tctx
    for (const c of world.carves) {
      t.save()
      t.globalCompositeOperation = 'destination-out'
      t.beginPath()
      t.arc(c.x, c.y, c.r, 0, Math.PI * 2)
      t.fill()
      if (c.ring) {
        t.globalCompositeOperation = 'source-atop'
        t.strokeStyle = 'rgba(70,40,20,.55)'
        t.lineWidth = 6
        t.beginPath()
        t.arc(c.x, c.y, c.r + 3, 0, Math.PI * 2)
        t.stroke()
      } else if (Math.random() < 0.5) {
        this.parts.push({ x: c.x + rnd(-8, 8), y: c.y + rnd(-8, 8), vx: rnd(-1.5, 1.5), vy: rnd(-2.5, -0.5), t: 0, life: rnd(25, 40), c: Math.random() < 0.5 ? '#a3713f' : '#7a5230', s: rnd(2, 4) })
      }
      t.restore()
    }
    world.carves.length = 0
    const fx = world.fx.splice(0)
    for (const f of fx) {
      if (f.t === 'boom') {
        this.rings.push({ x: f.x, y: f.y, r: f.r, t: 0, water: false })
        const n = Math.round(f.r * 0.8)
        for (let i = 0; i < n; i++) {
          const ang = rnd(0, Math.PI * 2)
          const sp = rnd(1.5, 5.5)
          this.parts.push({ x: f.x, y: f.y, vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp - 2, t: 0, life: rnd(30, 60), c: i % 3 ? '#9be7ff' : '#ffffff', s: rnd(3, 6) })
        }
        for (let i = 0; i < n / 2; i++) this.parts.push({ x: f.x, y: f.y, vx: rnd(-3.5, 3.5), vy: rnd(-5.5, -1), t: 0, life: rnd(45, 80), c: i % 2 ? '#a3713f' : '#6dbb5e', s: rnd(3, 5) })
      } else if (f.t === 'splash') {
        for (let i = 0; i < 26; i++) this.parts.push({ x: f.x + rnd(-8, 8), y: WATER, vx: rnd(-2.5, 2.5), vy: rnd(-7, -2), t: 0, life: rnd(35, 60), c: '#e6f8ff', s: rnd(3, 6) })
        this.rings.push({ x: f.x, y: WATER, r: 18, t: 0, water: true })
      } else if (f.t === 'hurt') this.floats.push({ x: f.x, y: f.y, text: `-${f.dmg}`, c: TEAM_COLOR[f.team], t: 0 })
      else if (f.t === 'say') this.floats.push({ x: f.x, y: f.y, text: f.text, c: f.color, t: 0 })
      else if (f.t === 'ko') for (let i = 0; i < 16; i++) this.parts.push({ x: f.x, y: f.y - 18, vx: rnd(-2.5, 2.5), vy: rnd(-4, 0), t: 0, life: 45, c: '#ffd23f', s: 4 })
    }
    return fx
  }

  private stepFx() {
    for (const p of this.parts) {
      p.t++
      p.vy += 0.15
      p.x += p.vx
      p.y += p.vy
      p.vx *= 0.99
    }
    this.parts = this.parts.filter((p) => p.t < p.life)
    for (const r of this.rings) r.t++
    this.rings = this.rings.filter((r) => r.t < 22)
    for (const f of this.floats) f.t++
    this.floats = this.floats.filter((f) => f.t < 80)
  }

  draw(ctx: CanvasRenderingContext2D, w: World, cam: Cam, opts: { showMini: boolean; names: readonly [string, string]; myTurn: boolean }) {
    this.frame++
    this.stepFx()
    const f = this.frame
    const k = this.k
    const clean = document.documentElement.dataset.capture === '1'
    ctx.setTransform(k, 0, 0, k, 0, 0)
    const sky = ctx.createLinearGradient(0, 0, 0, VH)
    sky.addColorStop(0, '#62bdec')
    sky.addColorStop(1, '#d3f0fb')
    ctx.fillStyle = sky
    ctx.fillRect(0, 0, VW, VH)
    ctx.fillStyle = 'rgba(255,255,255,.85)'
    for (const [cx, cy, s] of [
      [140, 70, 1],
      [520, 46, 0.8],
      [860, 100, 1.2],
      [1260, 60, 0.9],
    ]) {
      const span = VW + 300
      const x = ((((cx + f * 0.06 * s - cam.x * cam.s * 0.15) % span) + span) % span) - 150
      ctx.beginPath()
      ctx.ellipse(x, cy, 54 * s, 16 * s, 0, 0, Math.PI * 2)
      ctx.ellipse(x + 30 * s, cy - 12 * s, 30 * s, 16 * s, 0, 0, Math.PI * 2)
      ctx.fill()
    }
    const horizon = (WATER - cam.y) * cam.s
    ctx.fillStyle = '#86b9d4'
    for (const h of this.hills) {
      const x = (h.x - cam.x * 0.35) * cam.s * 0.7
      ctx.beginPath()
      ctx.ellipse(x, horizon - 30 * cam.s, h.w * cam.s, h.h * cam.s, 0, Math.PI, 0)
      ctx.fill()
    }

    ctx.setTransform(cam.s * k, 0, 0, cam.s * k, -cam.x * cam.s * k, -cam.y * cam.s * k)
    ctx.fillStyle = '#9fd0e6'
    ctx.fillRect(-1000, WATER - 30, W + 2000, 30)
    ctx.drawImage(this.terr, 0, 0)
    for (const a of w.animals) if (a.alive) this.drawAnimal(ctx, w, a)
    if (w.canAct() && !clean) this.drawAim(ctx, w, cam)
    if (w.rodLine) {
      const a = w.active
      ctx.strokeStyle = '#2b2440'
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.moveTo(a.x + a.face * 10, a.y - 24)
      ctx.lineTo(w.rodLine.x, w.rodLine.y)
      ctx.stroke()
      ctx.fillStyle = '#ff5a5f'
      ctx.beginPath()
      ctx.arc(w.rodLine.x, w.rodLine.y, 4, 0, Math.PI * 2)
      ctx.fill()
    }
    for (const p of w.projs) this.drawProj(ctx, p, cam)
    for (const key of [...this.trails.keys()]) if (!w.projs.includes(key as never)) this.trails.delete(key)
    if (w.gull) this.drawGull(ctx, w.gull)
    for (const r of this.rings) {
      const k = r.t / 22
      ctx.strokeStyle = `rgba(255,255,255,${r.water ? 1 - k : 0.9 - k * 0.9})`
      ctx.lineWidth = r.water ? 3 : 6 * (1 - k) + 1
      ctx.beginPath()
      if (r.water) ctx.ellipse(r.x, r.y, r.r + k * 40, 5 + k * 6, 0, 0, Math.PI * 2)
      else ctx.arc(r.x, r.y, r.r * (0.6 + k * 0.8), 0, Math.PI * 2)
      ctx.stroke()
      if (!r.water && r.t < 5) {
        ctx.fillStyle = `rgba(255,255,240,${0.7 - r.t * 0.14})`
        ctx.beginPath()
        ctx.arc(r.x, r.y, r.r * 0.9, 0, Math.PI * 2)
        ctx.fill()
      }
    }
    ctx.fillStyle = '#2f8fc4'
    ctx.fillRect(-1000, WATER, W + 2000, H - WATER + 200)
    const wave = (x: number) => WATER + 5 * Math.sin(x * 0.04 + f * 0.05)
    ctx.fillStyle = '#4fb0e0'
    ctx.beginPath()
    ctx.moveTo(-1000, WATER + 30)
    for (let x = -1000; x <= W + 1000; x += 16) ctx.lineTo(x, wave(x))
    ctx.lineTo(W + 1000, WATER + 30)
    ctx.fill()
    ctx.strokeStyle = 'rgba(255,255,255,.75)'
    ctx.lineWidth = 3
    ctx.beginPath()
    for (let x = -1000; x <= W + 1000; x += 16) (x === -1000 ? ctx.moveTo : ctx.lineTo).call(ctx, x, wave(x))
    ctx.stroke()
    for (const p of this.parts) {
      ctx.globalAlpha = Math.max(0, 1 - p.t / p.life)
      ctx.fillStyle = p.c
      ctx.fillRect(p.x - p.s / 2, p.y - p.s / 2, p.s, p.s)
    }
    ctx.globalAlpha = 1

    ctx.setTransform(k, 0, 0, k, 0, 0)
    // 표지 찍을 때(<html data-capture="1">)는 글자 없이 그림만
    if (clean) return
    const toS = (x: number, y: number): [number, number] => [(x - cam.x) * cam.s, (y - cam.y) * cam.s]
    for (const a of w.animals) if (a.alive) this.drawLabel(ctx, w, a, toS)
    ctx.textAlign = 'center'
    for (const fl of this.floats) {
      const [sx, sy] = toS(fl.x, fl.y)
      ctx.globalAlpha = Math.min(1, (80 - fl.t) / 20)
      ctx.font = "24px 'Black Han Sans', sans-serif"
      ctx.lineWidth = 4
      ctx.strokeStyle = INK
      ctx.strokeText(fl.text, sx, sy - fl.t * 0.5)
      ctx.fillStyle = fl.c
      ctx.fillText(fl.text, sx, sy - fl.t * 0.5)
    }
    ctx.globalAlpha = 1
    if (w.charging) {
      const [sx, sy] = toS(w.active.x, w.active.y)
      const p = chargePower(w.chargeT)
      ctx.fillStyle = INK
      ctx.fillRect(sx - 34, sy + 10, 68, 10)
      ctx.fillStyle = p > 0.8 ? '#ff5a5f' : '#ffd23f'
      ctx.fillRect(sx - 32, sy + 12, 64 * p, 6)
    }
    this.drawHud(ctx, w, cam, opts)
  }

  private drawAnimal(ctx: CanvasRenderingContext2D, w: World, a: Animal) {
    const k = KINDS[a.kind]
    const isActive = a === w.active && w.canAct()
    const swing = a === w.active && w.hammerT > 0 ? Math.min(1, w.hammerT / 10) : 0
    const step = a.moving ? Math.sin(a.walkT * 0.32) : 0
    const bob = a.moving ? Math.abs(step) * -1.2 : isActive ? Math.sin(this.frame * 0.12) * 0.6 : 0
    const tilt = a.air ? Math.max(-0.5, Math.min(0.5, a.vx * 0.08)) : a.slide ? a.slide * 0.06 : 0
    ctx.save()
    ctx.translate(a.x, a.y)
    ctx.scale(SC, SC)
    ctx.rotate(tilt)
    let sx = 1
    let sy = 1
    if (a.crouch > 0) {
      sy = 0.78
      sx = 1.15
    } else if (a.squash > 0) {
      const q = (a.squash / 10) * 0.25
      sy = 1 - q
      sx = 1 + q * 0.7
    } else if (a.air) {
      const q = Math.min(0.14, Math.abs(a.vy) * 0.02)
      sy = 1 + q
      sx = 1 - q * 0.5
    }
    ctx.scale(sx, sy)
    if (a.hit > 0 && (a.hit >> 2) % 2) ctx.globalAlpha = 0.65
    ctx.lineWidth = 1.5
    ctx.strokeStyle = INK
    ctx.lineJoin = 'round'
    ctx.fillStyle = INK
    ctx.beginPath()
    ctx.ellipse(-3 + step * 2.2, -1.6, 2.6, 1.8, 0, 0, Math.PI * 2)
    ctx.ellipse(3 - step * 2.2, -1.6, 2.6, 1.8, 0, 0, Math.PI * 2)
    ctx.fill()
    ctx.translate(0, bob)
    ctx.fillStyle = TEAM_COLOR[a.team]
    ctx.beginPath()
    ctx.ellipse(0, -8, 7.5, 6.8, 0, 0, Math.PI * 2)
    ctx.fill()
    ctx.stroke()
    ctx.fillStyle = k.fur
    ctx.beginPath()
    ctx.arc(a.face * 6.5, -7 + step, 2.4, 0, Math.PI * 2)
    ctx.fill()
    ctx.stroke()
    const hx = a.face
    const hy = -20
    const ear = (ex: number, ey: number, ew: number, eh: number, c?: string) => {
      ctx.fillStyle = c ?? k.fur
      ctx.beginPath()
      ctx.ellipse(ex, ey, ew, eh, 0, 0, Math.PI * 2)
      ctx.fill()
      ctx.stroke()
    }
    const tri = (ex: number, dir: number) => {
      ctx.fillStyle = k.fur
      ctx.beginPath()
      ctx.moveTo(ex - 4 * dir, hy - 4)
      ctx.lineTo(ex, hy - 13)
      ctx.lineTo(ex + 3 * dir, hy - 5)
      ctx.closePath()
      ctx.fill()
      ctx.stroke()
    }
    if (a.kind === 'bear') {
      ear(hx - 6, hy - 6, 3.2, 3.2)
      ear(hx + 6, hy - 6, 3.2, 3.2)
    }
    if (a.kind === 'panda') {
      ear(hx - 6, hy - 6, 3.2, 3.2, INK)
      ear(hx + 6, hy - 6, 3.2, 3.2, INK)
    }
    if (a.kind === 'cat' || a.kind === 'fox') {
      tri(hx - 5, 1)
      tri(hx + 5, -1)
    }
    if (a.kind === 'rabbit') {
      ear(hx - 3.5, hy - 12, 2.4, 7)
      ear(hx + 3.5, hy - 12, 2.4, 7)
    }
    if (a.kind === 'frog') {
      ear(hx - 4.5, hy - 6, 3.6, 3.6)
      ear(hx + 4.5, hy - 6, 3.6, 3.6)
    }
    ctx.fillStyle = k.fur
    ctx.beginPath()
    ctx.arc(hx, hy, 8, 0, Math.PI * 2)
    ctx.fill()
    ctx.stroke()
    if (a.kind === 'fox') {
      ctx.fillStyle = '#fff4e6'
      ctx.beginPath()
      ctx.ellipse(hx + a.face * 3, hy + 3, 4, 3, 0, 0, Math.PI * 2)
      ctx.fill()
    }
    if (a.kind === 'panda') {
      ctx.fillStyle = INK
      ctx.beginPath()
      ctx.ellipse(hx - 3 + a.face * 2, hy - 1, 2.4, 3, 0, 0, Math.PI * 2)
      ctx.ellipse(hx + 3 + a.face * 2, hy - 1, 2.4, 3, 0, 0, Math.PI * 2)
      ctx.fill()
    }
    const frog = a.kind === 'frog'
    const eyeY = frog ? hy - 6 : hy - 1
    const ex1 = (frog ? hx - 4.5 : hx - 3) + a.face * 2
    const ex2 = (frog ? hx + 4.5 : hx + 3) + a.face * 2
    if (a.hit > 0) {
      ctx.lineWidth = 1.3
      for (const ex of [ex1, ex2]) {
        ctx.beginPath()
        ctx.moveTo(ex - 1.6, eyeY - 1.6)
        ctx.lineTo(ex + 1.6, eyeY + 1.6)
        ctx.moveTo(ex + 1.6, eyeY - 1.6)
        ctx.lineTo(ex - 1.6, eyeY + 1.6)
        ctx.stroke()
      }
    } else {
      ctx.fillStyle = a.kind === 'panda' ? '#fff' : INK
      if ((this.frame + a.id * 97) % 260 < 6) {
        ctx.fillRect(ex1 - 1.5, eyeY, 3, 0.8)
        ctx.fillRect(ex2 - 1.5, eyeY, 3, 0.8)
      } else {
        ctx.beginPath()
        ctx.arc(ex1, eyeY, 1.4, 0, Math.PI * 2)
        ctx.arc(ex2, eyeY, 1.4, 0, Math.PI * 2)
        ctx.fill()
      }
    }
    if (a === w.active && w.hammerT > 0) {
      const ang = (-1.9 + swing * 2.4) * a.face
      const hx0 = a.face * 5
      const hy0 = -11
      const tx = hx0 + Math.sin(ang) * 15
      const ty = hy0 - Math.cos(ang) * 15
      ctx.strokeStyle = '#8a5a2b'
      ctx.lineWidth = 2.2
      ctx.beginPath()
      ctx.moveTo(hx0, hy0)
      ctx.lineTo(tx, ty)
      ctx.stroke()
      ctx.save()
      ctx.translate(tx, ty)
      ctx.rotate(ang)
      ctx.fillStyle = '#ff5a8a'
      ctx.strokeStyle = INK
      ctx.lineWidth = 1.4
      ctx.fillRect(-7, -4, 14, 8)
      ctx.strokeRect(-7, -4, 14, 8)
      ctx.fillStyle = '#ffd23f'
      ctx.fillRect(-9, -4, 3, 8)
      ctx.fillRect(6, -4, 3, 8)
      ctx.restore()
    }
    ctx.restore()
  }

  private drawLabel(ctx: CanvasRenderingContext2D, w: World, a: Animal, toS: (x: number, y: number) => [number, number]) {
    const isActive = a === w.active && w.canAct()
    const [sx, sy] = toS(a.x, a.y - 52)
    ctx.textAlign = 'center'
    ctx.font = "700 12px 'IBM Plex Sans KR', sans-serif"
    ctx.lineWidth = 3
    ctx.strokeStyle = 'rgba(26,20,48,.85)'
    const label = `${KINDS[a.kind].name} ${a.hp}`
    ctx.strokeText(label, sx, sy)
    ctx.fillStyle = isActive ? '#ffd23f' : TEAM_COLOR[a.team]
    ctx.fillText(label, sx, sy)
    if (isActive) {
      const b = Math.sin(this.frame * 0.12) * 2
      ctx.fillStyle = '#ffd23f'
      ctx.beginPath()
      ctx.moveTo(sx - 6, sy - 22 + b)
      ctx.lineTo(sx + 6, sy - 22 + b)
      ctx.lineTo(sx, sy - 14 + b)
      ctx.fill()
    }
  }

  private drawAim(ctx: CanvasRenderingContext2D, w: World, cam: Cam) {
    const wp = w.weapon
    const a = w.active
    if (wp === 'gull') {
      ctx.strokeStyle = '#ff5a5f'
      ctx.lineWidth = 3 / cam.s
      ctx.setLineDash([10, 10])
      ctx.beginPath()
      ctx.moveTo(w.target, 100)
      ctx.lineTo(w.target, WATER)
      ctx.stroke()
      ctx.setLineDash([])
      ctx.beginPath()
      ctx.arc(w.target, 120, 16, 0, Math.PI * 2)
      ctx.stroke()
      return
    }
    if (wp === 'hammer') return
    const [dx, dy] = w.aimVec()
    const sx = a.x
    const sy = a.y - 20
    const dots = (from: number, to: number, gap: number, r: number, c: string) => {
      ctx.fillStyle = c
      for (let s = from; s <= to; s += gap) {
        ctx.beginPath()
        ctx.arc(sx + dx * s, sy + dy * s, r, 0, Math.PI * 2)
        ctx.fill()
      }
    }
    if (wp === 'drill') return dots(24, 160, 10, 3, '#c98a4b')
    if (wp === 'rod') return dots(24, 320, 12, 2, '#ffd23f')
    dots(27, 90, 9, 2.6, '#ffd23f')
    const cx = sx + dx * 104
    const cy = sy + dy * 104
    ctx.strokeStyle = '#ffd23f'
    ctx.lineWidth = 2.4
    ctx.beginPath()
    ctx.arc(cx, cy, 8, 0, Math.PI * 2)
    ctx.moveTo(cx - 13, cy)
    ctx.lineTo(cx + 13, cy)
    ctx.moveTo(cx, cy - 13)
    ctx.lineTo(cx, cy + 13)
    ctx.stroke()
  }

  private drawProj(ctx: CanvasRenderingContext2D, p: World['projs'][number], cam: Cam) {
    if (p.kind !== 'egg') {
      let tr = this.trails.get(p)
      if (!tr) this.trails.set(p, (tr = []))
      if (this.frame % 2 === 0) {
        tr.push([p.x, p.y])
        if (tr.length > 26) tr.shift()
      }
      ctx.fillStyle = 'rgba(255,255,255,.7)'
      tr.forEach(([x, y], i) => {
        ctx.beginPath()
        ctx.arc(x, y, 1 + (i / tr.length) * 2.5, 0, Math.PI * 2)
        ctx.fill()
      })
    }
    ctx.save()
    ctx.translate(p.x, p.y)
    ctx.strokeStyle = INK
    ctx.lineWidth = 2
    if (p.kind === 'balloon') {
      ctx.rotate(Math.atan2(p.vy, p.vx) + Math.PI / 2)
      ctx.fillStyle = '#5be0f0'
      ctx.beginPath()
      ctx.ellipse(0, 0, 9, 11, 0, 0, Math.PI * 2)
      ctx.fill()
      ctx.stroke()
      ctx.fillStyle = 'rgba(255,255,255,.8)'
      ctx.beginPath()
      ctx.arc(-3, -4, 2.4, 0, Math.PI * 2)
      ctx.fill()
      ctx.fillStyle = '#2f8fc4'
      ctx.beginPath()
      ctx.moveTo(-3, 11)
      ctx.lineTo(3, 11)
      ctx.lineTo(0, 15)
      ctx.fill()
      ctx.restore()
    } else if (p.kind === 'pine') {
      ctx.rotate(p.t * 0.22 * Math.sign(p.vx || 1))
      ctx.fillStyle = '#8a5a2b'
      ctx.beginPath()
      ctx.ellipse(0, 0, 7.5, 10, 0, 0, Math.PI * 2)
      ctx.fill()
      ctx.stroke()
      ctx.strokeStyle = '#5c3a18'
      ctx.lineWidth = 1.4
      for (let i = -1; i <= 1; i++) {
        ctx.beginPath()
        ctx.moveTo(-7, i * 4)
        ctx.lineTo(7, i * 4 + 3)
        ctx.stroke()
      }
      ctx.restore()
      const left = String(Math.max(1, Math.ceil((PINE_FUSE - p.t) / 60)))
      if (document.documentElement.dataset.capture === '1') return
      ctx.save()
      ctx.setTransform(this.k, 0, 0, this.k, 0, 0)
      const sx = (p.x - cam.x) * cam.s
      const sy = (p.y - 20 - cam.y) * cam.s
      ctx.font = "20px 'Black Han Sans', sans-serif"
      ctx.textAlign = 'center'
      ctx.lineWidth = 4
      ctx.strokeStyle = INK
      ctx.strokeText(left, sx, sy)
      ctx.fillStyle = '#ffd23f'
      ctx.fillText(left, sx, sy)
      ctx.restore()
    } else {
      ctx.fillStyle = '#fff1d6'
      ctx.beginPath()
      ctx.moveTo(-7, 3)
      ctx.quadraticCurveTo(0, -10, 7, 3)
      ctx.closePath()
      ctx.fill()
      ctx.stroke()
      ctx.restore()
    }
  }

  private drawGull(ctx: CanvasRenderingContext2D, g: NonNullable<World['gull']>) {
    const flap = Math.sin(this.frame * 0.35) * 9
    ctx.save()
    ctx.translate(g.x, g.y)
    ctx.scale(g.dir * 1.8, 1.8)
    ctx.strokeStyle = INK
    ctx.lineWidth = 1.4
    ctx.fillStyle = '#fff'
    ctx.beginPath()
    ctx.ellipse(0, 0, 13, 6, 0, 0, Math.PI * 2)
    ctx.fill()
    ctx.stroke()
    ctx.beginPath()
    ctx.arc(12, -4, 5, 0, Math.PI * 2)
    ctx.fill()
    ctx.stroke()
    ctx.fillStyle = '#ffb02e'
    ctx.beginPath()
    ctx.moveTo(16, -4)
    ctx.lineTo(23, -2)
    ctx.lineTo(16, -1)
    ctx.fill()
    ctx.stroke()
    ctx.fillStyle = INK
    ctx.beginPath()
    ctx.arc(13, -5, 1.2, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = '#dfe6ee'
    ctx.beginPath()
    ctx.moveTo(-4, -2)
    ctx.quadraticCurveTo(-10, -14 - flap, -24, -8 - flap)
    ctx.lineTo(4, -2)
    ctx.fill()
    ctx.stroke()
    ctx.restore()
  }

  private drawHud(ctx: CanvasRenderingContext2D, w: World, cam: Cam, opts: { showMini: boolean; names: readonly [string, string]; myTurn: boolean }) {
    ctx.textAlign = 'left'
    ctx.font = "700 14px 'IBM Plex Sans KR', sans-serif"
    ctx.fillStyle = 'rgba(26,20,48,.72)'
    ctx.fillRect(12, 12, 168, 34)
    ctx.fillStyle = '#fff'
    ctx.fillText('바람', 22, 34)
    const cx = 112
    const len = Math.abs(w.wind) * 4.8
    const dir = Math.sign(w.wind)
    if (w.wind) {
      ctx.strokeStyle = '#5be0f0'
      ctx.lineWidth = 5
      ctx.beginPath()
      ctx.moveTo(cx - (dir * len) / 2, 29)
      ctx.lineTo(cx + (dir * len) / 2, 29)
      ctx.stroke()
      ctx.fillStyle = '#5be0f0'
      ctx.beginPath()
      ctx.moveTo(cx + dir * (len / 2 + 8), 29)
      ctx.lineTo(cx + (dir * len) / 2, 22)
      ctx.lineTo(cx + (dir * len) / 2, 36)
      ctx.fill()
    } else {
      ctx.fillStyle = '#b9b3e6'
      ctx.fillText('없음', cx - 14, 34)
    }
    if (!w.winner) {
      const t = `${opts.names[w.team]} · ${KINDS[w.active.kind].name} 차례`
      ctx.font = "18px 'Black Han Sans', sans-serif"
      const tw = ctx.measureText(t).width + 24
      ctx.fillStyle = 'rgba(26,20,48,.72)'
      ctx.fillRect(VW - tw - 12, 12, tw, 34)
      ctx.fillStyle = TEAM_COLOR[w.team]
      ctx.fillText(t, VW - tw, 36)
    }
    if (opts.showMini) {
      const { w: mw, h: mh, x: mx, y: my } = MINI
      const s = mw / W
      ctx.fillStyle = 'rgba(26,20,48,.6)'
      ctx.fillRect(mx - 3, my - 3, mw + 6, mh + 6)
      ctx.fillStyle = 'rgba(150,210,240,.55)'
      ctx.fillRect(mx, my, mw, mh)
      ctx.drawImage(this.terr, mx, my, mw, mh)
      ctx.fillStyle = '#2f8fc4'
      ctx.fillRect(mx, my + WATER * s, mw, mh - WATER * s)
      for (const a of w.animals)
        if (a.alive) {
          ctx.fillStyle = a === w.active ? '#ffd23f' : TEAM_COLOR[a.team]
          ctx.fillRect(mx + a.x * s - 2, my + a.y * s - 5, 4, 5)
        }
      const rx = mx + cam.x * s
      const ry = my + cam.y * s
      const rw = (VW / cam.s) * s
      const rh = (VH / cam.s) * s
      ctx.fillStyle = 'rgba(255,210,63,.18)'
      ctx.fillRect(rx, ry, rw, rh)
      ctx.strokeStyle = '#ffd23f'
      ctx.lineWidth = 2
      ctx.strokeRect(rx, ry, rw, rh)
      ctx.textAlign = 'center'
      ctx.font = "700 11px 'IBM Plex Sans KR', sans-serif"
      ctx.lineWidth = 3
      ctx.strokeStyle = 'rgba(26,20,48,.85)'
      ctx.strokeText('네모를 끌어 화면 옮기기', VW / 2, my + mh + 18)
      ctx.fillStyle = '#fff'
      ctx.fillText('네모를 끌어 화면 옮기기', VW / 2, my + mh + 18)
    }
    if (w.canAct() && opts.myTurn && w.weapon === 'gull') {
      ctx.textAlign = 'center'
      ctx.font = "700 15px 'IBM Plex Sans KR', sans-serif"
      ctx.fillStyle = 'rgba(26,20,48,.72)'
      ctx.fillRect(VW / 2 - 170, VH - 46, 340, 30)
      ctx.fillStyle = '#ffd23f'
      ctx.fillText(`지도를 눌러 목표를 고르고 [${weaponOf('gull').action}]`, VW / 2, VH - 25)
    }
  }
}
