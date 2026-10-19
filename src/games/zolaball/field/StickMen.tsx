// 선으로 그린 졸라맨. 좌표는 월드(미터), SVG y는 아래가 +이므로 높이는 음수로 쓴다.
type FigureProps = {
  x: number
  /** 발이 닿는 지면 높이 */
  ground?: number
  height: number
}

function point(x: number, y: number) {
  return `${x} ${-y}`
}

function Head({ x, y, r }: { x: number; y: number; r: number }) {
  return <circle cx={x} cy={-y} r={r} className="zb-fill-paper" />
}

// 스윙 키프레임. 좌표는 (발 중심 x, 지면) 기준이고 키(h)의 배수.
// t는 스윙 진행도(0~1), 배트 각도는 +x(투수 쪽)에서 반시계 방향 도(°), len은 배트 길이 비율.
type BatterPose = {
  t: number
  hands: [number, number]
  frontElbow: [number, number]
  backElbow: [number, number]
  batAngle: number
  batLen: number
}

const BAT_LENGTH = 0.48

const SWING_KEYS: BatterPose[] = [
  // 준비: 두 손을 뒤쪽 어깨 위에, 배트는 뒤로 비스듬히
  { t: 0, hands: [-0.14, 0.72], frontElbow: [0.06, 0.56], backElbow: [-0.22, 0.6], batAngle: 123, batLen: 1 },
  // 임팩트: 팔을 뻗고 배트가 투수 쪽으로 수평
  { t: 0.18, hands: [0.12, 0.56], frontElbow: [0.07, 0.62], backElbow: [0.05, 0.58], batAngle: 0, batLen: 1 },
  // 팔로스루: 배트가 몸을 감아 돌며 화면 쪽을 향해 짧아 보인다
  { t: 0.4, hands: [0.1, 0.66], frontElbow: [0.08, 0.66], backElbow: [0.04, 0.6], batAngle: 0, batLen: 0.25 },
  { t: 0.41, hands: [0.1, 0.66], frontElbow: [0.08, 0.66], backElbow: [0.04, 0.6], batAngle: 160, batLen: 0.25 },
  // 마무리: 배트가 앞 어깨 너머 뒤쪽으로
  { t: 1, hands: [0.04, 0.8], frontElbow: [0.1, 0.74], backElbow: [0.08, 0.7], batAngle: 155, batLen: 0.9 },
]

function lerp(a: number, b: number, k: number) {
  return a + (b - a) * k
}

function lerpPair(a: [number, number], b: [number, number], k: number): [number, number] {
  return [lerp(a[0], b[0], k), lerp(a[1], b[1], k)]
}

function poseAt(progress: number): BatterPose {
  const p = Math.min(Math.max(progress, 0), 1)
  const i = SWING_KEYS.findIndex((key) => key.t >= p)
  if (i <= 0) return SWING_KEYS[0]
  const a = SWING_KEYS[i - 1]
  const b = SWING_KEYS[i]
  const k = (p - a.t) / (b.t - a.t)
  return {
    t: p,
    hands: lerpPair(a.hands, b.hands, k),
    frontElbow: lerpPair(a.frontElbow, b.frontElbow, k),
    backElbow: lerpPair(a.backElbow, b.backElbow, k),
    batAngle: lerp(a.batAngle, b.batAngle, k),
    batLen: lerp(a.batLen, b.batLen, k),
  }
}

/** 스윙을 시작해서 배트가 수평(임팩트)이 될 때까지의 비율. 화면과 판정이 어긋나지 않게 짧게 둔다. */
export const SWING_CONTACT_RATIO = SWING_KEYS[1].t

/** 오른쪽(투수 쪽)을 보는 타자. swing이 null이면 준비 자세, 0~1이면 스윙 진행도. */
export function Batter({ x, ground = 0, height: h, swing = null }: FigureProps & { swing?: number | null }) {
  const g = ground
  const r = h * 0.12
  const neck = g + h - r * 2
  const shoulder = g + h * 0.7
  const hip = g + h * 0.42
  const pose = poseAt(swing ?? 0)
  const at = ([dx, dy]: [number, number]) => point(x + h * dx, g + h * dy)
  const rad = (pose.batAngle * Math.PI) / 180
  const batLen = h * BAT_LENGTH * pose.batLen
  const handsX = x + h * pose.hands[0]
  const handsY = g + h * pose.hands[1]

  return (
    <g className="zb-figure">
      {/* 다리: 무릎을 살짝 굽힌 자세 */}
      <path
        d={`M${point(x, hip)} L${point(x + h * 0.13, g + h * 0.2)} L${point(x + h * 0.2, g)}
            M${point(x, hip)} L${point(x - h * 0.12, g + h * 0.2)} L${point(x - h * 0.18, g)}`}
      />
      {/* 몸통 */}
      <path d={`M${point(x, neck)} L${point(x, hip)}`} />
      {/* 팔 */}
      <path
        d={`M${point(x, shoulder)} L${at(pose.frontElbow)} L${at(pose.hands)}
            M${point(x, shoulder)} L${at(pose.backElbow)} L${at(pose.hands)}`}
      />
      {/* 배트 */}
      <path
        className="zb-bat"
        d={`M${point(handsX, handsY)} L${point(handsX + Math.cos(rad) * batLen, handsY + Math.sin(rad) * batLen)}`}
      />
      <Head x={x} y={neck + r} r={r} />
    </g>
  )
}

/** 왼쪽(타자 쪽)을 보고 글러브를 가슴에 모은 투수 */
export function Pitcher({ x, ground = 0, height: h }: FigureProps) {
  const g = ground
  const r = h * 0.12
  const neck = g + h - r * 2
  const shoulder = g + h * 0.7
  const hip = g + h * 0.42
  const hands = { x: x - h * 0.08, y: g + h * 0.6 }

  return (
    <g className="zb-figure">
      <path
        d={`M${point(x, hip)} L${point(x - h * 0.06, g + h * 0.2)} L${point(x - h * 0.14, g)}
            M${point(x, hip)} L${point(x + h * 0.08, g + h * 0.2)} L${point(x + h * 0.14, g)}`}
      />
      <path d={`M${point(x, neck)} L${point(x, hip)}`} />
      <path
        d={`M${point(x, shoulder)} L${point(x - h * 0.02, g + h * 0.5)} L${point(hands.x, hands.y)}
            M${point(x, shoulder)} L${point(x + h * 0.06, g + h * 0.5)} L${point(hands.x, hands.y)}`}
      />
      {/* 글러브 */}
      <circle cx={hands.x} cy={-hands.y} r={h * 0.05} className="zb-fill-ink" />
      <Head x={x} y={neck + r} r={r} />
    </g>
  )
}

/** 관중석에 앉은 작은 졸라맨 (머리 + 몸통 + 들어 올린 팔) */
export function Spectator({ x, ground = 0, height: h, cheer }: FigureProps & { cheer: boolean }) {
  const g = ground
  const r = h * 0.18
  const neck = g + h - r * 2
  const hip = g + h * 0.3
  const armY = cheer ? g + h * 1.05 : g + h * 0.4

  return (
    <g className="zb-spectator">
      <path
        d={`M${point(x, neck)} L${point(x, hip)}
            M${point(x, g + h * 0.62)} L${point(x - h * 0.3, armY)}
            M${point(x, g + h * 0.62)} L${point(x + h * 0.3, armY)}`}
      />
      <Head x={x} y={neck + r} r={r} />
    </g>
  )
}
