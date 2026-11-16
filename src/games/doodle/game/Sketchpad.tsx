import { type ReactNode, type Ref, useEffect, useImperativeHandle, useRef, useState } from 'react'
import { CANVAS_H, CANVAS_W } from '../constants'
import { ERASER, type InkOp, PEN_COLORS, PEN_WIDTHS, type Stroke, type StrokeKind, applyOps, drawStroke } from '../play/ink'

// 그림판 (맞히기·다 같이 그리기가 같이 씀): 흰 그림판 + 도형 미리 보기 판 + (그릴 때) 도구.
// 그린 조각은 바로 내 판에 그리고 0.04초마다 묶어서 onSend로 넘긴다. 받은 그림은 handle.apply로 넣는다.

export type SketchHandle = {
  /** 받은 그림 조각 넣기 (바뀐 부분만 그림) */
  apply: (ops: readonly InkOp[]) => void
  /** 다 지우고 처음부터 (새 차례·처음 받은 그림 전부) */
  load: (ops: readonly InkOp[]) => void
}

/** 그리기 도구 (사용자 요청 — 그림판처럼): 펜 · 직선 · 네모 · 동그라미 · 채우기 · 지우개(흰 펜) */
type Tool = 'pen' | 'line' | 'rect' | 'ellipse' | 'fill' | 'eraser'
const TOOLS: { id: Tool; label: string }[] = [
  { id: 'pen', label: '펜' },
  { id: 'line', label: '직선' },
  { id: 'rect', label: '네모' },
  { id: 'ellipse', label: '동그라미' },
  { id: 'fill', label: '채우기' },
  { id: 'eraser', label: '지우개' },
]
const SHAPE_KIND: Partial<Record<Tool, StrokeKind>> = { line: 'l', rect: 'r', ellipse: 'e' }
/** 그림 묶어 보내는 간격 */
const SEND_MS = 40

type Props = {
  padRef: Ref<SketchHandle>
  /** 내가 그릴 수 있을 때 (도구가 보임) */
  drawing: boolean
  /** 모아 둔 내 그림 조각 (0.04초마다) */
  onSend: (ops: InkOp[]) => void
  /** 그림판 위에 겹칠 것 (제시어 고르기 등) */
  children?: ReactNode
}

export function Sketchpad({ padRef, drawing, onSend, children }: Props) {
  const [color, setColor] = useState<string>(PEN_COLORS[0])
  const [width, setWidth] = useState<number>(PEN_WIDTHS[1])
  const [tool, setTool] = useState<Tool>('pen')
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const previewRef = useRef<HTMLCanvasElement>(null)
  const strokesRef = useRef<Stroke[]>([])
  const pendingRef = useRef<InkOp[]>([])
  const penRef = useRef<{ id: number; last: [number, number] } | null>(null)
  const shapeRef = useRef<{ kind: StrokeKind; from: [number, number]; to: [number, number] } | null>(null)
  const sendRef = useRef(onSend)
  useEffect(() => {
    sendRef.current = onSend
  })

  const redraw = () => {
    const ctx = canvasRef.current?.getContext('2d')
    if (!ctx) return
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H)
    for (const s of strokesRef.current) drawStroke(ctx, s)
  }

  /** 조각을 하나씩: 선 시작·이어 그리기는 그 부분만, 지우기는 다시 그림 (한 묶음을 한꺼번에 넣고 그렸더니 점선처럼 끊겼음) */
  const apply = (ops: readonly InkOp[]) => {
    const ctx = canvasRef.current?.getContext('2d')
    for (const o of ops) {
      strokesRef.current = applyOps(strokesRef.current, [o])
      if (!ctx) continue
      if (o.op === 'u' || o.op === 'x') {
        redraw()
        continue
      }
      const s = strokesRef.current.find((x) => x.id === o.id)
      if (!s) continue
      if (o.op === 's') drawStroke(ctx, s)
      else drawStroke(ctx, s, s.p.length - o.p.length)
    }
  }

  useImperativeHandle(padRef, () => ({
    apply,
    load: (ops) => {
      strokesRef.current = []
      pendingRef.current = []
      redraw()
      apply(ops)
    },
  }))

  useEffect(redraw, [])

  useEffect(() => {
    const id = setInterval(() => {
      const ops = pendingRef.current
      if (!ops.length) return
      pendingRef.current = []
      sendRef.current(ops)
    }, SEND_MS)
    return () => clearInterval(id)
  }, [])

  const queue = (ops: InkOp[]) => {
    apply(ops)
    pendingRef.current.push(...ops)
  }

  function pointOf(e: React.PointerEvent<HTMLCanvasElement>): [number, number] {
    const r = e.currentTarget.getBoundingClientRect()
    const x = Math.round(((e.clientX - r.left) / r.width) * CANVAS_W)
    const y = Math.round(((e.clientY - r.top) / r.height) * CANVAS_H)
    return [Math.min(CANVAS_W, Math.max(0, x)), Math.min(CANVAS_H, Math.max(0, y))]
  }

  const newId = () => (Date.now() % 1e8) * 10 + Math.floor(Math.random() * 10)

  /** 도형 미리 보기 (위에 겹친 투명 판) */
  function showPreview() {
    const ctx = previewRef.current?.getContext('2d')
    if (!ctx) return
    ctx.clearRect(0, 0, CANVAS_W, CANVAS_H)
    const sh = shapeRef.current
    if (sh) drawStroke(ctx, { id: 0, c: color, w: width, k: sh.kind, p: [...sh.from, ...sh.to] })
  }

  function down(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawing) return
    e.currentTarget.setPointerCapture(e.pointerId)
    const p = pointOf(e)
    if (tool === 'fill') return queue([{ op: 's', id: newId(), c: color, w: width, p, k: 'f' }])
    const kind = SHAPE_KIND[tool]
    if (kind) {
      shapeRef.current = { kind, from: p, to: p }
      return showPreview()
    }
    const id = newId()
    penRef.current = { id, last: p }
    queue([{ op: 's', id, c: tool === 'eraser' ? ERASER : color, w: tool === 'eraser' ? Math.max(width, 16) : width, p }])
  }

  function move(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawing) return
    if (shapeRef.current) {
      shapeRef.current.to = pointOf(e)
      return showPreview()
    }
    const pen = penRef.current
    if (!pen) return
    const p = pointOf(e)
    // 너무 가까운 점은 건너뜀 (보낼 양 줄이기)
    if (Math.hypot(p[0] - pen.last[0], p[1] - pen.last[1]) < 3) return
    pen.last = p
    queue([{ op: 'a', id: pen.id, p }])
  }

  const up = () => {
    penRef.current = null
    const sh = shapeRef.current
    shapeRef.current = null
    if (!sh) return
    showPreview()
    // 거의 안 끈 도형은 버림
    if (Math.hypot(sh.to[0] - sh.from[0], sh.to[1] - sh.from[1]) < 4) return
    queue([{ op: 's', id: newId(), c: color, w: width, p: [...sh.from, ...sh.to], k: sh.kind }])
  }

  return (
    <>
      <div className="dd-board">
        <canvas
          ref={canvasRef}
          className={`dd-canvas${drawing ? ' dd-canvas--drawing' : ''}`}
          width={CANVAS_W}
          height={CANVAS_H}
          onPointerDown={down}
          onPointerMove={move}
          onPointerUp={up}
          onPointerCancel={up}
          aria-label="그림판"
        />
        <canvas ref={previewRef} className="dd-canvas dd-canvas--preview" width={CANVAS_W} height={CANVAS_H} aria-hidden />
        {children}
      </div>

      {drawing && (
        <div className="dd-tools" role="group" aria-label="그리기 도구">
          <div className="dd-tools__kinds" role="radiogroup" aria-label="도구">
            {TOOLS.map((t) => (
              <button key={t.id} type="button" role="radio" aria-checked={tool === t.id} className={`dd-tool${tool === t.id ? ' dd-tool--on' : ''}`} onClick={() => setTool(t.id)}>
                {t.label}
              </button>
            ))}
          </div>
          <div className="dd-tools__colors">
            {PEN_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                className={`dd-swatch${color === c && tool !== 'eraser' ? ' dd-swatch--on' : ''}`}
                style={{ background: c }}
                aria-label={`색 ${c}`}
                aria-pressed={color === c}
                onClick={() => {
                  setColor(c)
                  if (tool === 'eraser') setTool('pen')
                }}
              />
            ))}
          </div>
          <div className="dd-tools__row">
            {PEN_WIDTHS.map((w) => (
              <button key={w} type="button" className={`dd-width${width === w ? ' dd-width--on' : ''}`} aria-label={`굵기 ${w}`} aria-pressed={width === w} onClick={() => setWidth(w)}>
                <span style={{ width: Math.min(22, w), height: Math.min(22, w) }} />
              </button>
            ))}
            <button type="button" className="button button--small" onClick={() => queue([{ op: 'u' }])}>
              되돌리기
            </button>
            <button type="button" className="button button--small" onClick={() => queue([{ op: 'x' }])}>
              다 지우기
            </button>
          </div>
        </div>
      )}
    </>
  )
}

/** 작은 그림 (투표 화면): 받은 조각을 한 번에 그림 */
export function Thumb({ ops, label }: { ops: readonly InkOp[]; label: string }) {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const ctx = ref.current?.getContext('2d')
    if (!ctx) return
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H)
    for (const s of applyOps([], ops)) drawStroke(ctx, s)
  }, [ops])
  return <canvas ref={ref} className="dd-thumb" width={CANVAS_W} height={CANVAS_H} aria-label={label} />
}
