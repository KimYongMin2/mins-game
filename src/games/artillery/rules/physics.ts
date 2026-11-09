// 포격전 물리: 지형(높이 한 줄), 포탄 궤적(중력 + 바람), 폭발(땅 파임 + 피해), 떨어짐. 모두 순수 함수.
import type { Rng } from '../../../shared/random'
import {
  BARREL,
  COLS,
  CRATER_R,
  DAMAGE_R,
  FALL_DAMAGE,
  FALL_SAFE,
  FLOOR,
  GRAVITY,
  MAX_DAMAGE,
  MAX_FLIGHT_S,
  MAX_SPEED,
  OUT_MARGIN,
  STEP,
  TANK_CY,
  TANK_R,
  TERRAIN_MAX,
  TERRAIN_MIN,
  WORLD_W,
} from '../constants'

export type Vec = { x: number; y: number }
/** 지형: x = 0, 1, … COLS 자리의 땅 높이 */
export type Terrain = number[]

/** 언덕 지형: 크기가 다른 물결 몇 개를 겹친다 */
export function makeTerrain(rng: Rng): Terrain {
  const waves = [
    { amp: 16 + rng.next() * 10, len: 120 + rng.next() * 80, phase: rng.next() * Math.PI * 2 },
    { amp: 7 + rng.next() * 6, len: 45 + rng.next() * 25, phase: rng.next() * Math.PI * 2 },
    { amp: 2 + rng.next() * 3, len: 14 + rng.next() * 8, phase: rng.next() * Math.PI * 2 },
  ]
  const base = 38 + rng.next() * 14
  return Array.from({ length: COLS + 1 }, (_, x) => {
    const h = waves.reduce((sum, w) => sum + w.amp * Math.sin((x / w.len) * Math.PI * 2 + w.phase), base)
    return Math.round(Math.min(TERRAIN_MAX, Math.max(TERRAIN_MIN, h)) * 10) / 10
  })
}

/** x 자리 땅 높이 (사이는 이어서). 맵 밖이면 가장자리 높이 */
export function heightAt(t: Terrain, x: number): number {
  const cx = Math.min(COLS, Math.max(0, x))
  const i = Math.min(COLS - 1, Math.floor(cx))
  const f = cx - i
  return t[i] * (1 - f) + t[i + 1] * f
}

/** 대포가 땅 기울기를 따라 기운 각도 (라디안, + = 오른쪽이 높음). 바퀴 띠 양끝의 땅 높이로 잰다 */
const TILT_SPAN = 5
const TILT_MAX = (40 * Math.PI) / 180
export function tankTilt(t: Terrain, x: number): number {
  const a = Math.atan2(heightAt(t, x + TILT_SPAN) - heightAt(t, x - TILT_SPAN), TILT_SPAN * 2)
  return Math.max(-TILT_MAX, Math.min(TILT_MAX, a))
}

/** 대포 몸(포탑) 가운데: 땅에 닿은 곳에서 기운 방향으로 TANK_CY 위 */
export const tankCenter = (t: Terrain, x: number): Vec => {
  const tilt = tankTilt(t, x)
  return { x: x - Math.sin(tilt) * TANK_CY, y: heightAt(t, x) + Math.cos(tilt) * TANK_CY }
}

/** 땅을 둥글게 판다 (원 아래쪽까지 깎임) */
export function carve(t: Terrain, c: Vec, r = CRATER_R): Terrain {
  const out = t.slice()
  for (let i = Math.max(0, Math.ceil(c.x - r)); i <= Math.min(COLS, Math.floor(c.x + r)); i++) {
    const bottom = c.y - Math.sqrt(Math.max(0, r * r - (i - c.x) ** 2))
    if (out[i] > bottom) out[i] = Math.max(0, Math.round(bottom * 10) / 10)
  }
  return out
}

export type ShotTank = { x: number; alive: boolean }

export type Shot = {
  /** 날아간 길 (2스텝마다 한 점, 마지막은 터진 곳) */
  path: Vec[]
  /** 난 시간 (스텝 수) */
  steps: number
  /** 터진 곳. 화면 밖으로 나가 빗나갔으면 null */
  impact: Vec | null
  /** 대포에 바로 맞았으면 그 사람 */
  direct: number | null
}

/** 포구: 대포 가운데에서 포신 길이만큼 각도 쪽으로 */
export function muzzle(t: Terrain, x: number, angleDeg: number): Vec {
  const c = tankCenter(t, x)
  const a = (angleDeg * Math.PI) / 180
  return { x: c.x + Math.cos(a) * BARREL, y: c.y + Math.sin(a) * BARREL }
}

/** 포탄 궤적: 각도(0 = 오른쪽, 90 = 위, 180 = 왼쪽), 힘(0~100), 바람(+ = 오른쪽으로 미는 가속도) */
export function simulateShot(t: Terrain, tanks: ShotTank[], shooter: number, angleDeg: number, power: number, wind: number, maxSteps = Math.round(MAX_FLIGHT_S / STEP)): Shot {
  const a = (angleDeg * Math.PI) / 180
  const speed = (power / 100) * MAX_SPEED
  let { x, y } = muzzle(t, tanks[shooter].x, angleDeg)
  let vx = Math.cos(a) * speed
  let vy = Math.sin(a) * speed
  const path: Vec[] = [{ x, y }]
  const centers = tanks.map((k) => (k.alive ? tankCenter(t, k.x) : null))
  for (let step = 1; step <= maxSteps; step++) {
    vx += wind * STEP
    vy -= GRAVITY * STEP
    x += vx * STEP
    y += vy * STEP
    // 대포에 바로 맞음 (쏜 사람은 포탄이 포구를 벗어난 뒤부터)
    for (let i = 0; i < centers.length; i++) {
      const c = centers[i]
      if (!c || (i === shooter && step < 12)) continue
      if (Math.hypot(x - c.x, y - c.y) <= TANK_R) {
        path.push({ x, y })
        return { path, steps: step, impact: { x, y }, direct: i }
      }
    }
    // 땅에 닿음
    if (x >= 0 && x <= WORLD_W && y <= heightAt(t, x)) {
      const impact = { x, y: heightAt(t, x) }
      path.push(impact)
      return { path, steps: step, impact, direct: null }
    }
    // 화면 밖으로 멀리 (위로는 얼마든지 올라갔다 내려올 수 있다)
    if (x < -OUT_MARGIN || x > WORLD_W + OUT_MARGIN || y < -OUT_MARGIN) {
      path.push({ x, y })
      return { path, steps: step, impact: null, direct: null }
    }
    if (step % 2 === 0) path.push({ x, y })
  }
  return { path, steps: maxSteps, impact: null, direct: null }
}

/** 폭발 피해: 가운데에서 멀수록 줄어든다 (DAMAGE_R 밖은 0) */
export function blastDamage(impact: Vec, center: Vec): number {
  const d = Math.hypot(impact.x - center.x, impact.y - center.y)
  return d >= DAMAGE_R ? 0 : Math.round(MAX_DAMAGE * (1 - d / DAMAGE_R))
}

export type Blast = {
  terrain: Terrain
  /** 사람별 피해 (폭발 + 떨어짐) */
  damage: number[]
  /** 바닥까지 떨어진 사람 (체력과 상관없이 탈락) */
  fell: number[]
}

/** 터짐: 피해를 주고 땅을 판 뒤, 발밑이 꺼진 대포는 떨어진다 */
export function explode(t: Terrain, tanks: ShotTank[], impact: Vec): Blast {
  const damage = tanks.map((k) => (k.alive ? blastDamage(impact, tankCenter(t, k.x)) : 0))
  const terrain = carve(t, impact)
  const fell: number[] = []
  tanks.forEach((k, i) => {
    if (!k.alive) return
    const before = heightAt(t, k.x)
    const after = heightAt(terrain, k.x)
    if (after <= FLOOR) fell.push(i)
    const drop = before - after
    if (drop > FALL_SAFE) damage[i] += Math.round((drop - FALL_SAFE) * FALL_DAMAGE)
  })
  return { terrain, damage, fell }
}
