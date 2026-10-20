// 윷판. 칸 번호(node)와 길(route). 말 위치는 '어느 길의 몇 번째'로 들고 다닌다.
//
// 칸 번호 (출발점 0 = 오른쪽 아래, 시계 반대 방향):
//   10  9  8  7  6  5
//   11 25        20  4
//   12   26    21    3
//            22
//   13   23    27    2
//   14 24        28  1
//   15 16 17 18 19  0
//
// 꺾이는 칸(5, 10, 22)에 정확히 멈추면 무조건 꺾는다. 지나가기만 하면 원래 길로.

export type RouteId = 'outer' | 'r5' | 'r10' | 'rc'

/** 길마다 지나가는 칸. 마지막 칸(0)이 '끝'이고, 넘어가면 나간다 */
export const ROUTES: Record<RouteId, readonly number[]> = {
  // 바깥 한 바퀴 (0번째 = 출발점은 판에 올리기 전 자리라 쓰지 않음)
  outer: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 0],
  // 오른쪽 위 모서리에서 꺾어 가운데 지나 왼쪽 아래로
  r5: [5, 20, 21, 22, 23, 24, 15, 16, 17, 18, 19, 0],
  // 왼쪽 위 모서리에서 꺾어 가운데 지나 출발점으로
  r10: [10, 25, 26, 22, 27, 28, 0],
  // 가운데에 멈춰서 출발점 쪽으로
  rc: [22, 27, 28, 0],
}

/** 판 위 말의 자리 */
export type Pos = { route: RouteId; idx: number }

export const nodeOf = (p: Pos): number => ROUTES[p.route][p.idx]

/** 끝(출발점에 도착, 다음에 나감)인지 */
export const atEnd = (p: Pos): boolean => p.idx === ROUTES[p.route].length - 1

/** 멈춘 칸이 꺾이는 칸이면 그 지름길로 갈아탄다 */
function settle(p: Pos): Pos {
  const node = nodeOf(p)
  if (p.route === 'outer' && node === 5) return { route: 'r5', idx: 0 }
  if (p.route === 'outer' && node === 10) return { route: 'r10', idx: 0 }
  if (p.route === 'r5' && node === 22) return { route: 'rc', idx: 0 }
  return p
}

/** 처음 판에 올리며 steps칸 (빽도는 못 함) */
export function enter(steps: number): Pos {
  return settle({ route: 'outer', idx: steps })
}

/** 앞으로 steps칸. 끝을 넘어가면 'out'(나감) */
export function advance(p: Pos, steps: number): Pos | 'out' {
  const idx = p.idx + steps
  if (idx >= ROUTES[p.route].length) return 'out'
  return settle({ route: p.route, idx })
}

/** 한 칸 뒤로 (빽도). 지름길 첫 칸에서는 들어온 길로 돌아간다 */
export function back(p: Pos): Pos {
  if (p.idx > 0) {
    // 바깥 길 첫 칸(도)에서 뒤로 가면 출발점 = 끝
    if (p.route === 'outer' && p.idx === 1) return { route: 'outer', idx: ROUTES.outer.length - 1 }
    return settle({ route: p.route, idx: p.idx - 1 })
  }
  switch (p.route) {
    case 'r5':
      return { route: 'outer', idx: 4 }
    case 'r10':
      return { route: 'outer', idx: 9 }
    case 'rc':
      // 가운데엔 오른쪽 위 대각선으로 와서 멈춘 것 (왼쪽 위 대각선은 꺾지 않고 지나감)
      return { route: 'r5', idx: 2 }
    case 'outer':
      return p
  }
}

/** 남은 거리 (봇이 누가 앞서는지 볼 때) */
export function distanceLeft(p: Pos): number {
  return ROUTES[p.route].length - p.idx
}

/** 화면 좌표 (0~300 정사각형) */
export const NODE_XY: Record<number, readonly [number, number]> = (() => {
  const xy: Record<number, readonly [number, number]> = {}
  const lo = 30
  const hi = 270
  const step = (hi - lo) / 5
  for (let k = 0; k <= 5; k++) {
    xy[k] = [hi, hi - k * step] // 오른쪽: 0 → 5
    xy[5 + k] = [hi - k * step, lo] // 위: 5 → 10
    xy[10 + k] = [lo, lo + k * step] // 왼쪽: 10 → 15
    if (k < 5) xy[15 + k] = [lo + k * step, hi] // 아래: 15 → 19
  }
  const mid = (lo + hi) / 2
  const along = (a: readonly [number, number], t: number): [number, number] => [a[0] + (mid - a[0]) * t, a[1] + (mid - a[1]) * t]
  xy[20] = along(xy[5], 1 / 3)
  xy[21] = along(xy[5], 2 / 3)
  xy[22] = [mid, mid]
  xy[23] = along(xy[15], 2 / 3)
  xy[24] = along(xy[15], 1 / 3)
  xy[25] = along(xy[10], 1 / 3)
  xy[26] = along(xy[10], 2 / 3)
  xy[27] = along(xy[0], 2 / 3)
  xy[28] = along(xy[0], 1 / 3)
  return xy
})()

/** 꺾이는 칸 (크게 그림) */
export const CORNERS = [0, 5, 10, 15, 22]
