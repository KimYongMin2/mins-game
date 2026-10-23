// 만화풍 선수 (처음엔 선으로 그린 졸라맨이었는데 바꿈). 좌표는 월드(미터), SVG y는 아래가 +이므로 높이는 음수로 쓴다.
// 관절 위치를 키(h)의 배수로 둔 자세(키프레임)를 시간에 따라 섞어 움직인다. 팔다리는 굵은 선 + 진한 외곽선.
import { TOON_OUTLINE, TOON_SKIN } from '../../../shared/art/shapes'
import { Bone as ToonBone } from '../../../shared/art/toon'

const OUTLINE = TOON_OUTLINE
const SKIN = TOON_SKIN
const PANTS = '#f3f4f6'
const SHOE = '#111827'
const BAT = '#c08a4a'
const GLOVE = '#92400e'
/** 외곽선 두께(한쪽, m) */
const O = 0.05

type J = [number, number]

function lerp(a: number, b: number, k: number) {
  return a + (b - a) * k
}

function lerpJ(a: J, b: J, k: number): J {
  return [lerp(a[0], b[0], k), lerp(a[1], b[1], k)]
}

/** 키프레임 배열에서 t에 맞는 자세 (숫자·관절은 섞고, 나머지는 앞 키 것) */
function blend<T extends { t: number }>(keys: readonly T[], t: number): T {
  if (t <= keys[0].t) return keys[0]
  const i = keys.findIndex((k) => k.t >= t)
  if (i < 0) return keys[keys.length - 1]
  const a = keys[i - 1]
  const b = keys[i]
  const k = (t - a.t) / (b.t - a.t)
  // 부드럽게 (가속·감속)
  const e = k * k * (3 - 2 * k)
  const out: Record<string, unknown> = { t }
  for (const key of Object.keys(a)) {
    if (key === 't') continue
    const va = a[key as keyof T] as unknown
    const vb = b[key as keyof T] as unknown
    out[key] = Array.isArray(va) ? lerpJ(va as J, vb as J, e) : typeof va === 'number' ? lerp(va, vb as number, e) : va
  }
  return out as T
}

/** 굵은 팔다리 (외곽선 두께는 야구 단위 미터로) */
function Bone(props: { d: string; w: number; color: string }) {
  return <ToonBone {...props} outline={O} />
}

/** 관절 위치 → SVG 좌표 문자열. dir = 바라보는 쪽(+1 오른쪽, −1 왼쪽) */
function at(x: number, g: number, h: number, dir: number, j: J) {
  return `${x + dir * h * j[0]} ${-(g + h * j[1])}`
}

function Leg({ hip, knee, foot, place }: { hip: J; knee: J; foot: J; place: (j: J) => string }) {
  const toe: J = [foot[0] + 0.05, foot[1]]
  return (
    <>
      <Bone d={`M${place(hip)} L${place(knee)}`} w={0.27} color={PANTS} />
      <Bone d={`M${place(knee)} L${place(foot)}`} w={0.22} color={PANTS} />
      <Bone d={`M${place(foot)} L${place(toe)}`} w={0.17} color={SHOE} />
    </>
  )
}

function Arm({ shoulder, elbow, hand, color, place, glove }: { shoulder: J; elbow: J; hand: J; color: string; place: (j: J) => string; glove?: boolean }) {
  return (
    <>
      <Bone d={`M${place(shoulder)} L${place(elbow)}`} w={0.2} color={color} />
      <Bone d={`M${place(elbow)} L${place(hand)}`} w={0.16} color={SKIN} />
      {glove && <Bone d={`M${place(hand)} L${place(hand)}`} w={0.3} color={GLOVE} />}
    </>
  )
}

/** 머리: 얼굴 + 눈 + 헬멧(타자) 또는 모자(투수) */
function Head({ cx, cy, r, dir, color, helmet }: { cx: number; cy: number; r: number; dir: number; color: string; helmet: boolean }) {
  return (
    <g>
      <circle cx={cx} cy={cy} r={r} fill={SKIN} stroke={OUTLINE} strokeWidth={O * 2} />
      {/* 눈 */}
      <circle cx={cx + dir * r * 0.5} cy={cy - r * 0.05} r={r * 0.12} fill={OUTLINE} />
      {/* 위쪽 반구 + 챙 */}
      <path
        d={`M${cx - r * 1.05} ${cy - r * 0.1} A${r * 1.05} ${r * 1.05} 0 0 1 ${cx + r * 1.05} ${cy - r * 0.1} Z`}
        fill={color}
        stroke={OUTLINE}
        strokeWidth={O * 2}
      />
      <path
        d={`M${cx + dir * r * 0.6} ${cy - r * 0.12} L${cx + dir * r * 1.6} ${cy - r * 0.02}`}
        stroke={OUTLINE}
        strokeWidth={r * 0.32 + O * 2}
      />
      <path d={`M${cx + dir * r * 0.6} ${cy - r * 0.12} L${cx + dir * r * 1.6} ${cy - r * 0.02}`} stroke={color} strokeWidth={r * 0.32} />
      {/* 타자 헬멧은 귀 덮개 */}
      {helmet && (
        <path
          d={`M${cx - dir * r * 0.15} ${cy - r * 0.1} L${cx - dir * r * 0.15} ${cy + r * 0.55} L${cx - dir * r * 0.75} ${cy + r * 0.4} L${cx - dir * r * 1.02} ${cy - r * 0.1} Z`}
          fill={color}
          stroke={OUTLINE}
          strokeWidth={O * 2}
        />
      )}
    </g>
  )
}

// ── 타자 ───────────────────────────────────────────────
// t는 스윙 진행도(0~1). 배트 각도는 +x(투수 쪽)에서 반시계 방향 도(°), batLen은 배트 길이 비율(몸을 감아 돌 때 짧아 보임).
type BatterPose = {
  t: number
  hip: J
  neck: J
  frontKnee: J
  frontFoot: J
  backKnee: J
  backFoot: J
  hands: J
  frontElbow: J
  backElbow: J
  batAngle: number
  batLen: number
}

const BAT_LENGTH = 0.5

const SWING_KEYS: BatterPose[] = [
  // 준비: 무릎을 굽히고 두 손을 뒤쪽 어깨 위에, 배트는 뒤로 비스듬히
  {
    t: 0,
    hip: [-0.02, 0.4],
    neck: [-0.05, 0.7],
    frontKnee: [0.14, 0.2],
    frontFoot: [0.2, 0],
    backKnee: [-0.14, 0.2],
    backFoot: [-0.2, 0],
    hands: [-0.16, 0.72],
    frontElbow: [0.04, 0.56],
    backElbow: [-0.26, 0.6],
    batAngle: 125,
    batLen: 1,
  },
  // 임팩트: 앞발을 내딛고 허리를 돌려 팔을 뻗음, 배트는 수평
  {
    t: 0.18,
    hip: [0.06, 0.39],
    neck: [0.06, 0.69],
    frontKnee: [0.24, 0.21],
    frontFoot: [0.32, 0],
    backKnee: [-0.05, 0.17],
    backFoot: [-0.18, 0.03],
    hands: [0.16, 0.56],
    frontElbow: [0.1, 0.62],
    backElbow: [0.06, 0.56],
    batAngle: 0,
    batLen: 1,
  },
  // 팔로스루: 배트가 몸을 감아 돌며 화면 쪽을 향해 짧아 보인다
  {
    t: 0.4,
    hip: [0.08, 0.4],
    neck: [0.1, 0.71],
    frontKnee: [0.24, 0.21],
    frontFoot: [0.32, 0],
    backKnee: [0.02, 0.16],
    backFoot: [-0.1, 0.05],
    hands: [0.12, 0.66],
    frontElbow: [0.12, 0.66],
    backElbow: [0.06, 0.6],
    batAngle: 0,
    batLen: 0.25,
  },
  {
    t: 0.41,
    hip: [0.08, 0.4],
    neck: [0.1, 0.71],
    frontKnee: [0.24, 0.21],
    frontFoot: [0.32, 0],
    backKnee: [0.02, 0.16],
    backFoot: [-0.1, 0.05],
    hands: [0.12, 0.66],
    frontElbow: [0.12, 0.66],
    backElbow: [0.06, 0.6],
    batAngle: 160,
    batLen: 0.25,
  },
  // 마무리: 배트가 앞 어깨 너머 뒤쪽으로, 뒷발은 발끝으로 돌아섬
  {
    t: 1,
    hip: [0.08, 0.41],
    neck: [0.08, 0.72],
    frontKnee: [0.24, 0.21],
    frontFoot: [0.32, 0],
    backKnee: [0.04, 0.17],
    backFoot: [-0.06, 0.05],
    hands: [0.04, 0.8],
    frontElbow: [0.14, 0.74],
    backElbow: [0.1, 0.7],
    batAngle: 155,
    batLen: 0.9,
  },
]

/** 스윙을 시작해서 배트가 수평(임팩트)이 될 때까지의 비율. 화면과 판정이 어긋나지 않게 짧게 둔다. */
export const SWING_CONTACT_RATIO = SWING_KEYS[1].t

function swingPose(progress: number): BatterPose {
  // 배트 각도는 순서대로 이어지는 게 중요해서 부드럽게 하지 않고 그대로 섞는다
  const p = Math.min(Math.max(progress, 0), 1)
  const i = SWING_KEYS.findIndex((key) => key.t >= p)
  if (i <= 0) return SWING_KEYS[0]
  const a = SWING_KEYS[i - 1]
  const b = SWING_KEYS[i]
  const k = (p - a.t) / (b.t - a.t)
  const mixed = blend([a, b], lerp(a.t, b.t, k))
  return { ...mixed, batAngle: lerp(a.batAngle, b.batAngle, k), batLen: lerp(a.batLen, b.batLen, k) }
}

type FigureProps = {
  x: number
  /** 발이 닿는 지면 높이 */
  ground?: number
  height: number
  /** 유니폼·모자 색 */
  color: string
}

function batPath(x: number, g: number, h: number, pose: BatterPose) {
  const rad = (pose.batAngle * Math.PI) / 180
  const len = h * BAT_LENGTH * pose.batLen
  const hx = x + h * pose.hands[0]
  const hy = g + h * pose.hands[1]
  return `M${hx} ${-hy} L${hx + Math.cos(rad) * len} ${-(hy + Math.sin(rad) * len)}`
}

/** 오른쪽(투수 쪽)을 보는 타자. swing이 null이면 준비 자세(살짝 배트를 까딱임), 0~1이면 스윙 진행도 */
export function Batter({ x, ground = 0, height: h, color, swing = null, now = 0 }: FigureProps & { swing?: number | null; now?: number }) {
  const g = ground
  let pose = swingPose(swing ?? 0)
  if (swing === null) pose = { ...pose, batAngle: pose.batAngle + Math.sin(now / 260) * 6 }
  const place = (j: J) => at(x, g, h, 1, j)
  const shoulder: J = [pose.neck[0], pose.neck[1] - 0.03]
  const headR = h * 0.13
  const head = { cx: x + h * (pose.neck[0] + 0.02), cy: -(g + h * pose.neck[1] + headR * 0.95) }
  // 스윙 중엔 지나온 배트를 흐리게 남겨 휘두르는 느낌을 준다
  const ghosts = swing !== null && swing > 0.02 && swing < 0.45 ? [0.05, 0.1] : []

  return (
    <g className="zb-toon">
      <Leg hip={pose.hip} knee={pose.backKnee} foot={pose.backFoot} place={place} />
      <Arm shoulder={shoulder} elbow={pose.backElbow} hand={pose.hands} color={color} place={place} />
      {ghosts.map((dt, i) => (
        <path key={dt} d={batPath(x, g, h, swingPose(swing! - dt))} stroke="#fde68a" strokeWidth={0.22} opacity={0.45 - i * 0.2} />
      ))}
      <Bone d={batPath(x, g, h, pose)} w={0.15} color={BAT} />
      <Bone d={`M${place(pose.hip)} L${place(pose.neck)}`} w={0.62} color={color} />
      <Leg hip={pose.hip} knee={pose.frontKnee} foot={pose.frontFoot} place={place} />
      <Head cx={head.cx} cy={head.cy} r={headR} dir={1} color={color} helmet />
      <Arm shoulder={shoulder} elbow={pose.frontElbow} hand={pose.hands} color={color} place={place} />
    </g>
  )
}

// ── 투수 ───────────────────────────────────────────────
// 앞(+)이 타자 쪽(화면 왼쪽). t는 공을 놓는 순간 기준 ms: 다리 들기 → 내딛으며 팔 젖히기 → 놓기 → 마무리 → 다시 준비.
type PitcherPose = {
  t: number
  hip: J
  neck: J
  frontKnee: J
  frontFoot: J
  backKnee: J
  backFoot: J
  throwElbow: J
  throwHand: J
  gloveElbow: J
  gloveHand: J
}

const SET: PitcherPose = {
  t: -250,
  hip: [0, 0.42],
  neck: [0.01, 0.72],
  frontKnee: [0.07, 0.2],
  frontFoot: [0.12, 0],
  backKnee: [-0.06, 0.2],
  backFoot: [-0.12, 0],
  throwElbow: [-0.05, 0.53],
  throwHand: [0.06, 0.6],
  gloveElbow: [0.12, 0.52],
  gloveHand: [0.08, 0.6],
}

const THROW_KEYS: PitcherPose[] = [
  SET,
  // 다리 들기
  {
    t: -160,
    hip: [-0.03, 0.44],
    neck: [-0.05, 0.74],
    frontKnee: [0.1, 0.54],
    frontFoot: [0.02, 0.34],
    backKnee: [-0.04, 0.22],
    backFoot: [-0.05, 0],
    throwElbow: [-0.07, 0.56],
    throwHand: [0.0, 0.63],
    gloveElbow: [0.1, 0.56],
    gloveHand: [0.03, 0.63],
  },
  // 크게 내딛으며 던지는 팔을 뒤로 젖힘, 글러브 팔은 타자 쪽으로
  {
    t: -70,
    hip: [0.08, 0.38],
    neck: [0.05, 0.69],
    frontKnee: [0.3, 0.2],
    frontFoot: [0.4, 0],
    backKnee: [-0.13, 0.19],
    backFoot: [-0.22, 0],
    throwElbow: [-0.17, 0.72],
    throwHand: [-0.26, 0.9],
    gloveElbow: [0.24, 0.7],
    gloveHand: [0.37, 0.72],
  },
  // 놓는 순간: 손이 공 나가는 자리(앞으로 0.4m·높이 키의 0.78)에
  {
    t: 0,
    hip: [0.15, 0.37],
    neck: [0.22, 0.66],
    frontKnee: [0.33, 0.19],
    frontFoot: [0.4, 0],
    backKnee: [-0.02, 0.16],
    backFoot: [-0.17, 0.02],
    throwElbow: [0.06, 0.82],
    throwHand: [0.133, 0.78],
    gloveElbow: [0.25, 0.52],
    gloveHand: [0.13, 0.47],
  },
  // 마무리: 팔이 몸을 가로질러 내려오고 뒷다리가 따라 올라옴
  {
    t: 170,
    hip: [0.17, 0.35],
    neck: [0.31, 0.58],
    frontKnee: [0.34, 0.18],
    frontFoot: [0.4, 0],
    backKnee: [0.1, 0.3],
    backFoot: [0.0, 0.25],
    throwElbow: [0.33, 0.44],
    throwHand: [0.28, 0.27],
    gloveElbow: [0.19, 0.48],
    gloveHand: [0.1, 0.46],
  },
  { t: 600, hip: [0.17, 0.36], neck: [0.29, 0.6], frontKnee: [0.34, 0.18], frontFoot: [0.4, 0], backKnee: [0.12, 0.2], backFoot: [0.1, 0], throwElbow: [0.3, 0.46], throwHand: [0.26, 0.32], gloveElbow: [0.2, 0.5], gloveHand: [0.12, 0.5] },
  { ...SET, t: 950 },
]

/** 왼쪽(타자 쪽)을 보는 투수. throwT: 공을 놓는 순간 기준 ms (null이면 준비 자세로 숨쉬듯 까딱임) */
export function Pitcher({ x, ground = 0, height: h, color, throwT = null, now = 0 }: FigureProps & { throwT?: number | null; now?: number }) {
  const g = ground
  let pose = blend(THROW_KEYS, throwT ?? SET.t)
  if (throwT === null) {
    const bob = Math.sin(now / 420) * 0.006
    pose = { ...pose, neck: [pose.neck[0], pose.neck[1] + bob], hip: [pose.hip[0], pose.hip[1] + bob * 0.5] }
  }
  const place = (j: J) => at(x, g, h, -1, j)
  const shoulder: J = [pose.neck[0], pose.neck[1] - 0.03]
  const headR = h * 0.13
  const head = { cx: x - h * (pose.neck[0] + 0.02), cy: -(g + h * pose.neck[1] + headR * 0.95) }

  return (
    <g className="zb-toon">
      <Arm shoulder={shoulder} elbow={pose.throwElbow} hand={pose.throwHand} color={color} place={place} />
      <Leg hip={pose.hip} knee={pose.backKnee} foot={pose.backFoot} place={place} />
      <Bone d={`M${place(pose.hip)} L${place(pose.neck)}`} w={0.62} color={color} />
      <Leg hip={pose.hip} knee={pose.frontKnee} foot={pose.frontFoot} place={place} />
      <Head cx={head.cx} cy={head.cy} r={headR} dir={-1} color={color} helmet={false} />
      <Arm shoulder={shoulder} elbow={pose.gloveElbow} hand={pose.gloveHand} color={color} place={place} glove />
    </g>
  )
}

const CROWD_SHIRTS = ['#ef4444', '#3b82f6', '#f59e0b', '#10b981', '#8b5cf6', '#ec4899', '#f97316', '#14b8a6']

/** 관중석의 작은 관중. cheer면 팔을 들고, celebrate면 들썩인다 */
export function Spectator({ x, ground = 0, height: h, cheer, shirt, jump = 0 }: { x: number; ground?: number; height: number; cheer: boolean; shirt: number; jump?: number }) {
  const g = ground + jump
  const r = h * 0.17
  const body = `M${x} ${-(g + h * 0.2)} L${x} ${-(g + h * 0.55)}`
  const armY = cheer ? g + h * 1.0 : g + h * 0.35
  const color = CROWD_SHIRTS[shirt % CROWD_SHIRTS.length]
  return (
    <g className="zb-toon">
      <path d={`M${x} ${-(g + h * 0.5)} L${x - h * 0.28} ${-armY} M${x} ${-(g + h * 0.5)} L${x + h * 0.28} ${-armY}`} stroke={color} strokeWidth={h * 0.1} />
      <path d={body} stroke={color} strokeWidth={h * 0.34} />
      <circle cx={x} cy={-(g + h * 0.55 + r * 1.1)} r={r} fill={SKIN} />
    </g>
  )
}
