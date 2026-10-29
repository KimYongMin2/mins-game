import { Bone } from '../../../shared/art/toon'
import { TOON_OUTLINE, TOON_SKIN, starPath } from '../../../shared/art/shapes'
import { BALL_R, BODY_R, BODY_Y, COURT_W, HEAD_R, HEAD_Y, NET_H, NET_HALF, NET_X } from '../constants'
import { type Ball, type Player, type Side, type SimState } from '../play/sim'

// 옆에서 본 해변 코트. 좌표는 물리 그대로 m 단위, 화면 위쪽이 +y라 SVG에선 GROUND - y.
// 만화풍 선수(굵은 외곽선, 머리띠, 나 파랑·상대 빨강), 흰·노랑 배구공에 빛 테두리·꼬리, 공 그림자(떨어질 자리 짐작용).
// mirror면 좌우를 뒤집어 그린다 (친구 쪽 기기에서 자기가 왼쪽에 보이게).

const VIEW_H = 10
const GROUND = 9
const OUT = 0.07
const Y = (y: number) => GROUND - y

const TEAM_COLORS = { me: '#2563eb', foe: '#dc2626' } as const

type Props = {
  sim: SimState
  /** 이 기기 사람의 자리 (파랑) */
  me: Side
  mirror: boolean
  /** 공이 지나온 자리 (꼬리) */
  trail: { x: number; y: number }[]
  /** 화면 흔들림 (m) */
  shake: number
}

function Athlete({ p, color, ball, hitAge }: { p: Player; color: string; ball: Ball; hitAge: number }) {
  const diving = p.dive > 0 || p.recover > 0
  const air = p.y > 0.05
  const fx = p.x
  const fy = Y(p.y)
  // 눈은 공 쪽을 본다
  const look = Math.atan2(ball.y - (p.y + HEAD_Y), ball.x - p.x)
  const ex = Math.cos(look) * 0.08
  const ey = -Math.sin(look) * 0.08
  const hipY = fy - 0.5
  const shoulderY = fy - 1.05
  const swing = hitAge < 12
  const f = p.facing
  // 팔: 서 있으면 앞으로 모으기(받기 자세), 공중이면 위로, 스파이크 직후엔 앞으로 내리치기
  const arm = swing ? `M${fx} ${shoulderY} L${fx + f * 0.8} ${shoulderY + 0.25}` : air ? `M${fx} ${shoulderY} L${fx + f * 0.25} ${shoulderY - 0.85}` : `M${fx} ${shoulderY} L${fx + f * 0.55} ${shoulderY + 0.4}`
  const back = air && !swing ? `M${fx} ${shoulderY} L${fx - f * 0.35} ${shoulderY - 0.7}` : `M${fx} ${shoulderY} L${fx - f * 0.3} ${shoulderY + 0.5}`
  const legs = air
    ? [`M${fx - 0.12} ${hipY} L${fx - 0.3} ${fy - 0.15}`, `M${fx + 0.12} ${hipY} L${fx + 0.25} ${fy - 0.05}`]
    : [`M${fx - 0.14} ${hipY} L${fx - 0.25} ${fy}`, `M${fx + 0.14} ${hipY} L${fx + 0.25} ${fy}`]
  return (
    <g transform={diving ? `rotate(${f * 62} ${fx} ${fy})` : undefined}>
      <ellipse cx={fx} cy={GROUND + 0.05} rx={0.55} ry={0.12} fill="rgba(0,0,0,0.18)" transform={diving ? `rotate(${-f * 62} ${fx} ${fy})` : undefined} />
      {legs.map((d, i) => (
        <Bone key={i} d={d} w={0.2} color={TOON_SKIN} outline={OUT} />
      ))}
      <Bone d={back} w={0.17} color={TOON_SKIN} outline={OUT} />
      {/* 몸통: 유니폼 + 흰 줄 */}
      <circle cx={fx} cy={Y(p.y + BODY_Y)} r={BODY_R} fill={color} stroke={TOON_OUTLINE} strokeWidth={OUT * 1.6} />
      <path d={`M${fx - 0.45} ${Y(p.y + BODY_Y) + 0.2} Q${fx} ${Y(p.y + BODY_Y) + 0.38} ${fx + 0.45} ${Y(p.y + BODY_Y) + 0.2}`} stroke="#fff" strokeWidth={0.09} fill="none" />
      {/* 머리 + 머리띠 */}
      <circle cx={fx} cy={Y(p.y + HEAD_Y)} r={HEAD_R} fill={TOON_SKIN} stroke={TOON_OUTLINE} strokeWidth={OUT * 1.6} />
      <path
        d={`M${fx - HEAD_R * 0.95} ${Y(p.y + HEAD_Y) - 0.14} Q${fx} ${Y(p.y + HEAD_Y) - 0.3} ${fx + HEAD_R * 0.95} ${Y(p.y + HEAD_Y) - 0.14}`}
        stroke={color}
        strokeWidth={0.13}
        fill="none"
        strokeLinecap="round"
      />
      <path d={`M${fx - f * 0.4} ${Y(p.y + HEAD_Y) - 0.18} l${-f * 0.25} 0.12 l${-f * 0.05} 0.14`} stroke={color} strokeWidth={0.08} fill="none" strokeLinecap="round" />
      {[-0.15, 0.15].map((dx) => (
        <g key={dx}>
          <ellipse cx={fx + dx + f * 0.04} cy={Y(p.y + HEAD_Y) + 0.02} rx={0.08} ry={0.1} fill="#fff" stroke={TOON_OUTLINE} strokeWidth={0.03} />
          <circle cx={fx + dx + f * 0.04 + ex * 0.4} cy={Y(p.y + HEAD_Y) + 0.02 + ey * 0.4} r={0.045} fill={TOON_OUTLINE} />
        </g>
      ))}
      <path d={`M${fx - 0.1 + f * 0.05} ${Y(p.y + HEAD_Y) + 0.22} q0.1 ${swing ? 0.1 : 0.05} 0.2 0`} stroke={TOON_OUTLINE} strokeWidth={0.04} fill={swing ? TOON_OUTLINE : 'none'} />
      <Bone d={arm} w={0.18} color={TOON_SKIN} outline={OUT} />
    </g>
  )
}

function BallArt({ ball, trail }: { ball: Ball; trail: Props['trail'] }) {
  const cx = ball.x
  const cy = Y(ball.y)
  const spin = (ball.x * 90) % 360
  return (
    <g>
      {trail.map((t, i) => (
        <circle key={i} cx={t.x} cy={Y(t.y)} r={BALL_R * (0.4 + (0.5 * i) / trail.length)} fill="#fb923c" opacity={0.08 + (0.3 * i) / trail.length} />
      ))}
      <circle cx={cx} cy={cy} r={BALL_R + 0.1} fill="none" stroke="#ffe066" strokeWidth={0.1} opacity={0.85} />
      <g transform={`rotate(${spin} ${cx} ${cy})`}>
        <circle cx={cx} cy={cy} r={BALL_R} fill="#fff" stroke={TOON_OUTLINE} strokeWidth={OUT * 1.4} />
        <path d={`M${cx - BALL_R} ${cy} Q${cx} ${cy - 0.25} ${cx + BALL_R} ${cy}`} fill="none" stroke="#2563eb" strokeWidth={0.06} />
        <path d={`M${cx} ${cy - BALL_R} Q${cx + 0.2} ${cy} ${cx} ${cy + BALL_R}`} fill="none" stroke="#facc15" strokeWidth={0.08} />
        <path d={`M${cx - 0.3} ${cy + 0.3} Q${cx} ${cy + 0.05} ${cx + 0.3} ${cy + 0.33}`} fill="none" stroke="#2563eb" strokeWidth={0.06} />
      </g>
    </g>
  )
}

export function Court({ sim, me, mirror, trail, shake }: Props) {
  const { ball, players, lastHit } = sim
  const hitAge = (side: Side) => (lastHit && lastHit.kind === 'spike' && lastHit.player === side ? sim.tick - lastHit.tick : 99)
  const spikeAge = lastHit?.kind === 'spike' ? sim.tick - lastHit.tick : 99
  const shadowScale = 1 - Math.min(ball.y / 10, 0.7)
  const above = ball.y - BALL_R > GROUND
  return (
    <svg className="vb-court" viewBox={`0 0 ${COURT_W} ${VIEW_H}`} role="img" aria-label="배구 코트">
      <defs>
        <linearGradient id="vb-sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#60a5fa" />
          <stop offset="1" stopColor="#dbeafe" />
        </linearGradient>
        <pattern id="vb-mesh" width="0.15" height="0.15" patternUnits="userSpaceOnUse">
          <path d="M0 0 L0.15 0.15 M0.15 0 L0 0.15" stroke="#e5e7eb" strokeWidth="0.025" />
        </pattern>
      </defs>
      <rect width={COURT_W} height={VIEW_H} fill="url(#vb-sky)" />
      {/* 해·구름·바다 */}
      <circle cx={13.2} cy={1.6} r={0.9} fill="#fde68a" stroke="#f59e0b" strokeWidth={0.06} />
      {[
        [2.5, 1.4],
        [6.5, 2.4],
        [10.5, 1.1],
      ].map(([x, y]) => (
        <g key={x} fill="#fff" opacity={0.9}>
          <ellipse cx={x} cy={y} rx={0.9} ry={0.35} />
          <ellipse cx={x + 0.5} cy={y - 0.2} rx={0.6} ry={0.35} />
        </g>
      ))}
      <rect x={0} y={7.4} width={COURT_W} height={GROUND - 7.4} fill="#38bdf8" />
      <path d={Array.from({ length: 9 }, (_, i) => `M${i * 2 + 0.3} 7.9 q0.35 -0.15 0.7 0`).join(' ')} stroke="#e0f2fe" strokeWidth={0.05} fill="none" />
      <g transform={`translate(${shake} 0)`}>
        <g transform={mirror ? `translate(${COURT_W} 0) scale(-1 1)` : undefined}>
          {/* 모래 */}
          <rect x={0} y={GROUND} width={COURT_W} height={VIEW_H - GROUND} fill="#f4d58d" stroke={TOON_OUTLINE} strokeWidth={OUT} />
          <path d={Array.from({ length: 24 }, (_, i) => `M${i * 0.7 + 0.2} ${GROUND + 0.3 + (i % 3) * 0.18} h0.06`).join(' ')} stroke="#d4a54a" strokeWidth={0.07} strokeLinecap="round" />
          {/* 공 그림자: 떨어질 자리 짐작 */}
          <ellipse cx={ball.x} cy={GROUND + 0.06} rx={0.5 * shadowScale} ry={0.12 * shadowScale} fill="rgba(0,0,0,0.25)" />
          {/* 네트 */}
          <rect x={NET_X - 0.06} y={Y(NET_H) - 0.2} width={0.12} height={NET_H + 0.2} fill="#9ca3af" stroke={TOON_OUTLINE} strokeWidth={OUT} />
          <rect x={NET_X - NET_HALF} y={Y(NET_H)} width={NET_HALF * 2} height={NET_H * 0.55} fill="url(#vb-mesh)" stroke={TOON_OUTLINE} strokeWidth={OUT * 0.8} />
          <rect x={NET_X - NET_HALF - 0.05} y={Y(NET_H) - 0.08} width={NET_HALF * 2 + 0.1} height={0.16} rx={0.05} fill="#fff" stroke={TOON_OUTLINE} strokeWidth={OUT * 0.8} />
          {players.map((p, i) => (
            <Athlete key={i} p={p} color={i === me ? TEAM_COLORS.me : TEAM_COLORS.foe} ball={ball} hitAge={hitAge(i as Side)} />
          ))}
          {above ? (
            // 화면 위로 나간 공: 위쪽에 화살표
            <path d={`M${ball.x} 0.15 l-0.3 0.45 h0.6 Z`} fill="#fff" stroke={TOON_OUTLINE} strokeWidth={0.05} />
          ) : (
            <BallArt ball={ball} trail={trail} />
          )}
          {spikeAge < 8 && (
            <path d={starPath(ball.x, Y(ball.y), 0.9 - spikeAge * 0.06, 8, 0.4)} fill="#fff7ae" stroke="#f59e0b" strokeWidth={0.05} opacity={1 - spikeAge / 8} />
          )}
        </g>
      </g>
    </svg>
  )
}
