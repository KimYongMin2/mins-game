import { useRef, useState } from 'react'
import { CANCEL_PULL, EDGE, LINES, MAX_PULL, RADIUS } from '../constants'
import type { Frame, Side } from '../rules/physics'

type Props = {
  /** 지금 보여줄 돌 자리 */
  frame: Frame
  /** 돌마다 편 (같은 순서) */
  sides: readonly Side[]
  /** 흑인 쪽 */
  black: Side
  /** 내 돌을 당겨 튕길 수 있는지 */
  canShoot: boolean
  /** power는 0~1 */
  onShoot: (index: number, dirX: number, dirY: number, power: number) => void
}

const U = 10
const PAD = -EDGE.min * U
const VIEW = (EDGE.max - EDGE.min) * U
const c = (v: number) => PAD + v * U
/** 화점 (판의 점) */
const STARS = [3, 7, 11].flatMap((y) => [3, 7, 11].map((x) => [x, y]))
/** 돌을 누를 때 이만큼(칸) 떨어져도 잡힘 (폰에서 돌이 작아서) */
const GRAB = 1.1

/** (x, y)에서 (ux, uy) 방향으로 판 끝까지 거리 */
function toEdge(p: { x: number; y: number }, ux: number, uy: number): number {
  const along = (v: number, u: number) => (u > 0 ? (EDGE.max - v) / u : u < 0 ? (EDGE.min - v) / u : Infinity)
  return Math.max(0, Math.min(along(p.x, ux), along(p.y, uy)))
}

/** sx, sy = 처음 누른 곳, px, py = 지금 손가락 (판 좌표) */
type Drag = { index: number; pointerId: number; sx: number; sy: number; px: number; py: number }

/** 알까기 판. 내 돌을 누른 채 뒤로 당겼다 놓으면 반대쪽으로 튕긴다 (새총처럼) */
export function Board({ frame, sides, black, canShoot, onShoot }: Props) {
  const svgRef = useRef<SVGSVGElement>(null)
  const [drag, setDrag] = useState<Drag | null>(null)
  const active = drag && canShoot ? drag : null

  /** 화면 좌표 → 판 좌표(칸) */
  const toBoard = (clientX: number, clientY: number) => {
    const rect = svgRef.current!.getBoundingClientRect()
    const scale = rect.width / VIEW
    return { x: ((clientX - rect.left) / scale - PAD) / U, y: ((clientY - rect.top) / scale - PAD) / U }
  }

  /** 당긴 정도: 처음 누른 곳에서 손가락이 움직인 반대쪽으로.
   *  돌 가운데가 아니라 누른 곳 기준이라 돌을 살짝 빗겨 잡아도 방향이 틀어지지 않는다 */
  const pullOf = (d: Drag) => {
    const dx = d.sx - d.px
    const dy = d.sy - d.py
    const len = Math.hypot(dx, dy)
    return { dx, dy, len, power: Math.min(1, len / MAX_PULL) }
  }

  const down = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!canShoot || drag) return
    const p = toBoard(e.clientX, e.clientY)
    let best = -1
    let bestD = GRAB
    frame.forEach((s, i) => {
      if (sides[i] !== 0 || !s.on) return
      const d = Math.hypot(s.x - p.x, s.y - p.y)
      if (d < bestD) {
        bestD = d
        best = i
      }
    })
    if (best < 0) return
    e.currentTarget.setPointerCapture(e.pointerId)
    setDrag({ index: best, pointerId: e.pointerId, sx: p.x, sy: p.y, px: p.x, py: p.y })
  }
  const move = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!drag || e.pointerId !== drag.pointerId) return
    const p = toBoard(e.clientX, e.clientY)
    setDrag({ ...drag, px: p.x, py: p.y })
  }
  const up = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!drag || e.pointerId !== drag.pointerId) return
    setDrag(null)
    if (!canShoot) return
    const p = toBoard(e.clientX, e.clientY)
    const pull = pullOf({ ...drag, px: p.x, py: p.y })
    // 조금만 당겼으면(돌 근처로 되돌리면) 취소
    if (pull.len < CANCEL_PULL) return
    onShoot(drag.index, pull.dx / pull.len, pull.dy / pull.len, pull.power)
  }

  const pull = active ? pullOf(active) : null
  const shooter = active ? frame[active.index] : null

  return (
    <svg
      ref={svgRef}
      className={`ak-board${canShoot ? ' ak-board--aim' : ''}`}
      viewBox={`0 0 ${VIEW} ${VIEW}`}
      onPointerDown={down}
      onPointerMove={move}
      onPointerUp={up}
      onPointerCancel={() => setDrag(null)}
      role="img"
      aria-label="알까기 판"
    >
      <rect className="ak-board__bg" x={0} y={0} width={VIEW} height={VIEW} rx={2} />
      {Array.from({ length: LINES }, (_, i) => (
        <g key={i} className="ak-board__line">
          <line x1={c(0)} y1={c(i)} x2={c(LINES - 1)} y2={c(i)} />
          <line x1={c(i)} y1={c(0)} x2={c(i)} y2={c(LINES - 1)} />
        </g>
      ))}
      {STARS.map(([x, y]) => (
        <circle key={`${x}-${y}`} className="ak-board__star" cx={c(x)} cy={c(y)} r={1.1} />
      ))}

      {pull && shooter && (
        <g className={`ak-aim${pull.len < CANCEL_PULL ? ' ak-aim--cancel' : ''}`}>
          {/* 고무줄: 돌 → 당긴 만큼 뒤 */}
          <line className="ak-aim__band" x1={c(shooter.x)} y1={c(shooter.y)} x2={c(shooter.x - pull.dx)} y2={c(shooter.y - pull.dy)} />
          {/* 조준선: 판 끝까지 곧게 (세밀하게 맞추라고) */}
          {pull.len >= CANCEL_PULL && (
            <line
              className="ak-aim__guide"
              x1={c(shooter.x)}
              y1={c(shooter.y)}
              x2={c(shooter.x + (pull.dx / pull.len) * toEdge(shooter, pull.dx / pull.len, pull.dy / pull.len))}
              y2={c(shooter.y + (pull.dy / pull.len) * toEdge(shooter, pull.dx / pull.len, pull.dy / pull.len))}
            />
          )}
          {/* 날아갈 방향과 세기 */}
          {pull.len >= CANCEL_PULL && (
            <line
              className="ak-aim__arrow"
              x1={c(shooter.x)}
              y1={c(shooter.y)}
              x2={c(shooter.x + (pull.dx / pull.len) * (1 + pull.power * 5))}
              y2={c(shooter.y + (pull.dy / pull.len) * (1 + pull.power * 5))}
              markerEnd="url(#ak-head)"
            />
          )}
          <text className="ak-aim__power" x={VIEW / 2} y={PAD + 2}>
            {pull.len < CANCEL_PULL ? '놓으면 취소' : `세기 ${Math.round(pull.power * 100)}%`}
          </text>
        </g>
      )}

      {frame.map((s, i) =>
        s.on ? (
          <circle
            key={i}
            className={`ak-stone ak-stone--${sides[i] === black ? 'black' : 'white'}${canShoot && sides[i] === 0 ? ' ak-stone--mine' : ''}${
              active?.index === i ? ' ak-stone--held' : ''
            }`}
            cx={c(s.x)}
            cy={c(s.y)}
            r={RADIUS * U}
          />
        ) : null,
      )}

      <defs>
        <marker id="ak-head" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="4" markerHeight="4" orient="auto-start-reverse">
          <path d="M0 0L10 5L0 10z" className="ak-aim__head" />
        </marker>
      </defs>
    </svg>
  )
}
