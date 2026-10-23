import { TOON_OUTLINE, TOON_SKIN, starPath } from '../../../shared/art/shapes'
import { Bone as ToonBone } from '../../../shared/art/toon'
import { type Stance, type TurnEvent, isHurt } from '../rules/turn'

// 옆에서 본 두 격투가가 링 위에서 마주 선다. 왼쪽이 나(파랑), 오른쪽이 상대(빨강).
// 처음엔 흰 바탕 선화 졸라맨이었는데 만화풍(굵은 외곽선, 머리띠, 글러브)으로 바꿈.

export const VIEW_W = 360
export const VIEW_H = 220
const GROUND_Y = 186
const FIGHTER_X = [120, 240] as const
const COLORS = ['#2563eb', '#dc2626'] as const
const PANTS = '#334155'
const O = 2.2

type Point = readonly [number, number]

/** 관절 위치 (앞쪽이 +x, 위쪽이 +y, 발 가운데가 원점). 0번 팔다리가 앞쪽 */
type Pose = {
  head: Point
  neck: Point
  hip: Point
  knees: readonly [Point, Point]
  feet: readonly [Point, Point]
  elbows: readonly [Point, Point]
  fists: readonly [Point, Point]
}

const POSES: Record<'idle' | 'ready' | 'guard' | 'attack' | 'smash' | 'hurt', Pose> = {
  // 주먹을 들고 선 자세
  idle: {
    head: [2, 104],
    neck: [0, 88],
    hip: [-2, 46],
    knees: [[12, 23], [-10, 23]],
    feet: [[16, 0], [-16, 0]],
    elbows: [[12, 66], [2, 68]],
    fists: [[24, 82], [14, 88]],
  },
  // 쪼그려 기 모으기
  ready: {
    head: [0, 94],
    neck: [0, 78],
    hip: [0, 38],
    knees: [[18, 20], [-18, 20]],
    feet: [[18, 0], [-18, 0]],
    elbows: [[14, 60], [-14, 60]],
    fists: [[8, 46], [-8, 46]],
  },
  // 팔을 엇갈려 얼굴을 막음
  guard: {
    head: [-4, 102],
    neck: [-4, 86],
    hip: [-4, 45],
    knees: [[8, 23], [-12, 22]],
    feet: [[14, 0], [-18, 0]],
    elbows: [[16, 70], [12, 64]],
    fists: [[16, 100], [22, 86]],
  },
  // 앞으로 내지르는 주먹
  attack: {
    head: [22, 100],
    neck: [16, 85],
    hip: [6, 45],
    knees: [[22, 22], [-6, 22]],
    feet: [[28, 0], [-22, 0]],
    elbows: [[36, 82], [2, 66]],
    fists: [[58, 84], [10, 78]],
  },
  // 두 주먹을 모아 크게 내지르는 강타
  smash: {
    head: [26, 98],
    neck: [20, 83],
    hip: [6, 44],
    knees: [[26, 24], [-8, 22]],
    feet: [[34, 0], [-26, 0]],
    elbows: [[40, 86], [36, 78]],
    fists: [[64, 88], [60, 78]],
  },
  // 맞고 뒤로 젖혀짐
  hurt: {
    head: [-20, 96],
    neck: [-13, 82],
    hip: [-4, 44],
    knees: [[10, 22], [-12, 22]],
    feet: [[16, 0], [-18, 0]],
    elbows: [[-22, 76], [-14, 62]],
    fists: [[-26, 98], [-30, 72]],
  },
}

export type FighterShow = {
  stance: Stance | null
  event: TurnEvent | null
  /** 아직 공개 전이면 자세를 숨긴다 (? 표시) */
  hidden: boolean
}

type Props = {
  fighters: readonly [FighterShow, FighterShow]
  /** 공개 후 지난 정도 0~1 (동작 연출용). 공개 전이면 null */
  reveal: number | null
  /** 고르는 중일 때 몸을 살짝 들썩인다 */
  now: number
  names: readonly [string, string]
}

function poseOf(f: FighterShow): keyof typeof POSES {
  if (f.hidden || !f.stance) return 'idle'
  if (f.event && isHurt(f.event)) return 'hurt'
  return f.stance
}

/** 이벤트 위에 띄우는 글자 */
const EVENT_TEXT: Partial<Record<TurnEvent, { text: string; tone: 'good' | 'bad' | 'plain' }>> = {
  charge: { text: '+1', tone: 'good' },
  'charge-full': { text: '꽉 참', tone: 'plain' },
  hurt: { text: '−1', tone: 'bad' },
  pierced: { text: '뚫림! −1', tone: 'bad' },
  overpowered: { text: '밀림! −1', tone: 'bad' },
  'smash-hit': { text: '강타!', tone: 'good' },
  block: { text: '막음!', tone: 'good' },
  strike: { text: '명중!', tone: 'good' },
  blocked: { text: '막힘', tone: 'plain' },
}

const Bone = (props: { d: string; w: number; color: string }) => <ToonBone {...props} outline={O} />

/** 머리: 얼굴, 머리카락, 머리띠(꼬리가 휘날림), 눈(맞으면 ✕) */
function Head({ x, y, dir, color, hurt, now }: { x: number; y: number; dir: number; color: string; hurt: boolean; now: number }) {
  const r = 15
  const wave = Math.sin(now / 120) * 3
  return (
    <g>
      {/* 머리띠 꼬리 (뒤로 휘날림) */}
      <path
        d={`M${x - dir * 10} ${y - 6} Q${x - dir * 24} ${y - 10 + wave} ${x - dir * 34} ${y - 2 - wave}`}
        stroke={TOON_OUTLINE}
        strokeWidth={6 + O * 2}
        fill="none"
        strokeLinecap="round"
      />
      <path d={`M${x - dir * 10} ${y - 6} Q${x - dir * 24} ${y - 10 + wave} ${x - dir * 34} ${y - 2 - wave}`} stroke={color} strokeWidth={6} fill="none" strokeLinecap="round" />
      <circle cx={x} cy={y} r={r} fill={TOON_SKIN} stroke={TOON_OUTLINE} strokeWidth={O * 2} />
      {/* 머리카락: 위·뒤쪽 */}
      <path
        d={`M${x - dir * r} ${y + 2} A${r} ${r} 0 0 ${dir > 0 ? 1 : 0} ${x + dir * r * 0.7} ${y - r * 0.72} L${x - dir * 2} ${y - 4} Z`}
        fill="#1f2937"
      />
      {/* 머리띠 */}
      <path d={`M${x - r * 0.98} ${y - 6} L${x + r * 0.98} ${y - 6}`} stroke={color} strokeWidth={5} strokeLinecap="butt" />
      {hurt ? (
        <path
          d={`M${x + dir * 5} ${y - 1} l${dir * 5} 5 m0 -5 l${-dir * 5} 5`}
          stroke={TOON_OUTLINE}
          strokeWidth={2}
          strokeLinecap="round"
          fill="none"
        />
      ) : (
        <>
          {/* 부릅뜬 눈썹 + 눈 */}
          <path d={`M${x + dir * 3} ${y - 1} L${x + dir * 11} ${y + 1}`} stroke={TOON_OUTLINE} strokeWidth={2.2} strokeLinecap="round" />
          <circle cx={x + dir * 8} cy={y + 4} r={2} fill={TOON_OUTLINE} />
        </>
      )}
      {/* 입 */}
      <path d={`M${x + dir * 6} ${y + 10} L${x + dir * 11} ${y + 9}`} stroke={TOON_OUTLINE} strokeWidth={1.8} strokeLinecap="round" />
    </g>
  )
}

/** 권투 글러브 */
function Glove({ at, color }: { at: string; color: string }) {
  const [x, y] = at.split(' ').map(Number)
  return <circle cx={x} cy={y} r={8.5} fill={color} stroke={TOON_OUTLINE} strokeWidth={O * 2} />
}

function Fighter({ show, side, reveal, now, name }: { show: FighterShow; side: 0 | 1; reveal: number | null; now: number; name: string }) {
  const dir = side === 0 ? 1 : -1
  const color = COLORS[side]
  const pose = POSES[poseOf(show)]
  const p = reveal ?? 0
  const hurt = !!show.event && isHurt(show.event) && !show.hidden
  // 공개 순간 동작: 타격은 앞으로 뛰어들고, 맞으면 뒤로 밀린다
  let shift = 0
  const lunging = reveal !== null && (show.stance === 'attack' || show.stance === 'smash') && !show.hidden
  if (lunging) {
    // 막히거나 부딪히면 상대 앞(방패·주먹)에서 멈춘다. 강타는 상대를 밀어내며 더 깊이
    const reach = show.event === 'strike' ? 40 : show.event === 'smash-hit' ? 34 : show.event === 'clash' ? 6 : 10
    shift = reach * Math.min(1, p / 0.15)
  }
  // 맞으면 뒤로 밀린다. 강타에 맞으면 더 멀리
  if (reveal !== null && hurt) shift = (show.event === 'hurt' ? -14 : -30) * Math.min(1, p / 0.2)
  const bob = reveal === null ? Math.sin(now / 160 + side * 1.3) * 1.5 : 0
  const ox = FIGHTER_X[side] + shift * dir
  const at = ([x, y]: Point) => `${ox + x * dir} ${GROUND_Y - y + (y > 30 ? bob : 0)}`
  const line = (...pts: Point[]) => `M${pts.map(at).join('L')}`
  const [hx, hy] = [ox + pose.head[0] * dir, GROUND_Y - pose.head[1] + bob]
  const ev = !show.hidden && show.event ? EVENT_TEXT[show.event] : undefined

  return (
    <g className="ft-fighter">
      {/* 기 모으기: 몸을 감싸는 노란 기운 + 위로 솟는 반짝이 */}
      {!show.hidden && (show.event === 'charge' || show.event === 'charge-full') && (
        <g opacity={1 - p * 0.7}>
          <ellipse cx={ox} cy={GROUND_Y - 55} rx={36 + 8 * Math.sin(p * 12)} ry={68} className="ft-aura" />
          {[-20, 4, 22].map((dx, i) => (
            <path key={dx} d={starPath(ox + dx, GROUND_Y - 30 - ((p * 120 + i * 30) % 110), 5, 4, 0.35)} className="ft-sparkle" />
          ))}
        </g>
      )}
      {/* 내지를 때 뒤로 남는 속도선 */}
      {lunging && p < 0.35 && (
        <g className="ft-speed" opacity={1 - p / 0.35}>
          {[70, 84, 98].map((y, i) => (
            <path key={y} d={`M${ox - dir * (24 + i * 6)} ${GROUND_Y - y} l${-dir * (26 + i * 8)} 0`} />
          ))}
        </g>
      )}
      <Bone d={line(pose.neck, pose.elbows[1], pose.fists[1])} w={8} color={TOON_SKIN} />
      <Glove at={at(pose.fists[1])} color={color} />
      <Bone d={line(pose.hip, pose.knees[1], pose.feet[1])} w={11} color={PANTS} />
      <Bone d={line(pose.neck, pose.hip)} w={22} color={color} />
      <Bone d={line(pose.hip, pose.knees[0], pose.feet[0])} w={11} color={PANTS} />
      <Head x={hx} y={hy} dir={dir} color={color} hurt={hurt} now={now} />
      <Bone d={line(pose.neck, pose.elbows[0], pose.fists[0])} w={8} color={TOON_SKIN} />
      <Glove at={at(pose.fists[0])} color={color} />
      {/* 방어: 앞에 파란 기운 방패 */}
      {!show.hidden && show.stance === 'guard' && (
        <path
          className={show.event === 'block' ? 'ft-shield ft-shield--hit' : show.event === 'pierced' ? 'ft-shield ft-shield--broken' : 'ft-shield'}
          d={`M${ox + 30 * dir} ${GROUND_Y - 124}Q${ox + 60 * dir} ${GROUND_Y - 70} ${ox + 30 * dir} ${GROUND_Y - 16}Q${ox + 44 * dir} ${GROUND_Y - 70} ${ox + 30 * dir} ${GROUND_Y - 124}Z`}
        />
      )}
      {/* 맞음: 얼굴 앞에서 번쩍 */}
      {hurt && p < 0.5 && (
        <g opacity={1 - p / 0.5}>
          <path d={starPath(hx + dir * 14, hy + 4, (show.event === 'hurt' ? 16 : 24) * (0.6 + p), 9)} className="ft-hit" />
          <path d={starPath(hx + dir * 14, hy + 4, (show.event === 'hurt' ? 7 : 11) * (0.6 + p), 7)} className="ft-hit__core" />
        </g>
      )}
      {/* 강타: 주먹 앞에 터지는 충격파 */}
      {!show.hidden && show.event === 'smash-hit' && <circle className="ft-smash" cx={ox + 70 * dir} cy={GROUND_Y - 84} r={10 + 30 * p} opacity={1 - p} />}
      {show.hidden && (
        <text className="ft-secret" x={FIGHTER_X[side]} y={GROUND_Y - 140}>
          ?
        </text>
      )}
      {ev && (
        <text className={`ft-pop ft-pop--${ev.tone}`} x={FIGHTER_X[side]} y={GROUND_Y - 138 - 12 * p}>
          {ev.text}
        </text>
      )}
      <text className="ft-name" x={FIGHTER_X[side]} y={GROUND_Y + 24}>
        {name}
      </text>
    </g>
  )
}

/** 링: 어두운 관중석 배경, 조명, 매트, 로프 */
function Ring({ front }: { front: boolean }) {
  const ropes = [GROUND_Y - 34, GROUND_Y - 62, GROUND_Y - 90]
  if (front) {
    // 앞쪽 기둥
    return (
      <g>
        {[14, VIEW_W - 22].map((x) => (
          <rect key={x} x={x} y={GROUND_Y - 100} width={8} height={110} rx={3} className="ft-post" />
        ))}
      </g>
    )
  }
  return (
    <g>
      <rect x={0} y={0} width={VIEW_W} height={VIEW_H} className="ft-bg" />
      {/* 조명 */}
      <path d={`M90 0 L40 ${GROUND_Y} L170 ${GROUND_Y} Z`} className="ft-light" />
      <path d={`M270 0 L190 ${GROUND_Y} L320 ${GROUND_Y} Z`} className="ft-light" />
      {/* 어두운 관중 머리 */}
      {Array.from({ length: 24 }, (_, i) => (
        <circle key={i} cx={8 + i * 15 + (i % 2) * 4} cy={GROUND_Y - 116 + (i % 3) * 5} r={7} className="ft-crowd" />
      ))}
      {/* 뒤쪽 로프 */}
      {ropes.map((y, i) => (
        <path key={y} d={`M18 ${y} L${VIEW_W - 18} ${y}`} className={`ft-rope ft-rope--${i}`} />
      ))}
      {/* 매트 */}
      <path d={`M0 ${GROUND_Y - 6} L${VIEW_W} ${GROUND_Y - 6} L${VIEW_W} ${GROUND_Y + 8} L0 ${GROUND_Y + 8} Z`} className="ft-mat" />
      {/* 링 아래 천 (이름이 이 위에 보임) */}
      <rect x={0} y={GROUND_Y + 8} width={VIEW_W} height={VIEW_H - GROUND_Y - 8} className="ft-apron" />
    </g>
  )
}

export function FightView({ fighters, reveal, now, names }: Props) {
  const clash = reveal !== null && fighters[0].event === 'clash'
  const p = reveal ?? 0
  // 누가 맞으면 화면이 잠깐 흔들린다 (강타·뚫림은 더 세게)
  const hits = fighters.filter((f) => !f.hidden && f.event && isHurt(f.event))
  const strong = hits.some((f) => f.event !== 'hurt')
  const amp = reveal !== null && hits.length > 0 && p < 0.3 ? (strong ? 6 : 3) * (1 - p / 0.3) : 0
  const shake = { x: Math.sin(p * 90) * amp, y: Math.cos(p * 70) * amp * 0.6 }

  return (
    <svg className="ft-view" viewBox={`0 0 ${VIEW_W} ${VIEW_H}`} role="img" aria-label="링 위에 마주 선 두 격투가">
      <defs>
        <radialGradient id="ft-aura-glow">
          <stop offset="55%" stopColor="#fde047" stopOpacity={0} />
          <stop offset="100%" stopColor="#fde047" stopOpacity={0.85} />
        </radialGradient>
      </defs>
      <g transform={`translate(${shake.x} ${shake.y})`}>
        <Ring front={false} />
        <Fighter show={fighters[0]} side={0} reveal={reveal} now={now} name={names[0]} />
        <Fighter show={fighters[1]} side={1} reveal={reveal} now={now} name={names[1]} />
        {clash && (
          <g>
            <path d={starPath(VIEW_W / 2, GROUND_Y - 100, 14 + 14 * p, 10)} className="ft-hit" opacity={1 - p} />
            <g className="ft-clash">
              {Array.from({ length: 8 }, (_, i) => {
                const a = (i / 8) * Math.PI * 2
                const r1 = 10
                const r2 = 22 + 14 * p
                const cx = VIEW_W / 2
                const cy = GROUND_Y - 100
                return <path key={i} d={`M${cx + Math.cos(a) * r1} ${cy + Math.sin(a) * r1}L${cx + Math.cos(a) * r2} ${cy + Math.sin(a) * r2}`} />
              })}
            </g>
            <text className="ft-pop ft-pop--plain" x={VIEW_W / 2} y={GROUND_Y - 140}>
              상쇄!
            </text>
          </g>
        )}
        <Ring front />
      </g>
    </svg>
  )
}
