import {
  BATTER_X,
  DISTANCE_MARKS,
  FENCE_DISTANCE,
  FENCE_HEIGHT,
  MOUND_HEIGHT,
  PITCHER_DISTANCE,
  PLAYER_HEIGHT,
} from '../constants'
import { type Point, STRIKE_ZONE } from '../play/pitch'
import { type Camera, screenUnit, viewBoxOf } from './camera'
import { Clouds } from './Clouds'
import { Stands } from './Stands'
import { Batter, Pitcher } from './StickMen'

type Props = {
  camera: Camera
  /** 공 위치(월드 좌표). 없으면 그리지 않는다. */
  ball?: Point | null
  /** 타자 스윙 진행도(0~1). null이면 준비 자세. */
  swing?: number | null
}

const BALL_RADIUS = 0.2 // 잘 보이도록 실제(약 0.037m)보다 크게

const GROUND_END = 175
const MINOR_TICK_EVERY = 10

export function Field({ camera, ball = null, swing = null }: Props) {
  const u = screenUnit(camera)
  const minorTicks = Array.from(
    { length: Math.floor(GROUND_END / MINOR_TICK_EVERY) },
    (_, i) => (i + 1) * MINOR_TICK_EVERY,
  ).filter((x) => !DISTANCE_MARKS.includes(x))

  return (
    <svg
      className="zb-field"
      viewBox={viewBoxOf(camera)}
      role="img"
      aria-label="졸라볼 경기장: 홈에서 120m 거리에 펜스와 관중석이 있다"
    >
      <Clouds />
      <Stands />

      {/* 펜스 */}
      <g>
        <path d={`M${FENCE_DISTANCE} 0 L${FENCE_DISTANCE} ${-FENCE_HEIGHT}`} className="zb-fence" />
        <path
          d={`M${FENCE_DISTANCE - 1} ${-FENCE_HEIGHT} L${FENCE_DISTANCE + 1} ${-FENCE_HEIGHT}`}
          className="zb-line"
        />
        <text
          x={FENCE_DISTANCE}
          y={-FENCE_HEIGHT - u * 1.2}
          fontSize={u * 2.2}
          textAnchor="middle"
          className="zb-label zb-label--fence"
        >
          {FENCE_DISTANCE}m
        </text>
      </g>

      {/* 지면과 거리 눈금 (눈금·글자는 지면 아래쪽에 두어 관중석에 가리지 않게) */}
      <path d={`M-50 0 L${GROUND_END} 0`} className="zb-ground" />
      {minorTicks.map((x) => (
        <path key={x} d={`M${x} 0 L${x} ${u * 0.8}`} className="zb-tick" />
      ))}
      {DISTANCE_MARKS.map((x) => (
        <g key={x}>
          <path d={`M${x} 0 L${x} ${u * 1.6}`} className="zb-line" />
          <text x={x} y={u * 4} fontSize={u * 2.2} textAnchor="middle" className="zb-label">
            {x}m
          </text>
        </g>
      ))}

      {/* 마운드와 투수 */}
      <path
        d={`M${PITCHER_DISTANCE - 2.8} 0 Q${PITCHER_DISTANCE} ${-MOUND_HEIGHT * 2} ${PITCHER_DISTANCE + 2.8} 0`}
        className="zb-line zb-fill-paper"
      />
      <Pitcher x={PITCHER_DISTANCE} ground={MOUND_HEIGHT} height={PLAYER_HEIGHT} />

      {/* 홈플레이트와 타자 */}
      <path d="M-0.3 0 L0.3 0" className="zb-plate" />
      {/* 스트라이크 존: 홈플레이트 위 상자 (옆에서 본 높이 범위) */}
      <rect
        x={-0.3}
        y={-STRIKE_ZONE.top}
        width={0.6}
        height={STRIKE_ZONE.top - STRIKE_ZONE.bottom}
        className="zb-zone"
      />
      <Batter x={BATTER_X} height={PLAYER_HEIGHT} swing={swing} />

      {/* 카메라가 멀어져도 공이 점처럼 사라지지 않게 화면 기준 최소 크기를 둔다 */}
      {ball && <circle cx={ball.x} cy={-ball.y} r={Math.max(BALL_RADIUS, u * 0.5)} className="zb-ball" />}
    </svg>
  )
}
