import type { Distance } from '../constants'

// 옆에서 본 궁수와 과녁. 실제 비율이 아니라 거리가 멀수록 과녁이 오른쪽으로 멀어지는 그림.
// 좌표는 화면 단위(가로 100), y는 위가 +.

type Props = {
  distance: Distance
  /** 당긴 정도 0~1 */
  draw?: number
  /** 날아가는 화살 진행도 0~1 */
  arrowProgress?: number | null
}

const ARCHER_X = 9
const GROUND_Y = 0
const SHOULDER_Y = 8.5

function targetX(distance: Distance) {
  return 30 + ((distance - 30) / 70) * 62
}

const p = (x: number, y: number) => `${x} ${-y}`

function Archer({ draw }: { draw: number }) {
  const x = ARCHER_X
  const bowX = x + 5.2
  const handY = SHOULDER_Y
  // 시위를 당기는 손: 활에서 얼굴 쪽으로
  const pullX = bowX - 1 - draw * 4.6
  const bowTop = { x: bowX, y: handY + 4.2 }
  const bowBottom = { x: bowX, y: handY - 4.2 }

  return (
    <g className="ar-figure">
      {/* 다리 */}
      <path d={`M${p(x, 4.5)} L${p(x - 1.6, GROUND_Y)} M${p(x, 4.5)} L${p(x + 1.6, GROUND_Y)}`} />
      {/* 몸통 */}
      <path d={`M${p(x, 4.5)} L${p(x, 9.6)}`} />
      {/* 활을 든 팔 (앞으로 쭉) */}
      <path d={`M${p(x, SHOULDER_Y)} L${p(bowX, handY)}`} />
      {/* 시위 당기는 팔 */}
      <path d={`M${p(x, SHOULDER_Y)} L${p(x + 1.2, SHOULDER_Y - 1.4)} L${p(pullX, handY)}`} />
      {/* 활 */}
      <path
        className="ar-bow"
        d={`M${p(bowTop.x, bowTop.y)} Q${p(bowX + 2.6 + draw * 0.8, handY)} ${p(bowBottom.x, bowBottom.y)}`}
      />
      {/* 시위 */}
      <path
        className="ar-string"
        d={`M${p(bowTop.x, bowTop.y)} L${p(pullX, handY)} L${p(bowBottom.x, bowBottom.y)}`}
      />
      {/* 화살 (당기는 중) */}
      {draw > 0 && <path className="ar-arrow" d={`M${p(pullX, handY)} L${p(pullX + 7.2, handY)}`} />}
      <circle cx={x} cy={-11} r={1.4} className="ar-head" />
    </g>
  )
}

export function SideView({ distance, draw = 0, arrowProgress = null }: Props) {
  const tx = targetX(distance)
  const startX = ARCHER_X + 6
  const arrowX = arrowProgress === null ? null : startX + (tx - startX) * arrowProgress
  // 살짝 포물선
  const arrowY =
    arrowProgress === null ? 0 : SHOULDER_Y + Math.sin(arrowProgress * Math.PI) * (1 + distance / 40)

  return (
    <svg className="ar-side" viewBox="0 -16 100 18" role="img" aria-label={`궁수와 ${distance}m 떨어진 과녁`}>
      <path d={`M0 0 L100 0`} className="ar-ground" />
      {/* 거리 표시 */}
      <path d={`M${ARCHER_X} 1 L${tx} 1`} className="ar-measure" />
      <text x={(ARCHER_X + tx) / 2} y={1.9} className="ar-distance-label" textAnchor="middle">
        {distance}m
      </text>

      {/* 과녁 받침대와 과녁(옆모습) */}
      <g className="ar-figure">
        <path d={`M${p(tx - 1.6, 0)} L${p(tx, 9)} L${p(tx + 1.6, 0)}`} />
        <path className="ar-face" d={`M${p(tx - 0.6, 11.5)} L${p(tx + 0.6, 4.5)}`} />
      </g>

      <Archer draw={arrowProgress === null ? draw : 0} />

      {arrowX !== null && (
        <path className="ar-arrow" d={`M${p(arrowX - 4, arrowY)} L${p(arrowX, arrowY)}`} />
      )}
    </svg>
  )
}
