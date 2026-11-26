import { createRng, type Rng } from '../../../shared/random'
import {
  AMMO,
  BODY_R,
  CRATE_CHANCE,
  CRATE_HEAL,
  CRATE_KINDS,
  CRATE_MAX,
  CRATE_WEIGHTS,
  type CrateKind,
  FLOOD_ROUNDS,
  FLOOD_STEP,
  JUMP_COST,
  MOVE_MAX,
  CHARGE_STEPS,
  DAMAGE,
  G,
  H,
  HP,
  PINE_FUSE,
  SETTLE_STEPS,
  TALL,
  TEAM_SIZE,
  TURN_STEPS,
  W,
  WATER,
  type WeaponId,
  weaponOf,
} from '../constants'

// 섬 한 판을 1/60초씩 돌리는 엔진. 땅은 칸마다 있음/없음(mask), 그림은 화면이 따로 그린다.
// 화면이 알아야 할 일(터짐·풍덩·다침…)은 fx로, 땅이 파인 곳은 carves로 쌓아 두면 화면이 가져간다.

export type AnimalKind = 'bear' | 'cat' | 'rabbit' | 'fox' | 'panda' | 'frog'
/** 편마다 동물 셋 — 편이 넷이면 돌려 씀 (옷 색으로 구분) */
const ALL_KINDS: readonly AnimalKind[] = ['bear', 'cat', 'rabbit', 'fox', 'panda', 'frog']
/** 편 수 (팀전·봇 연습·둘이서 = 2, 친구 대전 개인전 = 사람 수 2~4) */
export const MAX_SIDES = 4

/** 편 번호 (0 = 파랑, 1 = 빨강, 2 = 초록, 3 = 노랑) */
export type Team = number
export type Face = 1 | -1

export type Animal = {
  id: number
  team: Team
  kind: AnimalKind
  /** 발 위치 */
  x: number
  y: number
  vx: number
  vy: number
  /** 땅에 닿은 뒤 미끄러지는 빠르기 */
  slide: number
  air: boolean
  hp: number
  alive: boolean
  face: Face
  /** 맞고 남은 스텝 (눈 ✕·깜빡임) */
  hit: number
  walkT: number
  moving: boolean
  /** 착지 찌그러짐 남은 스텝 */
  squash: number
  /** 점프 전 웅크림 남은 스텝 */
  crouch: number
}

export type Proj = { kind: 'balloon' | 'pine' | 'egg'; x: number; y: number; vx: number; vy: number; t: number; owner: number; dead: boolean }
/** 보급 상자 — 낙하산으로 천천히 내려오고, 동물이 닿으면 그 편이 가짐 */
export type Crate = { id: number; kind: CrateKind; x: number; y: number; vy: number; air: boolean; dead?: boolean }
export type Gull = { x: number; y: number; dir: Face; tx: number; dropped: number }
export type Phase = 'aim' | 'flying' | 'reel' | 'dig' | 'over'
export type Fx =
  | { t: 'boom'; x: number; y: number; r: number }
  | { t: 'splash'; x: number }
  | { t: 'hurt'; x: number; y: number; dmg: number; team: Team }
  | { t: 'say'; x: number; y: number; text: string; color: string }
  | { t: 'ko'; x: number; y: number }
  | { t: 'bounce' | 'land' | 'boing' | 'whiff' | 'turn' | 'throw' | 'reel' | 'gull' | 'jump' | 'win' | 'flood' | 'crate' | 'drop' }
  | { t: 'dig'; x: number; y: number }
export type Carve = { x: number; y: number; r: number; ring: boolean }
export type Keys = { left: boolean; right: boolean; up: boolean; down: boolean }
export const NO_KEYS: Keys = { left: false, right: false, up: false, down: false }

/** 힘 0~1 (차올랐다 내려갔다 반복) */
export function chargePower(chargeT: number) {
  const t = (chargeT / CHARGE_STEPS) % 2
  return t < 1 ? t : 2 - t
}

/** 던지는 빠르기 (힘 0~1) */
export const throwSpeed = (p: number) => 2.4 + p * 8.6
export const WIND_ACCEL = 0.0035
export const EGG_G = 0.11
const BLAST = { balloon: { r: 44, kn: 2.6 }, pine: { r: 56, kn: 3.0 }, egg: { r: 22, kn: 1.2 } } as const
export const blastOf = (kind: Proj['kind']) => ({ ...BLAST[kind], dmg: DAMAGE[kind] })

/** 터짐 피해 (봇이 미리 계산할 때도 씀) */
export function blastDamage(r: number, dmg: number, d: number) {
  const reach = r * 1.5 + 10
  if (d > reach) return 0
  return Math.round(dmg * (0.3 + 0.7 * (1 - d / reach)))
}

export class World {
  readonly mask = new Uint8Array(W * H)
  animals: Animal[] = []
  projs: Proj[] = []
  gull: Gull | null = null
  wind = 0
  team: Team = 0
  active!: Animal
  phase: Phase = 'aim'
  timer = TURN_STEPS
  weapon: WeaponId = 'balloon'
  /** 조준 각도 (도, 바라보는 쪽 기준 위가 +) */
  aim = 40
  charging = false
  chargeT = 0
  /** 갈매기 목표 x */
  target = 0
  rodLine: { x: number; y: number; t: number } | null = null
  hammerT = 0
  drill: { t: number; dx: number; dy: number; air: number; hit: Set<number> } | null = null
  winner: Team | 'draw' | null = null
  turnNo = 0
  /** 바다 높이 — 후반엔 차례마다 차오름 */
  water = WATER
  /** 이번 차례 남은 걸음 (칸) */
  move = MOVE_MAX
  /** 편마다 무기 개수 (-1 = 무제한) */
  ammo: Record<WeaponId, number>[]
  crates: Crate[] = []
  private crateId = 0
  private flooded = false
  fx: Fx[] = []
  carves: Carve[] = []
  private settleT = 0
  /** 편 수 */
  readonly sides: number
  private next: number[]
  private rng: Rng

  constructor(seed: number, sides = 2) {
    this.sides = Math.max(2, Math.min(MAX_SIDES, Math.floor(sides)))
    this.next = Array.from({ length: this.sides }, () => 0)
    this.ammo = Array.from({ length: this.sides }, () => ({ ...AMMO }))
    this.rng = createRng(seed)
    this.genTerrain()
    this.spawn()
    for (let i = 0; i < 160; i++) for (const a of this.animals) this.stepAnimal(a)
    this.fx = []
    this.team = Math.floor(this.rng.next() * this.sides)
    this.startTurn(true)
  }

  private r(a: number, b: number) {
    return a + this.rng.next() * (b - a)
  }

  solid(x: number, y: number) {
    x |= 0
    y |= 0
    if (x < 0 || x >= W || y < 0 || y >= H) return false
    return this.mask[y * W + x] === 1
  }

  surfaceAt(x: number) {
    for (let y = 60; y < H; y++) if (this.solid(x, y)) return y
    return H
  }

  private fill(cx: number, cy: number, r: number, v: 0 | 1) {
    for (let y = Math.max(0, (cy - r) | 0); y <= Math.min(H - 1, cy + r); y++)
      for (let x = Math.max(0, (cx - r) | 0); x <= Math.min(W - 1, cx + r); x++) {
        const dx = x - cx
        const dy = y - cy
        if (dx * dx + dy * dy <= r * r) this.mask[y * W + x] = v
      }
  }

  private genTerrain() {
    const m = this.mask
    const p = [this.r(0, 6), this.r(0, 6), this.r(0, 6)]
    const g1 = this.r(620, 760)
    const g2 = this.r(1180, 1320)
    const gw = this.r(70, 110)
    const isl = [
      [70, g1 - gw / 2],
      [g1 + gw / 2, g2 - gw / 2],
      [g2 + gw / 2, W - 70],
    ]
    const lift = [this.r(-60, 40), this.r(-170, -60), this.r(-60, 40)]
    for (let x = 0; x < W; x++) {
      const k = isl.findIndex(([a, b]) => x >= a && x <= b)
      if (k < 0) continue
      const [a, b] = isl[k]
      const mid = (a + b) / 2
      const half = (b - a) / 2
      let h = 660 + lift[k] + 70 * Math.sin(x * 0.006 + p[0]) + 38 * Math.sin(x * 0.017 + p[1]) + 14 * Math.sin(x * 0.045 + p[2])
      h -= 60 * Math.max(0, 1 - Math.abs(x - mid) / half) ** 2
      const e = Math.min(x - a, b - x)
      if (e < 50) h += (50 - e) ** 1.6
      for (let y = Math.max(0, h | 0); y < H; y++) m[y * W + x] = 1
    }
    const plats = 3 + (this.rng.next() < 0.5 ? 1 : 0)
    for (let k = 0; k < plats; k++) {
      const cx = 220 + ((k + this.r(0.1, 0.9)) * (W - 440)) / plats
      const cy = this.r(330, 470)
      const rw = this.r(70, 120)
      for (let y = (cy - 6) | 0; y < cy + 34; y++)
        for (let x = (cx - rw) | 0; x < cx + rw; x++) {
          if (x < 0 || x >= W) continue
          const dx = (x - cx) / rw
          const top = cy + 10 * dx * dx + 3 * Math.sin(x * 0.08 + k)
          const bottom = cy + 34 - 30 * dx * dx
          if (y >= top && y <= bottom) m[y * W + x] = 1
        }
    }
    for (let c = 0; c < 2; c++) {
      const [a, b] = isl[Math.floor(this.rng.next() * 3)]
      let x = this.r(a + 80, b - 80)
      let y = this.surfaceAt(x) + this.r(70, 110)
      const dir = this.rng.next() < 0.5 ? -1 : 1
      for (let s = 0; s < 34; s++) {
        this.fill(x, y, 22 + 6 * Math.sin(s * 0.7), 0)
        x += dir * 7
        y += this.r(-4, 4)
        if (x < a + 30 || x > b - 30) break
      }
    }
  }

  private spawn() {
    const taken: number[] = []
    let id = 0
    // 동물이 많으면 조금 더 붙여 세움
    const gap = Math.min(150, ((W - 220) / (TEAM_SIZE * this.sides)) * 0.8)
    for (let k = 0; k < TEAM_SIZE; k++)
      for (let t = 0; t < this.sides; t++) {
        let x = 0
        let y = H
        let tries = 0
        do {
          x = this.r(110, W - 110)
          y = this.surfaceAt(x)
          tries++
        } while ((y > WATER - 80 || taken.some((o) => Math.abs(o - x) < gap)) && tries < 300)
        taken.push(x)
        this.animals.push({
          id: id++, team: t, kind: ALL_KINDS[(t * TEAM_SIZE + k) % ALL_KINDS.length], x, y: y - 2, vx: 0, vy: 0, slide: 0, air: true,
          hp: HP, alive: true, face: x < W / 2 ? 1 : -1, hit: 0, walkT: 0, moving: false, squash: 0, crouch: 0,
        })
      }
  }

  /** 남은 개수 (-1 = 무제한) */
  ammoLeft(w: WeaponId, team: Team = this.team) {
    return this.ammo[team]?.[w] ?? -1
  }

  /** 바닷물이 차오르기 시작할 때까지 남은 차례 (0이면 이번 차례 끝부터) */
  floodIn() {
    return Math.max(0, FLOOD_ROUNDS * this.sides - this.turnNo)
  }

  private dropCrate() {
    if (this.crates.length >= CRATE_MAX || this.rng.next() >= CRATE_CHANCE) return
    let roll = this.rng.next() * CRATE_WEIGHTS.reduce((a, b) => a + b, 0)
    let kind: CrateKind = CRATE_KINDS[0]
    for (let i = 0; i < CRATE_KINDS.length; i++) {
      roll -= CRATE_WEIGHTS[i]
      if (roll < 0) {
        kind = CRATE_KINDS[i]
        break
      }
    }
    for (let i = 0; i < 30; i++) {
      const x = Math.round(this.r(100, W - 100))
      if (this.surfaceAt(x) > this.water - 60 || this.animals.some((a) => a.alive && Math.abs(a.x - x) < 40)) continue
      this.crates.push({ id: this.crateId++, kind, x, y: -20, vy: 0, air: true })
      this.fx.push({ t: 'drop' })
      return
    }
  }

  private collect(a: Animal, c: Crate) {
    c.dead = true
    if (c.kind === 'heal') {
      const before = a.hp
      a.hp = Math.min(HP, a.hp + CRATE_HEAL)
      this.fx.push({ t: 'say', x: c.x, y: c.y - 40, text: `체력 +${a.hp - before}`, color: '#7dff8a' })
    } else {
      const left = this.ammo[a.team][c.kind]
      if (left >= 0) this.ammo[a.team][c.kind] = left + 1
      this.fx.push({ t: 'say', x: c.x, y: c.y - 40, text: `${weaponOf(c.kind).name} +1`, color: '#ffd23f' })
    }
    this.fx.push({ t: 'crate' })
  }

  private stepCrates() {
    for (const c of this.crates) {
      if (c.air || !this.solid(c.x, c.y + 1)) {
        c.air = true
        c.vy = Math.min(c.vy + 0.06, 1.4)
        const ny = c.y + c.vy
        if (this.solid(c.x, ny)) {
          let y = ny
          let k = 0
          while (this.solid(c.x, y) && k++ < 20) y--
          c.y = y
          c.vy = 0
          c.air = false
        } else c.y = ny
      }
      if (c.y > this.water) {
        c.dead = true
        this.fx.push({ t: 'splash', x: c.x })
        continue
      }
      for (const a of this.animals)
        if (a.alive && !c.dead && Math.abs(a.x - c.x) < 22 && a.y - c.y > -30 && a.y - c.y < 30) this.collect(a, c)
    }
    this.crates = this.crates.filter((c) => !c.dead)
  }

  alive(team: Team) {
    return this.animals.filter((a) => a.team === team && a.alive)
  }

  private startTurn(first: boolean) {
    if (!first) this.team = this.nextSide(this.team)
    const list = this.animals.filter((a) => a.team === this.team)
    for (let k = 0; k < list.length; k++) {
      const a = list[this.next[this.team] % list.length]
      this.next[this.team]++
      if (a.alive) {
        this.active = a
        break
      }
    }
    this.wind = Math.round(this.r(-10, 10))
    if (!first) this.dropCrate()
    this.move = MOVE_MAX
    this.flooded = false
    this.phase = 'aim'
    this.timer = TURN_STEPS
    this.charging = false
    this.chargeT = 0
    this.rodLine = null
    this.hammerT = 0
    this.drill = null
    this.aim = 40
    this.target = Math.min(W - 40, Math.max(40, this.active.x + this.active.face * 400))
    if (this.weapon === 'rod' || this.weapon === 'gull' || this.weapon === 'drill' || this.ammoLeft(this.weapon) === 0) this.weapon = 'balloon'
    this.turnNo++
    this.fx.push({ t: 'turn' })
  }

  aimVec(): [number, number] {
    const r = (this.aim * Math.PI) / 180
    return [Math.cos(r) * this.active.face, -Math.sin(r)]
  }

  canAct() {
    return this.phase === 'aim' && this.active.alive && this.winner === null
  }

  pick(w: WeaponId) {
    if (!this.canAct() || this.charging || this.ammoLeft(w) === 0) return
    this.weapon = w
  }

  jump() {
    const a = this.active
    if (!this.canAct() || a.air || a.crouch || this.move < JUMP_COST) return
    this.move -= JUMP_COST
    a.crouch = 6
    a.slide = 0
  }

  /** 꾹 누르기 시작 (힘 모으는 무기) — 아니면 바로 씀 */
  press() {
    if (!this.canAct()) return
    if (this.weapon === 'balloon' || this.weapon === 'pine') {
      this.charging = true
      this.chargeT = 0
    } else this.fire()
  }

  release() {
    if (this.charging) this.fire()
  }

  setTarget(x: number) {
    this.target = Math.max(20, Math.min(W - 20, x))
  }

  fire(powerOverride?: number) {
    if (!this.canAct()) return
    const a = this.active
    const w = this.weapon
    const left = this.ammoLeft(w)
    if (left === 0) return
    if (left > 0) this.ammo[a.team][w] = left - 1
    const [dx, dy] = this.aimVec()
    const sx = a.x + dx * 18
    const sy = a.y - 20 + dy * 18
    this.charging = false
    if (w === 'balloon' || w === 'pine') {
      const v = throwSpeed(powerOverride ?? chargePower(this.chargeT))
      this.projs.push({ kind: w, x: sx, y: sy, vx: dx * v, vy: dy * v, t: 0, owner: a.id, dead: false })
      this.fx.push({ t: 'throw' })
      this.toFlying()
    } else if (w === 'gull') {
      const dir: Face = this.target < a.x ? -1 : 1
      this.gull = { x: dir > 0 ? -60 : W + 60, y: 150, dir, tx: this.target, dropped: 0 }
      this.fx.push({ t: 'gull' })
      this.toFlying()
    } else if (w === 'hammer') {
      this.hammerT = 1
      this.toFlying()
    } else if (w === 'drill') {
      this.drill = { t: 0, dx, dy, air: 0, hit: new Set() }
      this.phase = 'dig'
    } else if (w === 'rod') {
      let hx = sx
      let hy = sy
      let hit = false
      for (let s = 0; s < 80; s++) {
        hx += dx * 4
        hy += dy * 4
        if (this.solid(hx, hy)) {
          hit = true
          break
        }
        if (hx < 0 || hx > W || hy < 0) break
      }
      if (hit) {
        this.rodLine = { x: hx, y: hy, t: 0 }
        this.phase = 'reel'
        this.fx.push({ t: 'reel' })
      } else {
        this.fx.push({ t: 'say', x: a.x, y: a.y - 60, text: '안 걸렸어요', color: '#fff' })
        this.toFlying()
      }
    }
    this.chargeT = 0
  }

  private toFlying() {
    this.phase = 'flying'
    this.settleT = 0
  }

  /** 땅 파기 (친구 대전 화면은 서버가 알려 준 파인 곳을 이걸로 따라 함) */
  carve(x: number, y: number, r: number, ring: boolean) {
    this.fill(x, y, r, 0)
    this.carves.push({ x, y, r, ring })
  }

  /** 살아 있는 동물이 있는 편들 */
  sidesLeft() {
    const out: Team[] = []
    for (let t = 0; t < this.sides; t++) if (this.alive(t).length) out.push(t)
    return out
  }

  private nextSide(from: Team) {
    for (let k = 1; k <= this.sides; k++) {
      const s = (from + k) % this.sides
      if (this.alive(s).length) return s
    }
    return from
  }

  /** 한 편 사람이 모두 나감 (친구 대전) — 그 편 동물은 사라지고, 한 편만 남으면 끝 */
  forfeit(team: Team) {
    if (this.winner !== null) return
    for (const a of this.animals)
      if (a.team === team && a.alive) {
        a.alive = false
        this.fx.push({ t: 'say', x: a.x, y: a.y - 50, text: '나감', color: '#fff' })
      }
    const left = this.sidesLeft()
    if (left.length <= 1) {
      this.winner = left[0] ?? 'draw'
      this.phase = 'over'
      this.fx.push({ t: 'win' })
    } else if (this.active.team === team) this.toFlying()
  }

  private hurt(a: Animal, dmg: number) {
    if (dmg <= 0) return
    a.hp = Math.max(0, a.hp - dmg)
    a.hit = 36
    this.fx.push({ t: 'hurt', x: a.x, y: a.y - 58, dmg, team: a.team })
  }

  private explode(x: number, y: number, kind: Proj['kind']) {
    const { r, dmg, kn } = blastOf(kind)
    this.carve(x, y, r, true)
    for (const a of this.animals) {
      if (!a.alive) continue
      const dx = a.x - x
      const dy = a.y - 18 - y
      const d = Math.max(1, Math.sqrt(dx * dx + dy * dy))
      const reach = r * 1.5 + 10
      if (d > reach) continue
      const f = 1 - d / reach
      this.hurt(a, blastDamage(r, dmg, d))
      const k = kn * (0.4 + 0.6 * f)
      a.vx += (dx / d) * k
      a.vy += (dy / d) * k - k * 0.75
      a.air = true
      a.slide = 0
      a.crouch = 0
    }
    for (const c of this.crates)
      if (Math.hypot(c.x - x, c.y - 10 - y) < r + 12) {
        c.dead = true
        this.fx.push({ t: 'say', x: c.x, y: c.y - 30, text: '상자 펑', color: '#fff' })
      }
    this.crates = this.crates.filter((c) => !c.dead)
    this.fx.push({ t: 'boom', x, y, r })
  }

  private clearAt(x: number, y: number) {
    return !this.solid(x, y) && !this.solid(x, y - TALL * 0.5) && !this.solid(x, y - TALL)
  }

  /** 땅을 따라 옆으로 (오르막 8칸까지, 내리막은 붙어서) — 막히면 false */
  private groundMove(a: Animal, v: number) {
    const nx = a.x + v
    if (nx < 4 || nx > W - 4) return false
    for (let k = 0; k <= 8; k++) {
      if (this.clearAt(nx, a.y - k)) {
        a.x = nx
        a.y -= k
        let s = 0
        while (s < 9 && !this.solid(a.x, a.y + 1)) {
          a.y++
          s++
        }
        if (!this.solid(a.x, a.y + 1)) {
          a.air = true
          a.vx = v
          a.vy = 0.3
          a.slide = 0
        }
        return true
      }
    }
    return false
  }

  private walk(a: Animal, dir: Face) {
    a.face = dir
    if (a.air || a.crouch || this.move <= 0) return
    if (this.groundMove(a, dir * 1.6)) {
      a.moving = true
      a.walkT++
      this.move = Math.max(0, this.move - 1.6)
    }
  }

  private land(a: Animal) {
    const vy = a.vy
    if (vy > 6.2) this.hurt(a, Math.round((vy - 6.2) * 12))
    if (vy > 3.4 && Math.abs(a.vx) > 1.1) {
      a.vy = -vy * 0.28
      a.vx *= 0.65
      a.y -= 1
      this.fx.push({ t: 'bounce' })
      return
    }
    a.squash = Math.min(10, Math.round(vy * 2.2))
    a.air = false
    a.slide = Math.abs(a.vx) > 0.4 ? a.vx * 0.85 : 0
    a.vx = 0
    a.vy = 0
    if (vy > 3) this.fx.push({ t: 'land' })
  }

  /** 바다에 빠졌으면 탈락 */
  private drown(a: Animal) {
    if (!(a.y > this.water + 10 || a.x < -150 || a.x > W + 150)) return false
    a.alive = false
    a.hp = 0
    const x = Math.max(0, Math.min(W, a.x))
    this.fx.push({ t: 'splash', x }, { t: 'say', x, y: this.water - 40, text: '풍덩!', color: '#fff' })
    return true
  }

  private stepAnimal(a: Animal) {
    if (!a.alive || this.drown(a)) return
    if (a.hit > 0) a.hit--
    if (a.squash > 0) a.squash--
    if (a.crouch > 0) {
      a.crouch--
      if (a.crouch > 0) return
      a.vy = -4
      a.vx = a.face * 2
      a.air = true
      a.y -= 1
      this.fx.push({ t: 'jump' })
    }
    if (!a.air) {
      if (a.slide) {
        if (!this.groundMove(a, a.slide)) a.slide = 0
        else if (!a.air) {
          a.slide *= 0.86
          if (Math.abs(a.slide) < 0.15) a.slide = 0
        }
      }
      if (!a.air && !this.solid(a.x, a.y + 1)) {
        let s = 0
        while (s < 6 && !this.solid(a.x, a.y + 1)) {
          a.y++
          s++
        }
        if (!this.solid(a.x, a.y + 1)) {
          a.air = true
          a.vx = a.slide
          a.vy = 0
          a.slide = 0
        }
      }
      if (!a.air) return
    }
    // 공중: 중력 + 공기 저항 (빠를수록 더 막힘)
    a.vy += G
    a.vy -= a.vy * Math.abs(a.vy) * 0.0022
    a.vx *= 0.994
    const n = Math.ceil(Math.max(Math.abs(a.vx), Math.abs(a.vy)) / 1.5) || 1
    for (let s = 0; s < n; s++) {
      const nx = a.x + a.vx / n
      const ny = a.y + a.vy / n
      const sg = Math.sign(a.vx)
      if (sg && (this.solid(nx + sg * BODY_R * 0.8, ny - 10) || this.solid(nx + sg * BODY_R * 0.8, ny - TALL + 4))) a.vx = -a.vx * 0.3
      else a.x = nx
      if (a.vy < 0 && this.solid(a.x, ny - TALL)) a.vy = 0.4
      else if (a.vy > 0 && this.solid(a.x, ny)) {
        let y = ny
        let k = 0
        while (this.solid(a.x, y) && k++ < 16) y--
        a.y = y
        this.land(a)
        break
      } else a.y = ny
    }
    this.drown(a)
  }

  private stepProj(p: Proj) {
    p.t++
    if (p.kind === 'balloon') p.vx += this.wind * WIND_ACCEL
    p.vy += p.kind === 'egg' ? EGG_G : G
    const n = Math.ceil(Math.max(Math.abs(p.vx), Math.abs(p.vy)) / 1.5) || 1
    for (let s = 0; s < n; s++) {
      const px = p.x
      const py = p.y
      p.x += p.vx / n
      p.y += p.vy / n
      let hitAnimal = false
      if (p.kind !== 'pine')
        for (const a of this.animals) {
          if (!a.alive || (a.id === p.owner && p.t < 16)) continue
          const dx = a.x - p.x
          const dy = a.y - 18 - p.y
          if (dx * dx + dy * dy < 19 * 19) hitAnimal = true
        }
      if (this.solid(p.x, p.y) || hitAnimal) {
        if (p.kind === 'pine' && !hitAnimal) {
          const sp = Math.hypot(p.vx, p.vy)
          if (this.solid(p.x, py)) p.vx = -p.vx * 0.5
          else {
            p.vy = -p.vy * 0.42
            p.vx *= 0.8
          }
          p.x = px
          p.y = py
          if (sp > 1.2) this.fx.push({ t: 'bounce' })
          break
        }
        this.explode(p.x, p.y, p.kind)
        p.dead = true
        return
      }
      if (p.y > this.water) {
        this.fx.push({ t: 'splash', x: p.x })
        p.dead = true
        return
      }
      if (p.x < -400 || p.x > W + 400) {
        p.dead = true
        return
      }
    }
    if (p.kind === 'pine' && p.t >= PINE_FUSE) {
      this.explode(p.x, p.y, 'pine')
      p.dead = true
    }
  }

  private settled() {
    return this.projs.length === 0 && !this.gull && this.hammerT === 0 && this.animals.every((a) => !a.alive || (!a.air && !a.slide && !a.crouch))
  }

  step(keys: Keys) {
    for (const a of this.animals) a.moving = false
    if (this.phase === 'over') return
    const a = this.active
    if (this.phase === 'aim' && a.alive) {
      this.timer--
      if (this.weapon === 'gull') {
        if (keys.left) this.setTarget(this.target - 6)
        if (keys.right) this.setTarget(this.target + 6)
      } else {
        if (keys.left) this.walk(a, -1)
        if (keys.right) this.walk(a, 1)
      }
      if (keys.up) this.aim = Math.min(88, this.aim + 1.2)
      if (keys.down) this.aim = Math.max(-60, this.aim - 1.2)
      if (this.charging) this.chargeT++
      if (this.timer <= 0) {
        if (this.charging) this.fire()
        else this.toFlying()
      }
    }
    if (this.phase === 'reel' && this.rodLine) {
      const line = this.rodLine
      line.t++
      const dx = line.x - a.x
      const dy = line.y - (a.y - 18)
      const d = Math.sqrt(dx * dx + dy * dy)
      const stop = () => {
        a.air = true
        a.vx = (dx / Math.max(1, d)) * 1.5
        a.vy = -1.5
        this.rodLine = null
        this.toFlying()
      }
      if (d < 20 || line.t > 150) stop()
      else {
        const sp = Math.min(7, d)
        const nx = a.x + (dx / d) * sp
        const ny = a.y + (dy / d) * sp
        if (!this.clearAt(nx, ny)) stop()
        else {
          a.x = nx
          a.y = ny
          a.air = false
          a.face = dx > 0 ? 1 : -1
        }
      }
    }
    if (this.phase === 'dig' && this.drill) {
      const dr = this.drill
      dr.t++
      const nx = a.x + dr.dx * 1.6
      const ny = a.y + dr.dy * 1.6
      const cy = ny - 17
      let touched = false
      for (let yy = (cy - 16) | 0; yy <= cy + 16 && !touched; yy += 4)
        for (let xx = (nx - 16) | 0; xx <= nx + 16; xx += 4)
          if (this.solid(xx, yy)) {
            touched = true
            break
          }
      if (touched) {
        dr.air = 0
        this.carve(nx, cy, 17, false)
        if (dr.t % 7 === 0) this.fx.push({ t: 'dig', x: nx, y: cy })
      } else dr.air++
      a.x = nx
      a.y = ny
      a.air = false
      for (const o of this.animals) {
        if (!o.alive || o === a || dr.hit.has(o.id)) continue
        const ddx = o.x - nx
        const ddy = o.y - ny
        if (ddx * ddx + ddy * ddy < 26 * 26) {
          dr.hit.add(o.id)
          this.hurt(o, DAMAGE.drill)
          o.vx = dr.dx * 1.6 + Math.sign(ddx || 1) * 0.8
          o.vy = -1.8
          o.air = true
          o.slide = 0
        }
      }
      if (dr.t >= 100 || dr.air > 12 || ny > this.water || nx < 10 || nx > W - 10) {
        a.air = true
        a.vx = 0
        a.vy = 0
        this.drill = null
        this.toFlying()
      }
    }
    if (this.hammerT > 0) {
      this.hammerT++
      if (this.hammerT === 10) {
        let any = false
        for (const o of this.animals) {
          if (!o.alive || o === a) continue
          const dx = (o.x - a.x) * a.face
          const dy = o.y - a.y
          if (dx > -6 && dx < 42 && Math.abs(dy) < 34) {
            any = true
            this.hurt(o, DAMAGE.hammer)
            o.vx = a.face * 2.2
            o.vy = -2.8
            o.air = true
            o.slide = 0
            this.fx.push({ t: 'say', x: o.x, y: o.y - 80, text: '뿅!', color: '#ffd23f' })
          }
        }
        if (any) this.fx.push({ t: 'boing' })
        else this.fx.push({ t: 'whiff' }, { t: 'say', x: a.x + a.face * 30, y: a.y - 64, text: '허공', color: '#fff' })
      }
      if (this.hammerT > 24) this.hammerT = 0
    }
    if (this.gull) {
      const g = this.gull
      g.x += g.dir * 7
      const rel = (g.x - g.tx) * g.dir
      if (g.dropped < 5 && rel > -80 + g.dropped * 40) {
        this.projs.push({ kind: 'egg', x: g.x, y: g.y + 14, vx: 0, vy: 0.5, t: 20, owner: -1, dead: false })
        g.dropped++
      }
      if (g.x < -100 || g.x > W + 100) this.gull = null
    }
    for (const o of this.animals) {
      if ((this.phase === 'reel' || this.phase === 'dig') && o === a) continue
      this.stepAnimal(o)
      if (o.alive && o.hp <= 0) {
        o.alive = false
        this.fx.push({ t: 'ko', x: o.x, y: o.y }, { t: 'say', x: o.x, y: o.y - 50, text: '기절!', color: '#fff' })
      }
    }
    this.stepCrates()
    for (const p of this.projs) this.stepProj(p)
    this.projs = this.projs.filter((p) => !p.dead)
    if (this.phase === 'flying') {
      this.settleT = this.settled() ? this.settleT + 1 : 0
      if (this.settleT > SETTLE_STEPS && !this.flooded && this.turnNo >= FLOOD_ROUNDS * this.sides) {
        // 후반: 차례가 끝날 때마다 바닷물이 차오름 → 잠긴 동물은 탈락
        this.flooded = true
        this.water = Math.max(240, this.water - FLOOD_STEP)
        this.fx.push({ t: 'flood' }, { t: 'say', x: this.active.x, y: this.water - 60, text: '바닷물이 차올라요!', color: '#9be7ff' })
        for (const o of this.animals) if (o.alive) this.drown(o)
        this.settleT = 0
      }
      if (this.settleT > SETTLE_STEPS) {
        const left = this.sidesLeft()
        if (left.length <= 1) {
          this.winner = left[0] ?? 'draw'
          this.phase = 'over'
          this.fx.push({ t: 'win' })
          return
        }
        this.startTurn(false)
      }
    }
    if (this.phase === 'aim' && !a.alive) this.toFlying()
  }
}
