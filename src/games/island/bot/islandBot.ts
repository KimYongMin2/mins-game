import { createRng, type Rng } from '../../../shared/random'
import { CHARGE_STEPS, DAMAGE, G, PINE_FUSE, W, type WeaponId } from '../constants'
import { type Face, type Proj, EGG_G, WIND_ACCEL, type World, blastDamage, blastOf, throwSpeed } from '../play/world'

// 봇: 물풍선·솔방울을 여러 각도·힘으로 미리 던져 보고(땅·바람 포함) 상대에게 가장 아프고 우리 편은 덜 아픈 걸 고른 뒤
// 손 떨림만큼 흔든다. 바로 앞에 상대가 있으면 가끔 뿅망치, 마땅한 게 없으면 갈매기.

export type BotLevel = 'normal' | 'hard'
export type BotPlan = { weapon: WeaponId; face: Face; aim: number; power: number; target: number }

const SHAKE: Record<BotLevel, { aim: number; power: number }> = {
  normal: { aim: 5, power: 0.06 },
  hard: { aim: 1.4, power: 0.018 },
}

/** 던지면 어디서 터지는지 (바다·밖이면 null) */
export function simulateShot(w: World, kind: Proj['kind'], x: number, y: number, vx: number, vy: number, ownerId: number): { x: number; y: number } | null {
  for (let t = 1; t < 900; t++) {
    if (kind === 'balloon') vx += w.wind * WIND_ACCEL
    vy += kind === 'egg' ? EGG_G : G
    const n = Math.ceil(Math.max(Math.abs(vx), Math.abs(vy)) / 1.5) || 1
    for (let s = 0; s < n; s++) {
      const px = x
      const py = y
      x += vx / n
      y += vy / n
      let hitAnimal = false
      if (kind !== 'pine')
        for (const a of w.animals) {
          if (!a.alive || (a.id === ownerId && t < 16)) continue
          const dx = a.x - x
          const dy = a.y - 18 - y
          if (dx * dx + dy * dy < 19 * 19) hitAnimal = true
        }
      if (w.solid(x, y) || hitAnimal) {
        if (kind === 'pine' && !hitAnimal) {
          if (w.solid(x, py)) vx = -vx * 0.5
          else {
            vy = -vy * 0.42
            vx *= 0.8
          }
          x = px
          y = py
          break
        }
        return { x, y }
      }
      if (y > w.water || x < -400 || x > W + 400) return null
    }
    if (kind === 'pine' && t >= PINE_FUSE) return { x, y }
  }
  return null
}

/** 그 자리에서 터지면 (상대 피해 − 우리 편 피해 × 1.5) */
function scoreAt(w: World, kind: Proj['kind'], x: number, y: number) {
  const { r, dmg } = blastOf(kind)
  let s = 0
  for (const a of w.animals) {
    if (!a.alive) continue
    const d = Math.hypot(a.x - x, a.y - 18 - y)
    const hurt = Math.min(a.hp, blastDamage(r, dmg, d))
    s += a.team === w.active.team ? -hurt * 1.5 : hurt
  }
  return s
}

export function planTurn(w: World, level: BotLevel, rng: Rng): BotPlan {
  const me = w.active
  const foes = w.animals.filter((a) => a.alive && a.team !== me.team)
  const near = foes.find((f) => Math.abs(f.x - me.x) < 38 && Math.abs(f.y - me.y) < 30)
  if (near && rng.next() < 0.7) return { weapon: 'hammer', face: near.x < me.x ? -1 : 1, aim: 30, power: 0, target: 0 }

  let best: BotPlan | null = null
  let bestScore = 0
  /** 아무도 안 다치게 바다에 버리는 수 (쓸 게 없을 때) */
  let pass: BotPlan | null = null
  for (const kind of (['balloon', 'pine'] as const).filter((k) => w.ammoLeft(k) !== 0))
    for (const face of [-1, 1] as const)
      for (let aim = -20; aim <= 85; aim += 5)
        for (let p = 0.2; p <= 1.001; p += 0.05) {
          const r = (aim * Math.PI) / 180
          const dx = Math.cos(r) * face
          const dy = -Math.sin(r)
          const v = throwSpeed(p)
          const hit = simulateShot(w, kind, me.x + dx * 18, me.y - 20 + dy * 18, dx * v, dy * v, me.id)
          if (!hit) {
            if (!pass && kind === 'balloon') pass = { weapon: kind, face, aim, power: p, target: 0 }
            continue
          }
          // 솔방울은 맞히기 어려워 실제로는 덜 맞음 → 조금 깎아서 비교
          const s = scoreAt(w, kind, hit.x, hit.y) * (kind === 'pine' ? 0.8 : 1)
          if (s > bestScore) {
            bestScore = s
            best = { weapon: kind, face, aim, power: p, target: 0 }
          }
        }
  if ((!best || bestScore < DAMAGE.egg) && w.ammoLeft('gull') !== 0) {
    const t = foes[Math.floor(rng.next() * foes.length)] ?? me
    return { weapon: 'gull', face: me.face, aim: w.aim, power: 0, target: t.x }
  }
  if (!best) return pass ?? { weapon: 'balloon', face: me.face, aim: 60, power: 0.5, target: 0 }
  const sh = SHAKE[level]
  best.aim = Math.max(-60, Math.min(88, best.aim + (rng.next() * 2 - 1) * sh.aim))
  best.power = Math.max(0.05, Math.min(1, best.power + (rng.next() * 2 - 1) * sh.power))
  return best
}

/** 봇 차례를 화면처럼 천천히: 생각 → 돌아서기·조준 → 힘 모으기 → 던지기 */
export class BotDriver {
  private plan: BotPlan | null = null
  private turn = -1
  private wait = 0
  private rng: Rng
  private level: BotLevel
  constructor(level: BotLevel, seed: number) {
    this.level = level
    this.rng = createRng(seed)
  }

  step(w: World) {
    if (!w.canAct()) return
    if (this.turn !== w.turnNo) {
      this.turn = w.turnNo
      this.plan = null
      this.wait = 50
    }
    if (this.wait > 0) {
      this.wait--
      return
    }
    if (!this.plan) {
      this.plan = planTurn(w, this.level, this.rng)
      w.pick(this.plan.weapon)
      w.active.face = this.plan.face
      this.wait = 20
      return
    }
    const p = this.plan
    if (p.weapon === 'gull') {
      w.setTarget(p.target)
      w.fire()
      return
    }
    if (p.weapon === 'hammer') {
      w.fire()
      return
    }
    if (Math.abs(w.aim - p.aim) > 1.2) {
      w.aim += Math.sign(p.aim - w.aim) * 1.2
      return
    }
    w.aim = p.aim
    if (!w.charging) w.press()
    else if (w.chargeT >= p.power * CHARGE_STEPS) w.fire(p.power)
  }
}
