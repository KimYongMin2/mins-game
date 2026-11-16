import { CANVAS_H, CANVAS_W } from '../constants'

// 그림: 선(stroke) 목록. 그리는 사람이 0.04초마다 바뀐 것(ops)을 묶어 보내고, 받는 쪽은 그대로 쌓는다.
// 좌표는 1000×750 판 안의 정수 [x0, y0, x1, y1, …].
// 종류 k (사용자 요청 2026-11-16 — 그림판처럼 도형·채우기도): p 펜(점 여러 개) · l 직선 · r 네모 · e 동그라미(두 점 = 시작·끝, 끄는 동안은
// 그리는 사람 화면에만 미리 보기, 떼면 한 번에 보냄) · f 채우기(누른 점 하나, 그 순간 그림 위에서 둘러싸인 곳을 칠함 — 순서대로 다시 그리면 같은 결과)

export type StrokeKind = 'p' | 'l' | 'r' | 'e' | 'f'

export type Stroke = { id: number; c: string; w: number; p: number[]; k?: StrokeKind }

export type InkOp =
  /** 새 선 시작 (첫 점들 포함). k가 없으면 펜 */
  | { op: 's'; id: number; c: string; w: number; p: number[]; k?: StrokeKind }
  /** 펜 선에 점 더하기 */
  | { op: 'a'; id: number; p: number[] }
  /** 마지막 선(도형·채우기 포함) 지우기 */
  | { op: 'u' }
  /** 다 지우기 */
  | { op: 'x' }

/** 16색 (사용자 요청 — 8색에서 늘림) */
export const PEN_COLORS = [
  '#1c1748', '#6b7280', '#e8473f', '#7f1d1d', '#f59f0b', '#ffd23f', '#a3e635', '#22a861',
  '#14532d', '#7dd3fc', '#2f8fe0', '#1e3a8a', '#8b5cf6', '#f9a8d4', '#fcd5b5', '#8a5a2b',
] as const
export const ERASER = '#ffffff'
export const PEN_WIDTHS = [4, 10, 22] as const

/** 한 판에 쌓는 점 수 제한 (너무 크면 받는 폰이 느려짐) */
const MAX_POINTS = 40_000
/** 한 판 채우기 횟수 제한 (다시 그릴 때마다 채우기를 다시 해서) */
const MAX_FILLS = 60

export function applyOps(strokes: Stroke[], ops: readonly InkOp[]): Stroke[] {
  let out = strokes
  for (const o of ops) {
    if (o.op === 'x') out = []
    else if (o.op === 'u') out = out.slice(0, -1)
    else if (o.op === 's') out = [...out, { id: o.id, c: o.c, w: o.w, p: o.p, ...(o.k && o.k !== 'p' ? { k: o.k } : {}) }]
    else if (o.op === 'a') {
      const i = out.findIndex((s) => s.id === o.id && (s.k ?? 'p') === 'p')
      if (i >= 0) out = out.map((s, k) => (k === i ? { ...s, p: [...s.p, ...o.p] } : s))
    }
  }
  return out
}

export const pointCount = (strokes: readonly Stroke[]) => strokes.reduce((n, s) => n + s.p.length / 2, 0)

/** 종류마다 점 개수: 도형은 정확히 두 점, 채우기는 한 점 */
const POINTS_OF: Record<StrokeKind, (n: number) => boolean> = { p: (n) => n >= 2, l: (n) => n === 4, r: (n) => n === 4, e: (n) => n === 4, f: (n) => n === 2 }

/** 받은 묶음 검사 (그리는 사람이 보낸 것만 쓰지만 모양도 확인). 이상하면 null */
export function readOps(x: unknown): InkOp[] | null {
  if (!Array.isArray(x) || x.length > 200) return null
  const pts = (p: unknown): p is number[] =>
    Array.isArray(p) && p.length <= 400 && p.length % 2 === 0 && p.every((v, i) => Number.isInteger(v) && v >= 0 && v <= (i % 2 ? CANVAS_H : CANVAS_W))
  const out: InkOp[] = []
  for (const o of x as Record<string, unknown>[]) {
    if (!o || typeof o !== 'object') return null
    if (o.op === 'x' || o.op === 'u') out.push({ op: o.op })
    else if (o.op === 's' && Number.isInteger(o.id) && typeof o.c === 'string' && /^#[0-9a-f]{6}$/.test(o.c) && typeof o.w === 'number' && o.w > 0 && o.w <= 40 && pts(o.p)) {
      const k = (o.k ?? 'p') as StrokeKind
      if (!(k in POINTS_OF) || !POINTS_OF[k](o.p.length)) return null
      out.push({ op: 's', id: o.id as number, c: o.c, w: o.w, p: o.p, ...(k !== 'p' ? { k } : {}) })
    } else if (o.op === 'a' && Number.isInteger(o.id) && pts(o.p)) out.push({ op: 'a', id: o.id as number, p: o.p })
    else return null
  }
  return out
}

export const tooBig = (strokes: readonly Stroke[]) => pointCount(strokes) > MAX_POINTS || strokes.filter((s) => s.k === 'f').length > MAX_FILLS

const hex = (c: string): [number, number, number] => [parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16)]

/**
 * 채우기: 누른 칸과 비슷한 색(선의 흐린 가장자리까지 조금 봐줌)으로 이어진 곳을 칠한다.
 * 다 칠한 뒤 한 칸 더 넓혀서 선과 사이에 흰 틈이 안 남게
 */
export function floodFill(ctx: CanvasRenderingContext2D, x: number, y: number, color: string) {
  const W = CANVAS_W
  const H = CANVAS_H
  const img = ctx.getImageData(0, 0, W, H)
  const d = img.data
  const at = (i: number) => i * 4
  const start = Math.min(H - 1, Math.max(0, y)) * W + Math.min(W - 1, Math.max(0, x))
  const [sr, sg, sb] = [d[at(start)], d[at(start) + 1], d[at(start) + 2]]
  const [r, g, b] = hex(color)
  if (Math.abs(sr - r) + Math.abs(sg - g) + Math.abs(sb - b) < 8) return
  const TOL = 96
  const same = (i: number) => Math.abs(d[at(i)] - sr) + Math.abs(d[at(i) + 1] - sg) + Math.abs(d[at(i) + 2] - sb) <= TOL
  const seen = new Uint8Array(W * H)
  const stack = [start]
  const filled: number[] = []
  seen[start] = 1
  while (stack.length) {
    const i = stack.pop()!
    if (!same(i)) continue
    filled.push(i)
    const px = i % W
    if (px > 0 && !seen[i - 1]) (seen[i - 1] = 1), stack.push(i - 1)
    if (px < W - 1 && !seen[i + 1]) (seen[i + 1] = 1), stack.push(i + 1)
    if (i >= W && !seen[i - W]) (seen[i - W] = 1), stack.push(i - W)
    if (i < W * (H - 1) && !seen[i + W]) (seen[i + W] = 1), stack.push(i + W)
  }
  const paint = (i: number) => {
    d[at(i)] = r
    d[at(i) + 1] = g
    d[at(i) + 2] = b
    d[at(i) + 3] = 255
  }
  for (const i of filled) {
    paint(i)
    const px = i % W
    if (px > 0) paint(i - 1)
    if (px < W - 1) paint(i + 1)
    if (i >= W) paint(i - W)
    if (i < W * (H - 1)) paint(i + W)
  }
  ctx.putImageData(img, 0, 0)
}

/** 선 하나 그리기. from = 펜 선에서 이 점부터만 (이어 그릴 때) */
export function drawStroke(ctx: CanvasRenderingContext2D, s: Stroke, from = 0) {
  const k = s.k ?? 'p'
  const p = s.p
  if (k === 'f') return floodFill(ctx, p[0], p[1], s.c)
  ctx.strokeStyle = s.c
  ctx.fillStyle = s.c
  ctx.lineWidth = s.w
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  ctx.beginPath()
  if (k === 'l') {
    ctx.moveTo(p[0], p[1])
    ctx.lineTo(p[2], p[3])
  } else if (k === 'r') {
    ctx.rect(Math.min(p[0], p[2]), Math.min(p[1], p[3]), Math.abs(p[2] - p[0]), Math.abs(p[3] - p[1]))
  } else if (k === 'e') {
    ctx.ellipse((p[0] + p[2]) / 2, (p[1] + p[3]) / 2, Math.abs(p[2] - p[0]) / 2, Math.abs(p[3] - p[1]) / 2, 0, 0, Math.PI * 2)
  } else if (p.length === 2) {
    ctx.arc(p[0], p[1], s.w / 2, 0, Math.PI * 2)
    ctx.fill()
    return
  } else {
    const start = Math.max(0, from - 2)
    ctx.moveTo(p[start], p[start + 1])
    for (let i = start + 2; i < p.length; i += 2) ctx.lineTo(p[i], p[i + 1])
  }
  ctx.stroke()
}
