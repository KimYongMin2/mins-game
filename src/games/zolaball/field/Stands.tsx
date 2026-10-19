import { memo } from 'react'
import {
  STANDS_START,
  STANDS_STEPS,
  STANDS_STEP_DEPTH,
  STANDS_STEP_RISE,
} from '../constants'
import { Spectator } from './StickMen'

const SEATS_PER_STEP = 2

// 렌더링마다 바뀌지 않도록 관중 배치는 고정 패턴으로 만든다.
const spectators = Array.from({ length: STANDS_STEPS }, (_, step) =>
  Array.from({ length: SEATS_PER_STEP }, (_, seat) => {
    const offset = (seat + 0.5) / SEATS_PER_STEP
    const jitter = (((step * 7 + seat * 3) % 5) - 2) * 0.12
    return {
      key: `${step}-${seat}`,
      x: STANDS_START + step * STANDS_STEP_DEPTH + STANDS_STEP_DEPTH * (offset + jitter * 0.3),
      ground: (step + 1) * STANDS_STEP_RISE,
      cheer: (step + seat) % 3 === 0,
    }
  }),
).flat()

export const Stands = memo(function Stands() {
  const topY = STANDS_STEPS * STANDS_STEP_RISE
  const endX = STANDS_START + STANDS_STEPS * STANDS_STEP_DEPTH

  // 계단 모양 외곽선: 지면에서 올라가 맨 위에서 뒤쪽 벽으로 내려온다.
  let d = `M${STANDS_START} 0`
  for (let i = 0; i < STANDS_STEPS; i++) {
    const x = STANDS_START + i * STANDS_STEP_DEPTH
    const y = (i + 1) * STANDS_STEP_RISE
    d += ` L${x} ${-y} L${x + STANDS_STEP_DEPTH} ${-y}`
  }
  d += ` L${endX} 0`

  return (
    <g>
      <path d={d} className="zb-line zb-fill-paper" />
      {/* 맨 위 난간 */}
      <path d={`M${endX - 4} ${-topY - 2.5} L${endX} ${-topY - 2.5} L${endX} ${-topY}`} className="zb-line" />
      {spectators.map((s) => (
        <Spectator key={s.key} x={s.x} ground={s.ground} height={2.4} cheer={s.cheer} />
      ))}
    </g>
  )
})
