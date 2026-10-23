// 알까기 물리. 돌 하나를 튕기면 모두 멈출 때까지 한 번에 계산해 두고, 화면은 그 프레임을 시간에 맞춰 보여준다.
// - 마찰: 속도가 일정하게 줄어든다
// - 충돌: 같은 무게의 원끼리. 세게 부딪힐수록 덜 튕겨서(RESTITUTION) 친 돌도 계속 나간다
// - 돌 가운데가 판 끝(EDGE) 밖으로 나가면 떨어진다
import { EDGE, FRICTION, HOME_ROW, LINES, RADIUS, RESTITUTION, STONES } from '../constants'

export type Side = 0 | 1
/** 돌 하나. 배열 순서 = side * STONES + 번호 */
export type Stone = { side: Side; x: number; y: number; on: boolean }
/** 화면용 한 프레임: 돌마다 [x, y, 판 위인지] */
export type Frame = { x: number; y: number; on: boolean }[]
export type PhysEvent = { t: number; kind: 'hit' | 'fall'; strength: number }

export type ShotResult = {
  /** 1/60초마다 */
  frames: Frame[]
  events: PhysEvent[]
  final: Stone[]
}

const DT = 1 / 120
/** 프레임 하나에 물리 몇 번 */
const SUB = 2
export const FRAME_MS = DT * SUB * 1000
const MAX_TIME = 12

/** 처음 배치: 나(0)는 아래 줄, 상대(1)는 위 줄. 상대는 판을 180도 돌린 자리라 친구 기기에선 번호가 그대로 맞는다 */
export function initialStones(): Stone[] {
  const xs = Array.from({ length: STONES }, (_, i) => (LINES - 1) / 2 + (i - (STONES - 1) / 2) * 2)
  const top = LINES - 1 - HOME_ROW
  return [
    ...xs.map((x) => ({ side: 0 as const, x, y: HOME_ROW, on: true })),
    ...xs.map((x) => ({ side: 1 as const, x: LINES - 1 - x, y: top, on: true })),
  ]
}

const offBoard = (s: { x: number; y: number }) => s.x < EDGE.min || s.x > EDGE.max || s.y < EDGE.min || s.y > EDGE.max

/** 겹친 두 돌을 지금 속도 그대로 몇 초 되돌리면 딱 닿는지 (이번 한 걸음 안에서, 못 구하면 0) */
function touchBack(a: { x: number; y: number; vx: number; vy: number }, b: { x: number; y: number; vx: number; vy: number }): number {
  // |(b - a) - (vb - va)·s| = 2R 을 s에 대해 푼다
  const rx = b.x - a.x
  const ry = b.y - a.y
  const wx = b.vx - a.vx
  const wy = b.vy - a.vy
  const qa = wx * wx + wy * wy
  if (qa === 0) return 0
  const qb = -2 * (rx * wx + ry * wy)
  const qc = rx * rx + ry * ry - 4 * RADIUS * RADIUS
  const disc = qb * qb - 4 * qa * qc
  if (disc < 0) return 0
  const s = (-qb - Math.sqrt(disc)) / (2 * qa)
  const s2 = (-qb + Math.sqrt(disc)) / (2 * qa)
  // 겹친 상태(qc < 0)라 근 하나는 음수, 하나는 양수. 양수 쪽이 되돌릴 시간
  const back = Math.max(s, s2)
  return back > 0 && back <= DT * 1.5 ? back : 0
}

/** index 돌을 (vx, vy) 칸/초로 튕긴다 */
export function simulate(stones: readonly Stone[], index: number, vx: number, vy: number): ShotResult {
  const s = stones.map((st) => ({ ...st, vx: 0, vy: 0 }))
  s[index].vx = vx
  s[index].vy = vy
  const frames: Frame[] = [s.map(({ x, y, on }) => ({ x, y, on }))]
  const events: PhysEvent[] = []
  for (let step = 1; step * DT < MAX_TIME; step++) {
    const t = step * DT
    let moving = false
    for (const a of s) {
      if (!a.on) continue
      const sp = Math.hypot(a.vx, a.vy)
      if (sp === 0) continue
      a.x += a.vx * DT
      a.y += a.vy * DT
      const k = Math.max(0, sp - FRICTION * DT) / sp
      a.vx *= k
      a.vy *= k
      moving = true
    }
    for (let i = 0; i < s.length; i++) {
      for (let j = i + 1; j < s.length; j++) {
        const a = s[i]
        const b = s[j]
        if (!a.on || !b.on) continue
        if (Math.hypot(b.x - a.x, b.y - a.y) >= RADIUS * 2) continue
        // 빠르면 한 번에 0.15칸씩 가서 겹친 뒤에야 알게 된다. 겹친 자리로 방향을 정하면 튕기는 각도가 몇 도씩 틀어지므로
        // 딱 닿은 순간(back초 전)으로 되돌려서 부딪힌 뒤, 그만큼 다시 보낸다
        const back = touchBack(a, b)
        a.x -= a.vx * back
        a.y -= a.vy * back
        b.x -= b.vx * back
        b.y -= b.vy * back
        const dx = b.x - a.x
        const dy = b.y - a.y
        const d = Math.hypot(dx, dy)
        if (d === 0) continue
        const nx = dx / d
        const ny = dy / d
        // 되돌려도 겹쳐 있으면(멈춘 돌끼리 등) 밀어내기
        const push = Math.max(0, RADIUS * 2 - d) / 2
        a.x -= nx * push
        a.y -= ny * push
        b.x += nx * push
        b.y += ny * push
        const closing = (a.vx - b.vx) * nx + (a.vy - b.vy) * ny
        if (closing <= 0) {
          a.x += a.vx * back
          a.y += a.vy * back
          b.x += b.vx * back
          b.y += b.vy * back
          continue
        }
        const e = RESTITUTION.soft - (RESTITUTION.soft - RESTITUTION.hard) * Math.min(1, closing / RESTITUTION.hardAt)
        const imp = ((1 + e) * closing) / 2
        a.vx -= imp * nx
        a.vy -= imp * ny
        b.vx += imp * nx
        b.vy += imp * ny
        // 되돌린 시간만큼 새 속도로 다시 보낸다
        a.x += a.vx * back
        a.y += a.vy * back
        b.x += b.vx * back
        b.y += b.vy * back
        events.push({ t, kind: 'hit', strength: closing })
      }
    }
    for (const a of s) {
      if (a.on && offBoard(a)) {
        a.on = false
        a.vx = 0
        a.vy = 0
        events.push({ t, kind: 'fall', strength: 1 })
      }
    }
    if (step % SUB === 0 || !moving) frames.push(s.map(({ x, y, on }) => ({ x, y, on })))
    if (!moving) break
  }
  return { frames, events, final: s.map(({ side, x, y, on }) => ({ side, x, y, on })) }
}

/** 남은 돌 수 */
export const remaining = (stones: readonly Stone[], side: Side) => stones.filter((s) => s.side === side && s.on).length

/** 친구 기기 시점으로 (판을 180도 돌리고 편을 바꿈) */
export function flipStones(stones: readonly Stone[]): Stone[] {
  const half = stones.length / 2
  return stones.map((_, i) => {
    const src = stones[(i + half) % stones.length]
    return { side: (1 - src.side) as Side, x: LINES - 1 - src.x, y: LINES - 1 - src.y, on: src.on }
  })
}

/** 내 시점 돌 번호 ↔ 친구 시점 돌 번호 */
export const flipIndex = (index: number, count: number) => (index + count / 2) % count
