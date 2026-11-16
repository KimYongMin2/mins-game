import { CANVAS_H, CANVAS_W } from '../constants'

// 그림: 선(stroke) 목록. 그리는 사람이 0.04초마다 바뀐 것(ops)을 묶어 보내고, 받는 쪽은 그대로 쌓는다.
// 좌표는 1000×750 판 안의 정수 [x0, y0, x1, y1, …].

export type Stroke = { id: number; c: string; w: number; p: number[] }

export type InkOp =
  /** 새 선 시작 (첫 점들 포함) */
  | { op: 's'; id: number; c: string; w: number; p: number[] }
  /** 선에 점 더하기 */
  | { op: 'a'; id: number; p: number[] }
  /** 마지막 선 지우기 */
  | { op: 'u' }
  /** 다 지우기 */
  | { op: 'x' }

export const PEN_COLORS = ['#1c1748', '#e8473f', '#f59f0b', '#ffd23f', '#22a861', '#2f8fe0', '#8b5cf6', '#8a5a2b'] as const
export const ERASER = '#ffffff'
export const PEN_WIDTHS = [4, 10, 22] as const

/** 한 판에 쌓는 점 수 제한 (너무 크면 받는 폰이 느려짐) */
const MAX_POINTS = 40_000

export function applyOps(strokes: Stroke[], ops: readonly InkOp[]): Stroke[] {
  let out = strokes
  for (const o of ops) {
    if (o.op === 'x') out = []
    else if (o.op === 'u') out = out.slice(0, -1)
    else if (o.op === 's') out = [...out, { id: o.id, c: o.c, w: o.w, p: o.p }]
    else if (o.op === 'a') {
      const i = out.findIndex((s) => s.id === o.id)
      if (i >= 0) out = out.map((s, k) => (k === i ? { ...s, p: [...s.p, ...o.p] } : s))
    }
  }
  return out
}

export const pointCount = (strokes: readonly Stroke[]) => strokes.reduce((n, s) => n + s.p.length / 2, 0)

/** 받은 묶음 검사 (그리는 사람이 보낸 것만 쓰지만 모양도 확인). 이상하면 null */
export function readOps(x: unknown): InkOp[] | null {
  if (!Array.isArray(x) || x.length > 200) return null
  const pts = (p: unknown): p is number[] =>
    Array.isArray(p) && p.length <= 400 && p.length % 2 === 0 && p.every((v, i) => Number.isInteger(v) && v >= 0 && v <= (i % 2 ? CANVAS_H : CANVAS_W))
  const out: InkOp[] = []
  for (const o of x as Record<string, unknown>[]) {
    if (!o || typeof o !== 'object') return null
    if (o.op === 'x' || o.op === 'u') out.push({ op: o.op })
    else if (o.op === 's' && Number.isInteger(o.id) && typeof o.c === 'string' && /^#[0-9a-f]{6}$/.test(o.c) && typeof o.w === 'number' && o.w > 0 && o.w <= 40 && pts(o.p))
      out.push({ op: 's', id: o.id as number, c: o.c, w: o.w, p: o.p })
    else if (o.op === 'a' && Number.isInteger(o.id) && pts(o.p)) out.push({ op: 'a', id: o.id as number, p: o.p })
    else return null
  }
  return out
}

export const tooBig = (strokes: readonly Stroke[]) => pointCount(strokes) > MAX_POINTS
