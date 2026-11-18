import type { Zone } from './fish'

// 낚시터 맵 (미터, 위에서 보면 x = 오른쪽, z = 아래쪽(처음 카메라 쪽)). 서버 심판과 화면이 같이 써서 '물가인지'·'막혔는지'가 똑같다.
// 2026-11-18 넓힘 (사용자 요청 — 더 사실적이고 넓게, 구조물 많이): 가로 128m × 세로 86m.
//  - 북쪽(z가 작음): 바다. 물가선은 완만한 만, 왼쪽 끝에 바위 방파제 + 등대, 긴 나무 부두(끝은 넓은 낚시 자리), 가운데 작은 배 선착장
//  - 가운데: 모래사장(썬베드·파라솔·탈의실·인명구조 탑·캠프파이어) → 나무 산책로
//  - 남쪽: 작은 마을(낚시 가게·집·분수 광장·자판기·벤치·가로등)
//  - 동쪽(x ≥ 22): 풀밭·소나무 숲, 북쪽에서 내려오는 강(나무 다리) → 큰 호수(작은 나무 선착장·통나무집·피크닉 탁자)

export const BOUNDS = { minX: -64, maxX: 64, minZ: -40, maxZ: 46 }
/** 바다가 끝나는 곳 (여기부터 오른쪽은 풀밭) */
export const SEA_EAST = 22
export const shoreZ = (x: number) => -8 + Math.sin(x * 0.13) * 2.2 + Math.sin(x * 0.31 + 1) * 0.6

/** 걸을 수 있는 물 위 (부두·방파제·선착장·다리) — 네모 */
export type Rect = { minX: number; maxX: number; minZ: number; maxZ: number }
/** 긴 나무 부두 (몸통 + 끝의 넓은 자리) */
export const PIER: Rect = { minX: -34, maxX: -31, minZ: -34, maxZ: 0 }
export const PIER_END: Rect = { minX: -39, maxX: -26, minZ: -39, maxZ: -34 }
/** 바위 방파제 (끝에 등대) */
export const JETTY: Rect = { minX: -56, maxX: -51, minZ: -36, maxZ: 0 }
/** 가운데 작은 배 선착장 */
export const DOCK: Rect = { minX: 6, maxX: 8.5, minZ: -19, maxZ: 0 }

/** 호수와 강 (민물). 강은 꺾은선, 반폭 half */
export const LAKE = { x: 44, z: 24, r: 11 }
export const RIVER = { pts: [[47, -54], [42, -24], [35, -6], [37, 8], [41, 15]] as [number, number][], half: 2 }
/** 강 위 나무 다리 (동서로 건넘) */
export const BRIDGE: Rect = { minX: 30, maxX: 41, minZ: -9.2, maxZ: -6.2 }
/** 호수 나무 선착장 (서쪽 가에서 호수 안으로) */
export const LAKE_DOCK: Rect = { minX: 30, maxX: 37.5, minZ: 23, maxZ: 25.2 }
const WALK_ON_WATER: Rect[] = [PIER, PIER_END, JETTY, DOCK, BRIDGE, LAKE_DOCK]

/** 걷는 빠르기 (m/s) — 맵이 넓어져 5에서 6으로 */
export const WALK_SPEED = 6
/** 물가에서 이만큼 안이면 던질 수 있음 */
export const CAST_REACH = 3.2
/** 썬베드에 이만큼 가까우면 누울 수 있음 */
export const BED_REACH = 2

/**
 * 구조물 (그림과 막힘을 같이 정함). 막힘 모양: w·d가 있으면 네모(돌리지 않은 가로 w × 세로 d), 아니면 반지름 c 원(0이면 안 막힘).
 * r = 그림 방향(라디안), s = 크기 배율
 */
export type StructKind =
  | 'lighthouse' | 'shop' | 'house' | 'cabin' | 'hut' | 'tower' | 'fire' | 'palm' | 'pine' | 'tree' | 'rock'
  | 'boat' | 'table' | 'bench' | 'lamp' | 'fountain' | 'vending' | 'sign' | 'umbrella' | 'crate' | 'flag' | 'well'
export type Struct = { kind: StructKind; x: number; z: number; r?: number; s?: number; w?: number; d?: number; c?: number; color?: string; label?: string }

const S: Struct[] = [
  // 방파제 끝 등대
  { kind: 'lighthouse', x: -53.5, z: -33, c: 2.2 },
  // 마을
  { kind: 'shop', x: -14, z: 24, w: 8, d: 5.5, label: '낚시 가게' },
  { kind: 'house', x: 6, z: 34, w: 7, d: 6, color: '#e8473f' },
  { kind: 'house', x: 19, z: 33, w: 6, d: 6, color: '#3f8fd0' },
  { kind: 'house', x: -30, z: 33, w: 7, d: 6, color: '#2f9e6a' },
  { kind: 'house', x: -46, z: 30, w: 6.5, d: 6, color: '#c79bff' },
  { kind: 'fountain', x: -10, z: 37, c: 2.4 },
  { kind: 'vending', x: -8.6, z: 24, w: 1.1, d: 0.9 },
  { kind: 'well', x: 30, z: 38, c: 1.1 },
  // 모래사장
  ...[-46, -42, -38].map((x, i) => ({ kind: 'hut' as const, x, z: 9, w: 2.6, d: 2.6, color: ['#ff8a7a', '#7cc8ff', '#ffd23f'][i] })),
  { kind: 'tower', x: 14, z: 2.5, w: 2.2, d: 2.2 },
  { kind: 'fire', x: -20, z: 9, c: 1.4 },
  { kind: 'boat', x: -24, z: 4, r: 0.4, c: 1.6, color: '#e8473f' },
  { kind: 'boat', x: 18, z: 7, r: -0.3, c: 1.6, color: '#3f8fd0' },
  { kind: 'crate', x: -29.5, z: 2.5, w: 1.6, d: 1.2 },
  { kind: 'crate', x: 9.6, z: 1.6, w: 1.2, d: 1.2 },
  { kind: 'flag', x: 11.5, z: 3.5, c: 0.2 },
  // 산책로 벤치·가로등·표지판
  ...[-50, -36, -6, 4].map((x) => ({ kind: 'bench' as const, x, z: 17.8, w: 2, d: 0.8 })),
  ...[-56, -42, -28, -14, 0, 14].map((x) => ({ kind: 'lamp' as const, x, z: 15, c: 0.25 })),
  ...[-4, 8, 22, -24, 36].map((x, i) => ({ kind: 'lamp' as const, x, z: [28, 28, 26, 28, 30][i], c: 0.25 })),
  { kind: 'sign', x: 24, z: 16, c: 0.25, label: '← 바다 · 호수 →' },
  { kind: 'sign', x: -50, z: 4, c: 0.25, label: '등대 방파제' },
  // 호수 옆
  { kind: 'cabin', x: 57, z: 8, w: 6, d: 5 },
  ...[[50, 40], [56, 32], [28, 30]].map(([x, z]) => ({ kind: 'table' as const, x, z, w: 2, d: 1.6 })),
  { kind: 'boat', x: 34, z: 27, r: 1.2, c: 0, color: '#ffd23f' },
  // 야자수 (모래사장 뒤쪽)
  ...[[-58, 12], [-34, 12], [-27, 13], [-10, 12.5], [-2, 13], [10, 12], [17, 12.5], [-52, 8]].map(([x, z], i) => ({ kind: 'palm' as const, x, z, c: 0.45, s: 0.9 + (i % 3) * 0.15 })),
  // 소나무 숲 (동쪽·북동쪽)
  ...[[26, -36], [30, -30], [27, -22], [52, -34], [58, -26], [54, -16], [60, -6], [50, -2], [28, -14], [56, 2], [62, 16], [26, 2], [60, 44], [40, 42], [52, 44]].map(([x, z], i) => ({ kind: 'pine' as const, x, z, c: 0.8, s: 1 + (i % 4) * 0.18 })),
  // 둥근 나무 (마을)
  ...[[-56, 38], [-22, 42], [-2, 43], [12, 42], [28, 44], [-38, 42]].map(([x, z], i) => ({ kind: 'tree' as const, x, z, c: 0.6, s: 1 + (i % 3) * 0.2 })),
  // 바위
  ...[[23, -30, 1.6], [24, -18, 1.2], [23, -12, 1.4], [-60, -2, 1.5], [-48, 2, 1], [48, 12, 0.9], [62, 30, 1.3], [-20, 1, 0.7]].map(([x, z, s]) => ({ kind: 'rock' as const, x, z, c: s * 0.9, s })),
  // 파라솔 (그림만, 안 막힘) — 썬베드 사이
  ...[-17, -9, -1, 3].map((x, i) => ({ kind: 'umbrella' as const, x: x - 2, z: shoreZ(x - 2) + 1.4, c: 0, color: ['#e8473f', '#3f8fd0', '#ffd23f', '#2f9e6a'][i] })),
]
export const STRUCTS: readonly Struct[] = S

export type Bed = { x: number; z: number; r: number }
/** 썬베드: 바닷가 물가를 따라 8개(바다 쪽을 봄) + 호숫가 2개 + 부두 끝 1개 */
export const BEDS: Bed[] = [
  ...[-21, -17, -13, -9, -5, -1, 3, 16].map((x) => ({ x, z: shoreZ(x) + 2.4, r: Math.PI })),
  ...[[LAKE.x - 2, LAKE.z + LAKE.r + 2.2], [LAKE.x + 9, LAKE.z + 9]].map(([x, z]) => ({ x, z, r: Math.atan2(LAKE.x - x, LAKE.z - z) })),
  { x: -28, z: -36.2, r: Math.PI },
]
export const SPAWN = { x: 0, z: 9 }

const inRect = (x: number, z: number, b: Rect) => x >= b.minX && x <= b.maxX && z >= b.minZ && z <= b.maxZ
const onBoards = (x: number, z: number) => WALK_ON_WATER.some((b) => inRect(x, z, b))

function riverDist(x: number, z: number) {
  let best = Infinity
  const p = RIVER.pts
  for (let i = 0; i < p.length - 1; i++) {
    const [ax, az] = p[i], [bx, bz] = p[i + 1]
    const dx = bx - ax, dz = bz - az
    const t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz)))
    best = Math.min(best, Math.hypot(x - (ax + dx * t), z - (az + dz * t)))
  }
  return best
}

/** 이 자리 물 (바다·민물), 땅이면 null (부두·다리 아래도 물) */
export function waterAt(x: number, z: number): Zone | null {
  if (Math.hypot(x - LAKE.x, z - LAKE.z) < LAKE.r || riverDist(x, z) < RIVER.half) return 'fresh'
  if (x < SEA_EAST && z < shoreZ(x)) return 'sea'
  if (x < SEA_EAST && z < BOUNDS.minZ) return 'sea'
  return null
}

/** 구조물에 막히는지 (사람 반지름 0.35 포함) */
export function blocked(x: number, z: number): boolean {
  const R = 0.35
  for (const s of S) {
    if (s.w && s.d) {
      if (Math.abs(x - s.x) < s.w / 2 + R && Math.abs(z - s.z) < s.d / 2 + R) return true
    } else if (s.c && Math.hypot(x - s.x, z - s.z) < s.c + R) return true
  }
  return false
}

/** 걸을 수 있는 곳 (맵 안 + 물이 아님(부두·다리 위는 됨) + 구조물이 아님) */
export function walkable(x: number, z: number): boolean {
  if (x < BOUNDS.minX || x > BOUNDS.maxX || z > BOUNDS.maxZ || z < BOUNDS.minZ) return false
  if (blocked(x, z)) return false
  if (onBoards(x, z)) return true
  return waterAt(x, z) === null
}

/** 판자·바위 위 높이 (그림용) */
export function groundY(x: number, z: number): number {
  if (inRect(x, z, JETTY) && waterAt(x, z)) return 0.45
  if (inRect(x, z, BRIDGE)) return 0.35
  return onBoards(x, z) && waterAt(x, z) ? 0.21 : 0
}

/** 한 번 움직이기: 막히면 가로·세로 따로 미끄러지기 */
export function moveBy(x: number, z: number, dx: number, dz: number): { x: number; z: number } {
  if (walkable(x + dx, z + dz)) return { x: x + dx, z: z + dz }
  if (walkable(x + dx, z)) return { x: x + dx, z }
  if (walkable(x, z + dz)) return { x, z: z + dz }
  return { x, z }
}

/** 던질 수 있는 물 (판자·다리 바로 밑은 빼고 — 찌가 판자 위에 떨어지지 않게) */
const castWater = (x: number, z: number): Zone | null => (onBoards(x, z) ? null : waterAt(x, z))

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
        const zone = castWater(x + dx * s, z + dz * s)
        if (!zone) continue
        // 물가에서 더 안쪽으로 (같은 물인 곳까지만)
        let far = s
        for (let e = s; e <= s + 3; e += 0.25) if (castWater(x + dx * e, z + dz * e) === zone) far = e
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
