import type { Zone } from './fish'

// 낚시터 맵 (미터, 위에서 보면 x = 오른쪽, z = 아래쪽(카메라 쪽)). 서버 심판과 화면이 같이 써서 '물가인지'가 똑같다.
// 위(북쪽, z가 작음)가 바다 — 물가선이 살짝 물결 모양, 왼쪽에 나무 부두. 오른쪽(x ≥ 12)은 풀밭과 개울·연못(민물).

export const BOUNDS = { minX: -28, maxX: 28, minZ: -18, maxZ: 16 }
/** 바다가 끝나는 곳 (여기부터 오른쪽은 풀밭) */
export const SEA_EAST = 12
export const shoreZ = (x: number) => -6 + Math.sin(x * 0.25) * 1
export const PIER = { minX: -15, maxX: -12, minZ: -17 }
export const POND = { x: 19, z: 6, r: 4.5 }
export const STREAM = { ax: 24, az: -18, bx: 21, bz: 2, half: 1.3 }
/** 걷는 빠르기 (m/s) */
export const WALK_SPEED = 5
/** 물가에서 이만큼 안이면 던질 수 있음 */
export const CAST_REACH = 3.2
/** 썬베드에 이만큼 가까우면 누울 수 있음 */
export const BED_REACH = 2

export type Bed = { x: number; z: number; r: number }
/** 썬베드: 바닷가 물가를 따라 4개(바다 쪽을 봄) + 연못가 1개 */
export const BEDS: Bed[] = [
  ...[-7, -3, 1, 5].map((x) => ({ x, z: shoreZ(x) + 2.4, r: Math.PI })),
  { x: 13.4, z: 9.5, r: Math.atan2(POND.x - 13.4, POND.z - 9.5) },
]
export const SPAWN = { x: 0, z: 5 }

const onPier = (x: number, z: number) => x >= PIER.minX && x <= PIER.maxX && z >= PIER.minZ && z <= shoreZ(x) + 0.5

function streamDist(x: number, z: number) {
  const { ax, az, bx, bz } = STREAM
  const dx = bx - ax, dz = bz - az
  const t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz)))
  return Math.hypot(x - (ax + dx * t), z - (az + dz * t))
}

/** 이 자리 물 (바다·민물), 땅이면 null */
export function waterAt(x: number, z: number): Zone | null {
  if (Math.hypot(x - POND.x, z - POND.z) < POND.r || streamDist(x, z) < STREAM.half) return 'fresh'
  if (x < SEA_EAST && z < shoreZ(x) && !onPier(x, z)) return 'sea'
  if (z < BOUNDS.minZ) return 'sea'
  return null
}

/** 걸을 수 있는 곳 (맵 안 + 물이 아님 — 부두 위는 됨) */
export function walkable(x: number, z: number): boolean {
  if (x < BOUNDS.minX || x > BOUNDS.maxX || z > BOUNDS.maxZ) return false
  if (onPier(x, z)) return true
  if (z < BOUNDS.minZ) return false
  return waterAt(x, z) === null
}

/** 한 번 움직이기: 막히면 가로·세로 따로 미끄러지기 */
export function moveBy(x: number, z: number, dx: number, dz: number): { x: number; z: number } {
  if (walkable(x + dx, z + dz)) return { x: x + dx, z: z + dz }
  if (walkable(x + dx, z)) return { x: x + dx, z }
  if (walkable(x, z + dz)) return { x, z: z + dz }
  return { x, z }
}

/**
 * 던질 곳 (r = 바라보는 방향, 앞이 (sin r, cos r)). 바라보는 쪽부터 양옆으로 넓혀 가며 가까운 물을 찾고,
 * 찌는 물가에서 조금 더 안쪽에 떨어진다. 물이 없으면 null
 */
export function castTarget(x: number, z: number, r: number, reach = CAST_REACH): { zone: Zone; bob: [number, number]; r: number } | null {
  for (let k = 0; k <= 8; k++) {
    for (const side of k === 0 ? [0] : [1, -1]) {
      const a = r + side * k * (Math.PI / 16)
      const dx = Math.sin(a), dz = Math.cos(a)
      for (let s = 0.3; s <= reach; s += 0.15) {
        const zone = waterAt(x + dx * s, z + dz * s)
        if (!zone) continue
        // 물가에서 더 안쪽으로 (같은 물인 곳까지만)
        let far = s
        for (let e = s; e <= s + 3; e += 0.25) if (waterAt(x + dx * e, z + dz * e) === zone) far = e
        const d = Math.min(far, s + 2.2)
        return { zone, bob: [round(x + dx * d), round(z + dz * d)], r: a }
      }
    }
  }
  return null
}

/** 가장 가까운 썬베드 (거리 안이면) */
export function nearBed(x: number, z: number): number | null {
  let best: number | null = null
  let bestD = BED_REACH
  BEDS.forEach((b, i) => {
    const d = Math.hypot(b.x - x, b.z - z)
    if (d < bestD) {
      bestD = d
      best = i
    }
  })
  return best
}

const round = (v: number) => Math.round(v * 100) / 100
