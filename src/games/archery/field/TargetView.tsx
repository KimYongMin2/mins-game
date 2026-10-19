import { type Distance, RING_WIDTH, TARGET_RADIUS, X_RADIUS } from '../constants'
import type { Point } from '../rules/scoring'
import { viewHalfSize } from './view'

export type StuckArrow = { at: Point; latest: boolean }

type Props = {
  distance: Distance
  /** 조준점 (흔들림 포함). 없으면 그리지 않는다 */
  reticle?: Point | null
  /** 0~1 당긴 정도. 조준점 모양에 반영 */
  drawProgress?: number
  /** 이 거리에서 이미 꽂힌 화살 */
  arrows?: StuckArrow[]
  /** 날아가는 화살: 꽂힐 자리와 진행도(0~1) */
  flying?: { to: Point; progress: number } | null
}

// 실제 양궁 과녁 색을 옅게: 바깥부터 흰·흰·검·검·파·파·빨·빨·노·노
const ZONE_CLASS = ['white', 'white', 'black', 'black', 'blue', 'blue', 'red', 'red', 'gold', 'gold']

export function TargetView({ distance, reticle = null, drawProgress = 0, arrows = [], flying = null }: Props) {
  const h = viewHalfSize(distance)
  /** 화면 기준 단위 (보이는 범위의 1%) */
  const u = h / 50

  return (
    <svg
      className="ar-target"
      viewBox={`${-h} ${-h} ${h * 2} ${h * 2}`}
      role="img"
      aria-label={`${distance}m 과녁`}
    >
      {/* 과녁 판 */}
      <rect
        x={-TARGET_RADIUS * 1.12}
        y={-TARGET_RADIUS * 1.12}
        width={TARGET_RADIUS * 2.24}
        height={TARGET_RADIUS * 2.24}
        rx={TARGET_RADIUS * 0.06}
        className="ar-board"
      />
      {/* 바깥 링부터 그린다 (1점 → 10점) */}
      {Array.from({ length: 10 }, (_, i) => (
        <circle
          key={i}
          cx={0}
          cy={0}
          r={TARGET_RADIUS - i * RING_WIDTH}
          className={`ar-ring ar-ring--${ZONE_CLASS[i]}`}
        />
      ))}
      <circle cx={0} cy={0} r={X_RADIUS} className="ar-ring ar-ring--x" />
      <path d={`M${-u} 0 L${u} 0 M0 ${-u} L0 ${u}`} className="ar-center" />

      {arrows.map((a, i) => (
        <g key={i} className={a.latest ? 'ar-hit ar-hit--latest' : 'ar-hit'}>
          <circle cx={a.at.x} cy={-a.at.y} r={Math.max(0.012, u * 0.9)} />
          <path
            d={`M${a.at.x - u * 1.6} ${-a.at.y - u * 1.6} L${a.at.x + u * 1.6} ${-a.at.y + u * 1.6}
                M${a.at.x - u * 1.6} ${-a.at.y + u * 1.6} L${a.at.x + u * 1.6} ${-a.at.y - u * 1.6}`}
          />
        </g>
      ))}

      {flying && (
        // 궁수 쪽(화면 아래)에서 출발해 작아지며 꽂힐 자리로 날아가는 화살 (정면에서 본 화살 꽁무니)
        <circle
          cx={flying.to.x * flying.progress}
          cy={-(-h + (flying.to.y + h) * flying.progress)}
          r={u * (1 + (1 - flying.progress) * 2.5)}
          className="ar-flying"
        />
      )}

      {reticle && (
        <g className="ar-reticle" style={{ opacity: 0.45 + drawProgress * 0.55 }}>
          <circle cx={reticle.x} cy={-reticle.y} r={u * (5 - drawProgress * 2.5)} />
          <path
            d={`M${reticle.x - u * 8} ${-reticle.y} L${reticle.x - u * 2.5} ${-reticle.y}
                M${reticle.x + u * 2.5} ${-reticle.y} L${reticle.x + u * 8} ${-reticle.y}
                M${reticle.x} ${-reticle.y - u * 8} L${reticle.x} ${-reticle.y - u * 2.5}
                M${reticle.x} ${-reticle.y + u * 2.5} L${reticle.x} ${-reticle.y + u * 8}`}
          />
        </g>
      )}
    </svg>
  )
}
