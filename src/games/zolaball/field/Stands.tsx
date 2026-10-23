import { STANDS_START, STANDS_STEPS, STANDS_STEP_DEPTH, STANDS_STEP_RISE } from '../constants'
import { Spectator } from './Players'

const SEATS_PER_STEP = 3

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
      shirt: step * 5 + seat * 3,
      phase: (step * 1.7 + seat * 2.3) % 6.28,
    }
  }),
).flat()

const TOWER_X = STANDS_START + STANDS_STEPS * STANDS_STEP_DEPTH + 4
const TOWER_TOP = STANDS_STEPS * STANDS_STEP_RISE + 16

/** 계단식 관중석 + 관중 + 조명탑. celebrate면 모두 일어나 팔을 들고 들썩인다 */
export function Stands({ celebrate = false, now = 0 }: { celebrate?: boolean; now?: number }) {
  const topY = STANDS_STEPS * STANDS_STEP_RISE
  const endX = STANDS_START + STANDS_STEPS * STANDS_STEP_DEPTH

  // 계단 모양: 지면에서 올라가 맨 위에서 뒤쪽 벽으로 내려온다.
  let d = `M${STANDS_START} 0`
  for (let i = 0; i < STANDS_STEPS; i++) {
    const x = STANDS_START + i * STANDS_STEP_DEPTH
    const y = (i + 1) * STANDS_STEP_RISE
    d += ` L${x} ${-y} L${x + STANDS_STEP_DEPTH} ${-y}`
  }
  d += ` L${endX} 0 Z`

  return (
    <g>
      {/* 조명탑 */}
      <path d={`M${TOWER_X} 0 L${TOWER_X} ${-TOWER_TOP}`} className="zb-tower" />
      <rect x={TOWER_X - 5} y={-TOWER_TOP - 5} width={10} height={6} rx={0.8} className="zb-tower__head" />
      {[-3, 0, 3].map((dx) =>
        [-3.3, -1.3].map((dy) => <circle key={`${dx},${dy}`} cx={TOWER_X + dx} cy={-TOWER_TOP + dy} r={0.8} className="zb-tower__lamp" />),
      )}
      <path d={d} className="zb-stands" />
      {/* 좌석 줄 */}
      {Array.from({ length: STANDS_STEPS }, (_, i) => (
        <path
          key={i}
          d={`M${STANDS_START + i * STANDS_STEP_DEPTH} ${-(i + 1) * STANDS_STEP_RISE + 0.6} L${STANDS_START + (i + 1) * STANDS_STEP_DEPTH} ${-(i + 1) * STANDS_STEP_RISE + 0.6}`}
          className="zb-stands__seat"
        />
      ))}
      {/* 맨 위 난간 */}
      <path d={`M${endX - 4} ${-topY - 2.5} L${endX} ${-topY - 2.5} L${endX} ${-topY}`} className="zb-stands__rail" />
      {spectators.map((s) => (
        <Spectator
          key={s.key}
          x={s.x}
          ground={s.ground}
          height={2.4}
          shirt={s.shirt}
          cheer={celebrate || s.cheer}
          jump={celebrate ? Math.max(0, Math.sin(now / 110 + s.phase)) * 0.9 : 0}
        />
      ))}
    </g>
  )
}
