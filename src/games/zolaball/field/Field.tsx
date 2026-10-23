import {
  BATTER_X,
  DISTANCE_MARKS,
  FENCE_DISTANCE,
  FENCE_HEIGHT,
  MOUND_HEIGHT,
  PITCHER_DISTANCE,
  PLAYER_HEIGHT,
  TEAM_COLORS,
} from '../constants'
import { type Point, STRIKE_ZONE } from '../play/pitch'
import { type Camera, screenUnit, viewBoxOf } from './camera'
import { Clouds } from './Clouds'
import { Ball, ImpactBurst } from './Effects'
import { type Impact, shakeOf } from './impact'
import { Batter, Pitcher } from './Players'
import { Stands } from './Stands'

// 옆에서 본 야구장 (처음엔 흰 배경 선화였는데 하늘·잔디·흙·관중석에 색을 넣은 만화풍으로 바꿈).

type Props = {
  camera: Camera
  /** 공 위치(월드 좌표). 없으면 그리지 않는다. */
  ball?: Point | null
  /** 공 꼬리: 조금 전 자리들 (가까운 것부터) */
  trail?: Point[]
  /** 타자 스윙 진행도(0~1). null이면 준비 자세. */
  swing?: number | null
  /** 투수 동작: 공을 놓는 순간 기준 ms. null이면 준비 자세 */
  throwT?: number | null
  /** 공이 홈플레이트를 지난 자리 표시. 볼/스트라이크를 눈으로 확인할 수 있게 한다. */
  mark?: Point | null
  /** 배트에 맞은 순간 효과 */
  impact?: Impact | null
  /** 홈런: 관중이 일어나 들썩인다 */
  celebrate?: boolean
  /** 유니폼 색 */
  colors?: { batter: string; pitcher: string }
  /** 숨쉬기·관중 들썩임 같은 잔동작용 시각 */
  now?: number
}

const BALL_RADIUS = 0.15 // 잘 보이도록 실제(약 0.037m)보다 크게, 존 근처 볼이 존에 걸쳐 보이지 않을 만큼만

const GROUND_END = 175
const GROUND_START = -50

export function Field({
  camera,
  ball = null,
  trail = [],
  swing = null,
  throwT = null,
  mark = null,
  impact = null,
  celebrate = false,
  colors = { batter: TEAM_COLORS.me, pitcher: TEAM_COLORS.opponent },
  now = 0,
}: Props) {
  const u = screenUnit(camera)
  const shake = shakeOf(impact, u)

  return (
    <svg
      className="zb-field"
      viewBox={viewBoxOf(camera)}
      role="img"
      aria-label="야구 경기장: 홈에서 120m 거리에 펜스와 관중석이 있다"
    >
      <g transform={`translate(${shake.x} ${shake.y})`}>
        <Clouds />
        <Stands celebrate={celebrate} now={now} />

        {/* 땅: 한 가지 색 (처음엔 잔디 줄무늬·흙 띠가 있었는데 어지러워 통일) */}
        <rect x={GROUND_START} y={0} width={GROUND_END - GROUND_START} height={200} className="zb-grass" />
        <path d={`M${GROUND_START} 0 L${GROUND_END} 0`} className="zb-ground" />

        {/* 거리 눈금 (지면 아래 잔디에) */}
        {DISTANCE_MARKS.map((x) => (
          <g key={x}>
            <path d={`M${x} 0 L${x} ${u * 1.6}`} className="zb-tick" />
            <text x={x} y={u * 4} fontSize={u * 2.2} strokeWidth={u * 0.4} textAnchor="middle" className="zb-label">
              {x}m
            </text>
          </g>
        ))}

        {/* 펜스: 초록 벽 + 노란 윗줄 */}
        <rect x={FENCE_DISTANCE - 0.6} y={-FENCE_HEIGHT} width={1.2} height={FENCE_HEIGHT} className="zb-fence" />
        <path d={`M${FENCE_DISTANCE - 0.8} ${-FENCE_HEIGHT} L${FENCE_DISTANCE + 0.8} ${-FENCE_HEIGHT}`} className="zb-fence__top" />
        <text x={FENCE_DISTANCE} y={-FENCE_HEIGHT - u * 1.2} fontSize={u * 2.2} strokeWidth={u * 0.4} textAnchor="middle" className="zb-label zb-label--fence">
          {FENCE_DISTANCE}m
        </text>

        {/* 마운드와 투수 */}
        <path
          d={`M${PITCHER_DISTANCE - 2.8} 0 Q${PITCHER_DISTANCE} ${-MOUND_HEIGHT * 2} ${PITCHER_DISTANCE + 2.8} 0 Z`}
          className="zb-mound"
        />
        <Pitcher x={PITCHER_DISTANCE} ground={MOUND_HEIGHT} height={PLAYER_HEIGHT} color={colors.pitcher} throwT={throwT} now={now} />

        {/* 홈플레이트, 타석 선, 타자 */}
        <path d="M-0.3 0 L0.3 0" className="zb-plate" />
        <path d={`M${BATTER_X - 0.9} 0.02 L${BATTER_X + 0.5} 0.02`} className="zb-chalk" />
        {/* 스트라이크 존: 홈플레이트 위 상자 (옆에서 본 높이 범위) */}
        <rect x={-0.3} y={-STRIKE_ZONE.top} width={0.6} height={STRIKE_ZONE.top - STRIKE_ZONE.bottom} className="zb-zone" />
        <Batter x={BATTER_X} height={PLAYER_HEIGHT} color={colors.batter} swing={swing} now={now} />

        {mark && (
          <path
            d={`M${mark.x - 0.12} ${-mark.y - 0.12} L${mark.x + 0.12} ${-mark.y + 0.12} M${mark.x - 0.12} ${-mark.y + 0.12} L${mark.x + 0.12} ${-mark.y - 0.12}`}
            className="zb-mark"
          />
        )}

        {impact && <ImpactBurst impact={impact} />}

        {/* 카메라가 멀어져도 공이 점처럼 사라지지 않게 화면 기준 최소 크기를 둔다 */}
        {ball && <Ball at={ball} r={Math.max(BALL_RADIUS, u * 0.65)} halo={Math.max(BALL_RADIUS * 2.2, u * 1.3)} trail={trail} />}
      </g>
    </svg>
  )
}
