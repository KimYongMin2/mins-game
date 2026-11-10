// 탱크 대전 물리: 지형(높이 한 줄), 포탄 궤적(중력 + 바람), 폭발(땅 파임 + 피해), 떨어짐. 모두 순수 함수.
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

/**
 * 지형 모양 (판마다 무작위, 사용자 요청 — 처음엔 늘 물결 언덕이라 비슷해 보였음):
 * 언덕(물결) · 큰 산(가운데 높은 봉우리) · 골짜기(양끝 높고 가운데 낮음) · 쌍봉 · 고원(평평한 대지 몇 개) · 울퉁불퉁
 */
export const TERRAIN_SHAPES = ['hills', 'mountain', 'valley', 'twin', 'mesa', 'rough'] as const
export type TerrainShape = (typeof TERRAIN_SHAPES)[number]
/** 땅 색·하늘 (판마다 무작위): 풀밭 · 사막 · 눈밭 · 노을 · 밤 */
export const LAND_THEMES = ['grass', 'desert', 'snow', 'sunset', 'night'] as const
export type LandTheme = (typeof LAND_THEMES)[number]
export type Land = { shape: TerrainShape; theme: LandTheme }

const pickOf = <T,>(rng: Rng, list: readonly T[]): T => list[Math.floor(rng.next() * list.length) % list.length]
const smooth = (e0: number, e1: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)))
  return t * t * (3 - 2 * t)
}

/** 판 하나의 땅: 모양·색을 고르고 지형을 만든다 */
export function makeLand(rng: Rng): { land: Land; terrain: Terrain } {
  const shape = pickOf(rng, TERRAIN_SHAPES)
  const theme = pickOf(rng, LAND_THEMES)
  return { land: { shape, theme }, terrain: makeTerrain(rng, shape) }
}

/** 지형: 모양마다 큰 틀을 잡고, 크기가 다른 물결을 겹쳐 자연스럽게 */
export function makeTerrain(rng: Rng, shape: TerrainShape = 'hills'): Terrain {
  const wave = (amp: number, len: number) => ({ amp, len, phase: rng.next() * Math.PI * 2 })
  const big = shape === 'hills' ? 16 + rng.next() * 10 : shape === 'rough' ? 10 + rng.next() * 6 : 4 + rng.next() * 4
  const waves = [
    wave(big, 120 + rng.next() * 80),
    wave(shape === 'rough' ? 10 + rng.next() * 5 : shape === 'mesa' ? 1.5 : 5 + rng.next() * 5, 45 + rng.next() * 25),
    wave(shape === 'rough' ? 4 + rng.next() * 3 : 2 + rng.next() * 3, 14 + rng.next() * 8),
  ]
  const W = COLS
  let frame: (x: number) => number
  switch (shape) {
    case 'mountain': {
      const c = W / 2 + (rng.next() - 0.5) * 40
      const height = 34 + rng.next() * 12
      const width = 22 + rng.next() * 14
      const base = 26 + rng.next() * 8
      frame = (x) => base + height * Math.exp(-(((x - c) / width) ** 2))
      break
    }
    case 'valley': {
      const edge = 62 + rng.next() * 12
      const low = 22 + rng.next() * 8
      frame = (x) => low + (edge - low) * (Math.abs(x / W - 0.5) * 2) ** 1.6
      break
    }
    case 'twin': {
      const base = 26 + rng.next() * 6
      const peaks = [W * (0.3 + (rng.next() - 0.5) * 0.08), W * (0.7 + (rng.next() - 0.5) * 0.08)]
      const hs = [26 + rng.next() * 14, 26 + rng.next() * 14]
      const width = 16 + rng.next() * 8
      frame = (x) => base + peaks.reduce((sum, c, i) => sum + hs[i] * Math.exp(-(((x - c) / width) ** 2)), 0)
      break
    }
    case 'mesa': {
      // 높이가 다른 평평한 대지 3~4개, 사이는 부드러운 비탈
      const n = 3 + Math.floor(rng.next() * 2)
      const levels = Array.from({ length: n }, () => 26 + rng.next() * 40)
      const seg = W / n
      frame = (x) => {
        const i = Math.min(n - 1, Math.floor(x / seg))
        const local = x - i * seg
        let h = levels[i]
        if (i > 0) h += (levels[i - 1] - levels[i]) * (1 - smooth(0, 9, local))
        return h
      }
      break
    }
    default: {
      const base = 38 + rng.next() * 14
      frame = () => base
    }
  }
  return Array.from({ length: W + 1 }, (_, x) => {
    const h = waves.reduce((sum, w) => sum + w.amp * Math.sin((x / w.len) * Math.PI * 2 + w.phase), frame(x))
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

/** 대포가 땅에 얹힌 모습: 기울기와, 바퀴 띠 밑면이 x 자리에서 있는 높이.
 *  바퀴 띠(기운 직선)가 그 아래 땅 어디에도 파묻히지 않게 가장 높이 닿는 곳에 얹는다
 *  (언덕 꼭대기에선 꼭대기에 올라타고, 골짜기에선 양쪽 가장자리에 걸침) */
export function tankPose(t: Terrain, x: number): { y: number; tilt: number } {
  const tilt = tankTilt(t, x)
  const k = Math.tan(tilt)
  let y = heightAt(t, x)
  for (let dx = -TILT_SPAN; dx <= TILT_SPAN; dx += 0.5) y = Math.max(y, heightAt(t, x + dx) - dx * k)
  return { y, tilt }
}

/** 대포 몸(포탑) 가운데: 땅에 얹힌 곳에서 기운 방향으로 TANK_CY 위 */
export const tankCenter = (t: Terrain, x: number): Vec => {
  const { y, tilt } = tankPose(t, x)
  return { x: x - Math.sin(tilt) * TANK_CY, y: y + Math.cos(tilt) * TANK_CY }
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
