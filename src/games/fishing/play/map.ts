import type { Zone } from './fish'

// 낚시터 맵 (미터, 위에서 보면 x = 오른쪽, z = 아래쪽(처음 카메라 쪽)). 서버 심판과 화면이 같이 써서 '물가인지'·'막혔는지'가 똑같다.
// 2026-11-18 넓힘 (사용자 요청 — 더 사실적이고 넓게, 구조물 많이): 가로 128m × 세로 86m.
//  - 북쪽(z가 작음): 바다. 물가선은 완만한 만, 왼쪽 끝에 바위 방파제 + 등대, 긴 나무 부두(끝은 넓은 낚시 자리), 가운데 작은 배 선착장
//  - 가운데: 모래사장(썬베드·파라솔·탈의실·인명구조 탑·캠프파이어) → 나무 산책로
//  - 남쪽: 작은 마을(낚시 가게·집·분수 광장·자판기·벤치·가로등)
//  - 동쪽(x ≥ 22): 풀밭·소나무 숲, 북쪽에서 내려오는 강(나무 다리) → 큰 호수(작은 나무 선착장·통나무집·피크닉 탁자)

// 2026-11-19 더 넓힘 (사용자 요청): 200 × 120m — 서쪽 작은 만(둘째 부두·바닷가 가게), 동쪽 숲·캠핑장, 남쪽 밭·풍차·헛간·과수원
export const BOUNDS = { minX: -100, maxX: 100, minZ: -40, maxZ: 80 }
/** 바다가 끝나는 곳 (여기부터 오른쪽은 풀밭) */
export const SEA_EAST = 22
export const shoreZ = (x: number) => -8 + Math.sin(x * 0.13) * 2.2 + Math.sin(x * 0.31 + 1) * 0.6

/** 걸을 수 있는 물 위 (부두·방파제·선착장·다리) — 네모 */
export type Rect = { minX: number; maxX: number; minZ: number; maxZ: number }
/** 긴 나무 부두 (몸통 + 끝의 넓은 자리) */
export const PIER: Rect = { minX: -34, maxX: -31, minZ: -34, maxZ: 0 }
export const PIER_END: Rect = { minX: -39, maxX: -26, minZ: -39, maxZ: -34 }
/** 서쪽 만의 둘째 나무 부두 (끝은 T자 낚시 자리) */
export const PIER2: Rect = { minX: -83, maxX: -80.5, minZ: -26, maxZ: 0 }
export const PIER2_END: Rect = { minX: -88, maxX: -75.5, minZ: -30, maxZ: -26 }
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
const WALK_ON_WATER: Rect[] = [PIER, PIER_END, PIER2, PIER2_END, JETTY, DOCK, BRIDGE, LAKE_DOCK]

/** 걷는 빠르기 (m/s) — 맵이 넓어져 5에서 6으로 */
export const WALK_SPEED = 6
/** 달리기 (Shift · 폰은 [달리기]) */
export const RUN_SPEED = 9.5
/** 물가에서 이만큼 안이면 던질 수 있음 */
export const CAST_REACH = 3.2
/** 썬베드에 이만큼 가까우면 누울 수 있음 */
export const BED_REACH = 2

/**
 * 구조물 (그림과 막힘을 같이 정함). 막힘 모양: w·d가 있으면 네모(돌리지 않은 가로 w × 세로 d), 아니면 반지름 c 원(0이면 안 막힘).
 * r = 그림 방향(라디안), s = 크기 배율
 */
export type StructKind =
  | 'lighthouse' | 'house' | 'cabin' | 'hut' | 'tower' | 'fire' | 'palm' | 'pine' | 'tree' | 'rock'
  | 'boat' | 'table' | 'bench' | 'lamp' | 'fountain' | 'vending' | 'sign' | 'umbrella' | 'crate' | 'flag' | 'well'
  | 'tent' | 'barn' | 'windmill' | 'field' | 'bar' | 'haybale' | 'flowers'
export type Struct = { kind: StructKind; x: number; z: number; r?: number; s?: number; w?: number; d?: number; c?: number; color?: string; label?: string }

const S: Struct[] = [
  // 방파제 끝 등대
  { kind: 'lighthouse', x: -53.5, z: -33, c: 2.2 },
  // 마을
  // 집: 문은 r 쪽(π = 북쪽, 길 쪽). 막힘은 벽·가구로 (houseLayout) — 들어갈 수 있음 (사용자 요청 2026-11-18, 낚시 가게는 뺌)
  { kind: 'house', x: 6, z: 34, r: Math.PI, w: 7, d: 6, color: '#c8553d' },
  { kind: 'house', x: 19, z: 33, r: Math.PI, w: 6, d: 6, color: '#3d6f9e' },
  { kind: 'house', x: -30, z: 33, r: Math.PI, w: 7, d: 6, color: '#3f7f5a' },
  { kind: 'house', x: -46, z: 30, r: Math.PI, w: 6.5, d: 6, color: '#7a5c9e' },
  { kind: 'house', x: -16, z: 27, r: Math.PI, w: 7, d: 6, color: '#8a6a4a' },
  { kind: 'fountain', x: -10, z: 37, c: 2.4 },
  { kind: 'vending', x: -5.6, z: 32.4, w: 1.1, d: 0.9 },
  { kind: 'well', x: 30, z: 38, c: 1.1 },
  // 모래사장
  ...[-46, -42, -38].map((x, i) => ({ kind: 'hut' as const, x, z: 9, w: 2.6, d: 2.6, color: ['#ff8a7a', '#7cc8ff', '#ffd23f'][i] })),
  { kind: 'tower', x: 14, z: 2.5, w: 2.2, d: 2.2 },
  { kind: 'fire', x: -20, z: 9, c: 1.4 },
  { kind: 'boat', x: -24, z: 4, r: 0.4, c: 1.6, color: '#e8473f' },
  { kind: 'boat', x: 18, z: 7, r: -0.3, c: 1.6, color: '#3f8fd0' },
  { kind: 'flag', x: 11.5, z: 3.5, c: 0.2 },
  // 산책로 벤치·가로등·표지판
  ...[-50, -36, -6, 4].map((x) => ({ kind: 'bench' as const, x, z: 17.8, w: 2, d: 0.8 })),
  ...[-56, -42, -28, -14, 0, 14].map((x) => ({ kind: 'lamp' as const, x, z: 15, c: 0.25 })),
  ...[-4, 8, 22, -24, 36].map((x, i) => ({ kind: 'lamp' as const, x, z: [28, 28, 26, 28, 30][i], c: 0.25 })),
  { kind: 'sign', x: 24, z: 16, c: 0.25, label: '← 바다 · 호수 →' },
  { kind: 'sign', x: -50, z: 4, c: 0.25, label: '등대 방파제' },
  // 호수 옆
  { kind: 'cabin', x: 57, z: 8, r: Math.PI, w: 6, d: 5 },
  // ── 서쪽 만: 바닷가 가게(그늘 바·의자), 야자수 ──
  { kind: 'bar', x: -72, z: 9, w: 5, d: 3.5 },
  ...[[-92, 10], [-86, 13], [-78, 14], [-66, 12], [-96, 4], [-62, 6]].map(([x, z], i) => ({ kind: 'palm' as const, x, z, c: 0.45, s: 0.95 + (i % 3) * 0.12 })),
  ...[[-90, 0], [-68, 2]].map(([x, z]) => ({ kind: 'rock' as const, x, z, c: 1.1, s: 1.2 })),
  // ── 동쪽 숲·캠핑장: 텐트 3, 모닥불, 소나무 숲 ──
  { kind: 'tent', x: 80, z: 12, w: 2.6, d: 2.6, color: '#e8743a' },
  { kind: 'tent', x: 88, z: 6, r: -0.5, w: 2.6, d: 2.6, color: '#3d8f5a' },
  { kind: 'tent', x: 78, z: 2, r: 0.6, w: 2.6, d: 2.6, color: '#3d6f9e' },
  { kind: 'fire', x: 84, z: 15, c: 1.4 },
  ...[[70, -34], [76, -28], [82, -36], [90, -30], [96, -20], [72, -18], [86, -14], [94, -6], [70, -6], [98, 8], [92, 22], [72, 26], [80, 32], [96, 36], [68, 40], [88, 44], [76, 50], [94, 56], [70, 62], [86, 70], [98, 76], [66, -26], [80, -22], [92, 30]].map(([x, z], i) => ({ kind: 'pine' as const, x, z, c: 0.8, s: 0.95 + (i % 5) * 0.15 })),
  // ── 남쪽 밭·풍차·헛간·과수원·꽃밭 ──
  { kind: 'field', x: -28, z: 62, w: 26, d: 16, c: 0 },
  { kind: 'windmill', x: 6, z: 64, c: 2.6 },
  { kind: 'barn', x: 28, z: 60, r: Math.PI, w: 9, d: 6.5, color: '#b0402f' },
  ...[[34, 66], [36, 67.5], [22, 66]].map(([x, z]) => ({ kind: 'haybale' as const, x, z, c: 0.75 })),
  ...[[-66, 54], [-60, 54], [-54, 54], [-66, 62], [-60, 62], [-54, 62], [-66, 70], [-60, 70], [-54, 70]].map(([x, z], i) => ({ kind: 'tree' as const, x, z, c: 0.55, s: 0.85 + (i % 3) * 0.12, color: 'orchard' })),
  { kind: 'flowers', x: 52, z: 70, w: 18, d: 12, c: 0 },
  { kind: 'house', x: -84, z: 38, r: Math.PI, w: 7, d: 6, color: '#3d6f9e' },
  { kind: 'house', x: 48, z: 52, r: Math.PI, w: 6.5, d: 6, color: '#c8553d' },
  ...[[-10, 48], [14, 50], [-44, 46]].map(([x, z]) => ({ kind: 'lamp' as const, x, z, c: 0.25 })),
  ...[[-6, 50], [40, 46]].map(([x, z]) => ({ kind: 'bench' as const, x, z, w: 2, d: 0.8 })),
  { kind: 'sign', x: -4, z: 46, c: 0.25, label: '← 과수원 · 풍차 →' },
  ...[[50, 40], [56, 32], [28, 30]].map(([x, z]) => ({ kind: 'table' as const, x, z, w: 2, d: 1.6 })),
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
  // 서쪽 만 바닷가
  ...[-92, -88, -70, -66].map((x) => ({ x, z: shoreZ(x) + 2.4, r: Math.PI })),
]
export const SPAWN = { x: 0, z: 9 }

// ── 모래성 (뿅망치로 부수고, 다시 쌓을 수 있음 — 사용자 요청 2026-11-18). 안 막힘 ──
export const CASTLES = [
  { x: -11, z: 3 },
  { x: 5, z: 5 },
  { x: -30, z: 7 },
  { x: -45, z: 3 },
  { x: -17, z: 4 },
  { x: 10, z: 7.5 },
]

// ── 나무 상자 (뿅망치로 3~4번 때리면 부서지고 1분 뒤 다시 생김 — 사용자 요청 2026-11-18). 안 막힘 ──
export const CRATES = [
  { x: -29.5, z: 2.5, r: 0.3 },
  { x: 9.6, z: 1.6, r: -0.2 },
  { x: -33, z: -3, r: 0.1 },
  { x: 7.2, z: -4, r: 0.6 },
  { x: -12, z: 22.5, r: 0 },
  { x: 30, z: 21, r: 0.4 },
  { x: 55, z: 12.5, r: -0.5 },
  { x: -50, z: 1, r: 0.2 },
]
export const CRATE_HP = { min: 3, max: 4 }
export const CRATE_RESPAWN_MS = 60_000
/** 모래성 쌓기를 시작할 수 있는 거리 · 걸리는 시간 */
export const CASTLE_REACH = 2
export const BUILD_MS = 4000
export function nearCastle(x: number, z: number, reach = CASTLE_REACH): number | null {
  let best: number | null = null
  let bestD = reach
  CASTLES.forEach((c, i) => {
    const d = Math.hypot(c.x - x, c.z - z)
    if (d < bestD) {
      bestD = d
      best = i
    }
  })
  return best
}

// ── 집 안 (벽·가구) ──
export type FurnKind = 'bed' | 'sofa' | 'shelf' | 'table' | 'fireplace' | 'kitchen'
export type HouseLayout = { walls: Rect[]; furniture: { kind: FurnKind; rect: Rect; r: number }[]; inside: Rect }
const WALL = 0.25
const DOOR = 1.5
/** 네모를 구조물 기준(앞 = +z)에서 세상 좌표로 (r은 90° 단위) */
function placeRect(s: Struct, b: Rect): Rect {
  const r = s.r ?? 0
  const c = Math.round(Math.cos(r)), n = Math.round(Math.sin(r))
  const pts = [[b.minX, b.minZ], [b.maxX, b.maxZ]].map(([x, z]) => [s.x + x * c + z * n, s.z - x * n + z * c])
  return { minX: Math.min(pts[0][0], pts[1][0]), maxX: Math.max(pts[0][0], pts[1][0]), minZ: Math.min(pts[0][1], pts[1][1]), maxZ: Math.max(pts[0][1], pts[1][1]) }
}
export function houseLayout(s: Struct): HouseLayout {
  const w = s.w!, d = s.d!, hw = w / 2, hd = d / 2, T = WALL
  const L = (minX: number, maxX: number, minZ: number, maxZ: number): Rect => ({ minX, maxX, minZ, maxZ })
  const walls = [L(-hw, hw, -hd, -hd + T), L(-hw, -hw + T, -hd, hd), L(hw - T, hw, -hd, hd), L(-hw, -DOOR / 2, hd - T, hd), L(DOOR / 2, hw, hd - T, hd)]
  const ix0 = -hw + T, ix1 = hw - T, iz0 = -hd + T
  const furniture: { kind: FurnKind; rect: Rect }[] = [
    { kind: 'bed', rect: L(ix0, ix0 + 1.4, iz0, iz0 + 2.1) },
    { kind: 'sofa', rect: L(ix0, ix0 + 0.8, 0.2, Math.min(2, hd - T - 0.3)) },
    s.kind === 'cabin' ? { kind: 'fireplace', rect: L(-0.75, 0.75, iz0, iz0 + 0.6) } : { kind: 'kitchen', rect: L(-0.2, 1, iz0, iz0 + 0.6) },
    { kind: 'shelf', rect: L(ix1 - 1.5, ix1, iz0, iz0 + 0.45) },
    { kind: 'table', rect: L(ix1 - 1.7, ix1 - 0.7, -0.5, 0.5) },
  ]
  return {
    walls: walls.map((b) => placeRect(s, b)),
    furniture: furniture.map((f) => ({ kind: f.kind, rect: placeRect(s, f.rect), r: s.r ?? 0 })),
    inside: placeRect(s, L(ix0, ix1, iz0, hd - T)),
  }
}
export const HOUSES = S.filter((s) => s.kind === 'house' || s.kind === 'cabin').map((s) => ({ s, ...houseLayout(s) }))

// ── 앉을 자리·누울 자리 (상호작용 R — 사용자 요청 2026-11-19): 집 침대·소파·식탁 의자, 벤치, 피크닉 탁자, 모닥불 통나무 ──
// x·z = 앉는(눕는) 자리, r = 앉은 사람이 보는 쪽(누우면 머리 → 발 쪽), y = 앉는 면 높이, stand = 일어나면 서는 곳(걸을 수 있는 곳)
export type Seat = { x: number; z: number; r: number; y: number; kind: 'sit' | 'lie'; stand: { x: number; z: number } }
function buildSeats(): Seat[] {
  const out: Seat[] = []
  const T = 0.25
  // 구조물 기준(앞 = +z) 좌표 → 세상 좌표
  const W = (s: { x: number; z: number; r?: number }, lx: number, lz: number) => {
    const r = s.r ?? 0
    return { x: s.x + lx * Math.cos(r) + lz * Math.sin(r), z: s.z - lx * Math.sin(r) + lz * Math.cos(r) }
  }
  for (const h of HOUSES) {
    const s = h.s, hw = s.w! / 2, hd = s.d! / 2, r = s.r ?? 0
    const ix0 = -hw + T, ix1 = hw - T, iz0 = -hd + T
    // 침대: 머리판은 뒷벽, 발은 앞으로
    out.push({ ...W(s, ix0 + 0.7, iz0 + 1.95), r, y: 0.58, kind: 'lie', stand: W(s, ix0 + 1.95, iz0 + 1.1) })
    // 소파: 등이 옆벽, 방 가운데를 봄 (두 자리)
    const sz0 = 0.2, sz1 = Math.min(2, hd - T - 0.3)
    for (const k of [0.3, 0.72]) out.push({ ...W(s, ix0 + 0.45, sz0 + (sz1 - sz0) * k), r: r + Math.PI / 2, y: 0.42, kind: 'sit', stand: W(s, ix0 + 1.3, sz0 + (sz1 - sz0) * k) })
    // 식탁 의자 둘 (식탁을 봄)
    const cx = ix1 - 1.2
    out.push({ ...W(s, cx, -0.75), r, y: 0.47, kind: 'sit', stand: W(s, cx - 1.05, -0.75) })
    out.push({ ...W(s, cx, 0.75), r: r + Math.PI, y: 0.47, kind: 'sit', stand: W(s, cx - 1.05, 0.75) })
  }
  for (const s of S) {
    if (s.kind === 'bench')
      for (const lx of [-0.5, 0.5]) out.push({ ...W(s, lx, 0.05), r: s.r ?? 0, y: 0.5, kind: 'sit', stand: W(s, lx, 0.95) })
    if (s.kind === 'table')
      for (const lx of [-0.5, 0.5])
        for (const sg of [-1, 1]) out.push({ ...W(s, lx, sg * 0.62), r: (s.r ?? 0) + (sg < 0 ? 0 : Math.PI), y: 0.48, kind: 'sit', stand: W(s, lx, sg * 1.4) })
    if (s.kind === 'fire')
      for (const a of [0.4, 2.1, 3.9]) {
        const x = s.x + Math.cos(a) * 2.3, z = s.z + Math.sin(a) * 2.3
        out.push({ x, z, r: Math.atan2(s.x - x, s.z - z), y: 0.42, kind: 'sit', stand: { x: s.x + Math.cos(a) * 3.1, z: s.z + Math.sin(a) * 3.1 } })
      }
  }
  return out
}
export const SEATS: Seat[] = buildSeats()
export const SEAT_REACH = 1.5
/** 가장 가까운 앉을 자리 (자리나 서는 곳에서 이만큼 안) */
export function nearSeat(x: number, z: number): number | null {
  let best: number | null = null
  let bestD = SEAT_REACH
  SEATS.forEach((s, i) => {
    const d = Math.min(Math.hypot(s.x - x, s.z - z), Math.hypot(s.stand.x - x, s.stand.z - z))
    if (d < bestD) {
      bestD = d
      best = i
    }
  })
  return best
}
/** 지금 서 있는 집 (번호), 밖이면 null */
export function houseAt(x: number, z: number): number | null {
  const i = HOUSES.findIndex((h) => inRect(x, z, h.inside))
  return i >= 0 ? i : null
}

// ── 사다리 (인명구조 탑·등대) ──
export type Ladder = { foot: { x: number; z: number }; top: { x: number; z: number }; y: number; /** 위에서 다닐 수 있는 곳 */ area: { kind: 'rect'; rect: Rect } | { kind: 'ring'; x: number; z: number; rIn: number; rOut: number } }
export const LADDERS: Ladder[] = [
  { foot: { x: 14, z: 4.5 }, top: { x: 14, z: 3.2 }, y: 2.68, area: { kind: 'rect', rect: { minX: 13, maxX: 15, minZ: 2.9, maxZ: 3.6 } } },
  { foot: { x: -53.5, z: -30.25 }, top: { x: -53.5, z: -31.6 }, y: 11.42, area: { kind: 'ring', x: -53.5, z: -33, rIn: 1.05, rOut: 1.45 } },
]
export const LADDER_REACH = 1.4
export function nearLadder(x: number, z: number): number | null {
  const i = LADDERS.findIndex((l) => Math.hypot(l.foot.x - x, l.foot.z - z) < LADDER_REACH)
  return i >= 0 ? i : null
}
/** 사다리 위에서 갈 수 있는 곳인지 */
export function onLadderTop(i: number, x: number, z: number): boolean {
  const a = LADDERS[i]?.area
  if (!a) return false
  if (a.kind === 'rect') return inRect(x, z, a.rect)
  const r = Math.hypot(x - a.x, z - a.z)
  return r >= a.rIn && r <= a.rOut
}

// ── 배 (탈 수 있음) ──
export type BoatHome = { x: number; z: number; r: number; zone: Zone; color: string }
export const BOATS: BoatHome[] = [
  { x: 10.6, z: -14, r: 0.1, zone: 'sea', color: '#2f9e6a' },
  { x: 4, z: -11, r: -0.2, zone: 'sea', color: '#f4f2ec' },
  { x: -28.4, z: -22, r: 0.05, zone: 'sea', color: '#3f8fd0' },
  { x: 35.5, z: 27.6, r: 1.2, zone: 'fresh', color: '#e0b030' },
  { x: 40, z: 31, r: 2.4, zone: 'fresh', color: '#c8553d' },
]
/** 바다 배가 모자랄 때(빈 배가 없을 때)만 하나씩 더 띄우는 배 — 최대 3척, 한동안 안 쓰면 다시 사라짐 (사용자 요청 2026-11-18) */
export const EXTRA_BOATS: BoatHome[] = [
  { x: 3.5, z: -16, r: 0.2, zone: 'sea', color: '#7a5c9e' },
  { x: -26.5, z: -28, r: 0, zone: 'sea', color: '#c8553d' },
  { x: 12, z: -19, r: -0.3, zone: 'sea', color: '#e0b030' },
]
/** 배 자리 전체 (앞 5척은 늘 있음, 뒤는 필요할 때만) */
export const BOAT_SLOTS: (BoatHome & { extra: boolean })[] = [...BOATS.map((b) => ({ ...b, extra: false })), ...EXTRA_BOATS.map((b) => ({ ...b, extra: true }))]
export const BOAT_SPEED = 7
/** 배에 탈 수 있는 거리 · 내릴 땅을 찾는 거리 */
export const BOAT_REACH = 2.8
/** 배가 갈 수 있는 곳: 그 물(바다·민물) 위, 배 둘레(0.9m)도 물, 판자·방파제 밑이 아님 */
export function boatable(x: number, z: number, zone: Zone): boolean {
  if (x < BOUNDS.minX || x > BOUNDS.maxX || z < BOUNDS.minZ || z > BOUNDS.maxZ) return false
  for (const [ox, oz] of [[0, 0], [0.9, 0], [-0.9, 0], [0, 0.9], [0, -0.9]]) {
    const px = x + ox, pz = z + oz
    if (waterAt(px, pz) !== zone || onBoards(px, pz)) return false
    if (inRect(px, pz, { minX: JETTY.minX - 1.2, maxX: JETTY.maxX + 1.2, minZ: JETTY.minZ - 1.2, maxZ: JETTY.maxZ })) return false
  }
  return true
}
export function moveBoat(x: number, z: number, dx: number, dz: number, zone: Zone): { x: number; z: number } {
  if (boatable(x + dx, z + dz, zone)) return { x: x + dx, z: z + dz }
  if (boatable(x + dx, z, zone)) return { x: x + dx, z }
  if (boatable(x, z + dz, zone)) return { x, z: z + dz }
  return { x, z }
}
/** 배에서 내릴 곳: 가까운 땅·판자 (없으면 null) */
export function landingSpot(x: number, z: number): { x: number; z: number } | null {
  for (let r = 1; r <= BOAT_REACH + 0.6; r += 0.3)
    for (let k = 0; k < 24; k++) {
      const a = (k / 24) * Math.PI * 2
      const px = x + Math.sin(a) * r, pz = z + Math.cos(a) * r
      if (walkable(px, pz)) return { x: round(px), z: round(pz) }
    }
  return null
}

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
  for (const h of HOUSES) {
    if (x < h.s.x - h.s.w! / 2 - 1 || x > h.s.x + h.s.w! / 2 + 1 || z < h.s.z - h.s.d! / 2 - 1 || z > h.s.z + h.s.d! / 2 + 1) continue
    for (const b of h.walls) if (x > b.minX - R && x < b.maxX + R && z > b.minZ - R && z < b.maxZ + R) return true
    for (const f of h.furniture) if (x > f.rect.minX - R && x < f.rect.maxX + R && z > f.rect.minZ - R && z < f.rect.maxZ + R) return true
  }
  for (const s of S) {
    if (s.kind === 'house' || s.kind === 'cabin' || s.kind === 'field' || s.kind === 'flowers') continue
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

// ── 곤충 채집 (사용자 요청 2026-11-19): 나무(소나무·둥근 나무) 가까이 = 숲, 꽃밭·밭 안이나 가 = 꽃밭 ──
/** 나무 둘레에서 이만큼 안이면 채집할 수 있음 (m) */
export const BUG_REACH = 2.4
const BUG_TREES = S.filter((s) => s.kind === 'pine' || s.kind === 'tree')
const MEADOWS = S.filter((s) => s.kind === 'flowers' || s.kind === 'field')
/** 곤충이 있는 높이 (그림용) */
export const BUG_Y = { forest: 1.25, meadow: 0.45 } as const
/**
 * 채집할 곳: 가까운 나무 줄기(숲) 또는 바라보는 쪽 꽃밭(꽃밭). 둘 다 없으면 null.
 * bob = 곤충이 앉은 자리, r = 그쪽을 보는 방향
 */
export function bugSpot(x: number, z: number, r: number): { zone: 'forest' | 'meadow'; bob: [number, number]; r: number } | null {
  let best: Struct | null = null
  let bestD = BUG_REACH
  for (const t of BUG_TREES) {
    const d = Math.hypot(t.x - x, t.z - z) - (t.c ?? 0)
    if (d < bestD) {
      bestD = d
      best = t
    }
  }
  if (best) {
    const dx = x - best.x, dz = z - best.z
    const len = Math.hypot(dx, dz) || 1
    const rr = (best.c ?? 0.5) * 0.45 + 0.12
    return { zone: 'forest', bob: [round(best.x + (dx / len) * rr), round(best.z + (dz / len) * rr)], r: Math.atan2(-dx, -dz) }
  }
  for (const m of MEADOWS) {
    const hw = m.w! / 2, hd = m.d! / 2
    if (Math.abs(x - m.x) > hw + 1.5 || Math.abs(z - m.z) > hd + 1.5) continue
    const bx = Math.max(m.x - hw + 0.3, Math.min(m.x + hw - 0.3, x + Math.sin(r) * 1.4))
    const bz = Math.max(m.z - hd + 0.3, Math.min(m.z + hd - 0.3, z + Math.cos(r) * 1.4))
    return { zone: 'meadow', bob: [round(bx), round(bz)], r: Math.hypot(bx - x, bz - z) > 0.3 ? Math.atan2(bx - x, bz - z) : r }
  }
  return null
}
/** 곤충 자리의 높이 (나무 줄기에 붙었으면 숲 높이, 아니면 꽃 높이) — 그림용 */
export function bugHeightAt(x: number, z: number): number {
  return BUG_TREES.some((t) => Math.hypot(t.x - x, t.z - z) < (t.c ?? 0.5) + 0.6) ? BUG_Y.forest : BUG_Y.meadow
}
