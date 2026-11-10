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

// 실사풍 과녁 (사용자 요청 — '실사처럼'): 사로 뒤 풍경(하늘·나무·잔디) 앞에 볏짚 받침(나무 다리)과 규격 색 과녁지.
// 좌표는 예전과 똑같이 m 단위(과녁 가운데가 0, 위가 −y로 그림)라 점수 판정과 조준은 그대로다.
// 링 색은 실제 양궁 과녁: 바깥부터 흰·흰·검·검·파·파·빨·빨·노·노, 검은 링 안 선은 흰색.
const RING_FILL = ['#ffffff', '#ffffff', '#24201d', '#24201d', '#00a3d9', '#00a3d9', '#e8414a', '#e8414a', '#ffd93b', '#ffd93b']
const RING_LINE = ['#3a3530', '#3a3530', '#e9e4dc', '#e9e4dc', '#1b3c55', '#1b3c55', '#7a1d22', '#7a1d22', '#7a5d10', '#7a5d10']
/** 볏짚 받침 크기 (가로·세로, m) */
const BOSS = 1.25
/** 받침 가운데가 과녁 가운데보다 조금 아래 */
const BOSS_Y = 0.06

/** 꽂힌 화살 (정면에서 본 꽁무니): 그림자 · 깃 세 장 · 오늬 */
function Arrow({ at, latest, u }: { at: Point; latest: boolean; u: number }) {
  const x = at.x
  const y = -at.y
  const r = Math.max(0.006, u * 1.1)
  const vane = (deg: number) => {
    const a = (deg * Math.PI) / 180
    const tip = { x: x + Math.cos(a) * r * 3.2, y: y + Math.sin(a) * r * 3.2 }
    const side = { x: Math.cos(a + Math.PI / 2) * r * 0.9, y: Math.sin(a + Math.PI / 2) * r * 0.9 }
    return `M${x} ${y} L${tip.x + side.x} ${tip.y + side.y} L${tip.x} ${tip.y} Z`
  }
  const color = latest ? '#ff6b2c' : '#2fb36b'
  return (
    <g className="ar-stuck">
      <ellipse cx={x + r * 1.4} cy={y + r * 1.8} rx={r * 2.4} ry={r * 1.6} fill="rgba(0,0,0,0.28)" stroke="none" />
      {[-90, 30, 150].map((d, i) => (
        <path key={d} d={vane(d)} fill={i === 0 ? '#f8f4ec' : color} stroke="rgba(0,0,0,0.45)" strokeWidth={0.6} />
      ))}
      <circle cx={x} cy={y} r={r} fill="#1d1a17" stroke="#fff" strokeWidth={0.8} />
      {latest && <circle cx={x} cy={y} r={r * 5} fill="none" stroke="#ff6b2c" strokeWidth={1.6} />}
    </g>
  )
}

export function TargetView({ distance, reticle = null, drawProgress = 0, arrows = [], flying = null }: Props) {
  const h = viewHalfSize(distance)
  /** 화면 기준 단위 (보이는 범위의 1%) */
  const u = h / 50
  // 지평선: 받침 아래쪽보다 조금 위 (멀수록 받침이 작아져 풍경이 더 보임)
  const horizon = BOSS_Y + BOSS * 0.3

  return (
    <svg className="ar-target ar-target--real" viewBox={`${-h} ${-h} ${h * 2} ${h * 2}`} role="img" aria-label={`${distance}m 과녁`}>
      <defs>
        <linearGradient id="ar-sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#7db6e8" />
          <stop offset="1" stopColor="#d9ecf7" />
        </linearGradient>
        <linearGradient id="ar-grass" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#5f9a45" />
          <stop offset="1" stopColor="#3f7a32" />
        </linearGradient>
        {/* 볏짚: 촘촘한 결 무늬 */}
        <pattern id="ar-straw" width="0.05" height="0.05" patternUnits="userSpaceOnUse" patternTransform="rotate(18)">
          <rect width="0.05" height="0.05" fill="#d8b46a" />
          <path d="M0 0.012 H0.05 M0 0.031 H0.05 M0 0.044 H0.05" stroke="#b8913f" strokeWidth="0.006" />
          <path d="M0 0.022 H0.05" stroke="#ecd08e" strokeWidth="0.005" />
        </pattern>
        <radialGradient id="ar-shade" cx="0.5" cy="0.45" r="0.65">
          <stop offset="0.6" stopColor="rgba(0,0,0,0)" />
          <stop offset="1" stopColor="rgba(0,0,0,0.25)" />
        </radialGradient>
      </defs>

      {/* 뒤 풍경: 하늘 · 먼 나무 줄 · 잔디 */}
      <rect x={-h} y={-h} width={h * 2} height={h * 2} fill="url(#ar-sky)" stroke="none" />
      <path
        d={`M${-h} ${horizon} ${Array.from({ length: 14 }, (_, i) => {
          const x = -h + ((i + 0.5) / 14) * h * 2
          return `Q${x} ${horizon - h * (0.12 + ((i * 37) % 5) * 0.025)} ${-h + ((i + 1) / 14) * h * 2} ${horizon}`
        }).join(' ')} V${horizon} Z`}
        fill="#3c6b3a"
        stroke="none"
        opacity={0.85}
      />
      <rect x={-h} y={horizon} width={h * 2} height={h * 2} fill="url(#ar-grass)" stroke="none" />

      {/* 받침 다리 (나무) + 그림자 */}
      <ellipse cx={0} cy={BOSS_Y + BOSS / 2 + 0.42} rx={BOSS * 0.62} ry={0.05} fill="rgba(0,0,0,0.22)" stroke="none" />
      {[-1, 1].map((s) => (
        <path key={s} d={`M${s * BOSS * 0.32} ${BOSS_Y + BOSS / 2 - 0.05} L${s * BOSS * 0.5} ${BOSS_Y + BOSS / 2 + 0.42}`} stroke="#7a4f2a" strokeWidth={6} strokeLinecap="round" />
      ))}

      {/* 볏짚 받침 */}
      <rect x={-BOSS / 2} y={BOSS_Y - BOSS / 2} width={BOSS} height={BOSS} fill="url(#ar-straw)" stroke="#8a6a2e" strokeWidth={1.5} />
      <rect x={-BOSS / 2} y={BOSS_Y - BOSS / 2} width={BOSS} height={BOSS} fill="url(#ar-shade)" stroke="none" />

      {/* 과녁지: 살짝 그림자 + 바깥 링부터 (1점 → 10점) */}
      <circle cx={0.008} cy={0.012} r={TARGET_RADIUS + 0.004} fill="rgba(0,0,0,0.25)" stroke="none" />
      {Array.from({ length: 10 }, (_, i) => (
        <circle key={i} cx={0} cy={0} r={TARGET_RADIUS - i * RING_WIDTH} fill={RING_FILL[i]} stroke={RING_LINE[i]} strokeWidth={0.8} />
      ))}
      <circle cx={0} cy={0} r={X_RADIUS} fill="none" stroke="#7a5d10" strokeWidth={0.7} />
      <path d={`M${-u * 0.6} 0 L${u * 0.6} 0 M0 ${-u * 0.6} L0 ${u * 0.6}`} stroke="#7a5d10" strokeWidth={0.7} />

      {arrows.map((a, i) => (
        <Arrow key={i} at={a.at} latest={a.latest} u={u} />
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
        <g className="ar-reticle" style={{ opacity: 0.55 + drawProgress * 0.45 }}>
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
