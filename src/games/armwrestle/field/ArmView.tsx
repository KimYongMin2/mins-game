import { TOON_OUTLINE, TOON_SKIN, starPath } from '../../../shared/art/shapes'
import { Bone as ToonBone } from '../../../shared/art/toon'

// 옆에서 본 팔씨름. 왼쪽이 나(파랑), 오른쪽이 상대(빨강). 탁자 가운데에서 맞잡은 손이 위치만큼 기운다.
// 이기는 쪽이 손을 자기 쪽으로 끌어당긴다 (처음엔 상대 쪽으로 넘기는 그림이었는데 거꾸로 보여서 바꿈).
// 처음엔 흰 바탕 선화 졸라맨이었는데 만화풍(근육질 선수, 나무 벽·전등)으로 바꿈.

export const VIEW_W = 360
export const VIEW_H = 210
const TABLE_Y = 140
const FLOOR_Y = 196
const PIVOT_X = VIEW_W / 2
/** 팔꿈치에서 맞잡은 손까지 */
const FOREARM = 52
/** 끝까지 넘어갔을 때 기울기 */
const MAX_TILT = (72 * Math.PI) / 180
const COLORS = ['#2563eb', '#dc2626'] as const
const PANTS = '#334155'
const O = 2

type Props = {
  /** −1(상대 승) ~ +1(내 승) */
  pos: number
  /** 당기는 중이면 몸을 살짝 떤다 */
  straining: boolean
  now: number
  names: readonly [string, string]
  /** 판 결과: 이긴 쪽 */
  winner: 0 | 1 | null
}

type Point = readonly [number, number]

const Bone = (props: { d: string; w: number; color: string }) => <ToonBone {...props} outline={O} />

/** 얼굴: 뾰족 머리, 눈(지면 ✕), 입(힘줄 땐 이 악물기, 이기면 웃음) */
function Head({ x, y, dir, mood }: { x: number; y: number; dir: number; mood: 'strain' | 'calm' | 'win' | 'lose' }) {
  const r = 14
  return (
    <g>
      <circle cx={x} cy={y} r={r} fill={TOON_SKIN} stroke={TOON_OUTLINE} strokeWidth={O * 2} />
      {/* 뾰족 머리 */}
      <path
        d={`M${x - dir * r} ${y - 2} L${x - dir * 12} ${y - 18} L${x - dir * 4} ${y - 12} L${x + dir * 2} ${y - 20} L${x + dir * 6} ${y - 11} L${x + dir * 13} ${y - 15} L${x + dir * r * 0.8} ${y - 6} Z`}
        fill="#1f2937"
        stroke={TOON_OUTLINE}
        strokeWidth={1}
        strokeLinejoin="round"
      />
      {mood === 'lose' ? (
        <path d={`M${x + dir * 4} ${y - 2} l${dir * 6} 6 m0 -6 l${-dir * 6} 6`} stroke={TOON_OUTLINE} strokeWidth={2} strokeLinecap="round" />
      ) : (
        <>
          <path d={`M${x + dir * 2} ${y - 3} L${x + dir * 11} ${y - (mood === 'win' ? 5 : 0)}`} stroke={TOON_OUTLINE} strokeWidth={2.2} strokeLinecap="round" />
          <circle cx={x + dir * 8} cy={y + 2} r={2} fill={TOON_OUTLINE} />
        </>
      )}
      {mood === 'strain' && (
        // 이 악물기
        <rect x={dir > 0 ? x + 3 : x - 11} y={y + 6} width={8} height={4} rx={1} fill="#fff" stroke={TOON_OUTLINE} strokeWidth={1.2} />
      )}
      {mood === 'win' && <path d={`M${x + dir * 3} ${y + 7} Q${x + dir * 8} ${y + 12} ${x + dir * 12} ${y + 6}`} stroke={TOON_OUTLINE} strokeWidth={1.8} fill="none" strokeLinecap="round" />}
      {(mood === 'calm' || mood === 'lose') && <path d={`M${x + dir * 5} ${y + 9} L${x + dir * 10} ${y + 9}`} stroke={TOON_OUTLINE} strokeWidth={1.8} strokeLinecap="round" />}
    </g>
  )
}

function Wrestler({
  side,
  hand,
  lean,
  shake,
  name,
  mood,
  part,
}: {
  side: 0 | 1
  hand: Point
  lean: number
  shake: number
  name: string
  mood: 'strain' | 'calm' | 'win' | 'lose'
  /** body = 몸(탁자 뒤), arm = 겨루는 팔(탁자 위) */
  part: 'body' | 'arm'
}) {
  // 왼쪽(나) 기준으로 그리고 오른쪽은 좌우를 뒤집는다
  const dir = side === 0 ? 1 : -1
  const fx = (x: number) => (side === 0 ? x : VIEW_W - x)
  const p = ([x, y]: Point) => `${fx(x)} ${y}`
  const color = COLORS[side]
  // 탁자에 바짝 붙어 앉는다 (멀면 팔이 너무 길어 보임)
  const hip: Point = [108 + lean * 0.4, 128]
  const neck: Point = [120 + lean, 82 + shake]
  const head: Point = [118 + lean * 1.1, 62 + shake]
  // 팔꿈치는 탁자 가운데에 바짝 모은다 (떨어져 있으면 기울 때 한쪽 팔이 길게 늘어나 보임)
  const elbow: Point = [PIVOT_X - 9, TABLE_Y - 4]
  const shoulder: Point = [neck[0] + 4, neck[1] + 6]

  if (part === 'arm') {
    // 겨루는 팔: 어깨 → 팔꿈치(탁자 위) → 맞잡은 손 (손 좌표는 이미 화면 기준)
    return (
      <g>
        <Bone d={`M${p(shoulder)}L${p(elbow)}`} w={15} color={TOON_SKIN} />
        <Bone d={`M${p(elbow)}L${hand[0]} ${hand[1]}`} w={11} color={TOON_SKIN} />
      </g>
    )
  }

  return (
    <g className={mood === 'lose' ? 'aw-wrestler--lost' : undefined}>
      {/* 의자 */}
      <path className="aw-chair" d={`M${p([84, 132])}L${p([132, 132])}M${p([90, 132])}L${p([90, FLOOR_Y])}M${p([126, 132])}L${p([126, FLOOR_Y])}`} />
      {/* 다리: 앉은 자세 (무릎은 탁자 밑) */}
      <Bone d={`M${p(hip)}L${p([142, 134])}L${p([140, FLOOR_Y - 4])}`} w={14} color={PANTS} />
      <Bone d={`M${p([140, FLOOR_Y - 4])}L${p([148, FLOOR_Y - 4])}`} w={8} color="#111827" />
      {/* 몸통: 민소매 */}
      <Bone d={`M${p(neck)}L${p(hip)}`} w={32} color={color} />
      {/* 안 쓰는 팔은 그리지 않는다 (팔이 두 개로 보여 헷갈려서 뺌) */}
      <Head x={fx(head[0])} y={head[1]} dir={dir} mood={mood} />
      <text className="aw-name" x={fx(108)} y={VIEW_H - 2}>
        {name}
      </text>
    </g>
  )
}

/** 힘줄 때 머리 옆 땀방울과 💢 표시 */
function Strain({ side, now, lean }: { side: 0 | 1; now: number; lean: number }) {
  const fx = (x: number) => (side === 0 ? x : VIEW_W - x)
  const t = (now / 600 + side * 0.5) % 1
  const hx = fx(118 + lean * 1.1)
  const dir = side === 0 ? -1 : 1
  return (
    <g>
      {/* 머리 뒤로 튀는 땀방울 */}
      <path
        d={`M${hx + dir * (16 + t * 10)} ${44 + t * 18} q3 5 0 7 q-3 -2 0 -7Z`}
        className="aw-sweat"
        opacity={1 - t}
      />
      {/* 💢 */}
      <g className="aw-vein" transform={`translate(${hx + dir * 10} 44)`}>
        <path d="M-5 -2 q2 -1 2 -4 M5 -2 q-2 -1 -2 -4 M-5 2 q2 1 2 4 M5 2 q-2 1 -2 4" />
      </g>
    </g>
  )
}

export function ArmView({ pos, straining, now, names, winner }: Props) {
  const tilt = pos * MAX_TILT
  const hand: Point = [PIVOT_X - Math.sin(tilt) * FOREARM, TABLE_Y - 6 - Math.cos(tilt) * FOREARM]
  const shake = (side: 0 | 1) => (straining ? Math.sin(now / 35 + side * 2) * 1.2 : 0)
  const mood = (side: 0 | 1) => (winner === null ? (straining ? 'strain' : 'calm') : winner === side ? 'win' : 'lose')
  const leans = [-pos * 10, pos * 10] as const
  // 판이 끝나면 손이 탁자에 쾅
  const slamX = winner === null ? null : winner === 0 ? PIVOT_X - FOREARM : PIVOT_X + FOREARM

  return (
    <svg className="aw-view" viewBox={`0 0 ${VIEW_W} ${VIEW_H}`} role="img" aria-label="팔씨름하는 두 선수">
      <defs>
        <linearGradient id="aw-wall" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#7c2d12" />
          <stop offset="100%" stopColor="#c2410c" />
        </linearGradient>
      </defs>
      {/* 나무 벽과 바닥 */}
      <rect x={0} y={0} width={VIEW_W} height={FLOOR_Y} fill="url(#aw-wall)" />
      {[60, 120, 180, 240, 300].map((x) => (
        <path key={x} d={`M${x} 0 V${FLOOR_Y}`} className="aw-plank" />
      ))}
      <rect x={0} y={FLOOR_Y} width={VIEW_W} height={VIEW_H - FLOOR_Y} className="aw-floor" />
      {/* 매달린 전등과 불빛 */}
      <path d={`M${PIVOT_X} 0 V14`} className="aw-cord" />
      <path d={`M${PIVOT_X - 12} 24 H${PIVOT_X + 12} L${PIVOT_X + 75} ${TABLE_Y} H${PIVOT_X - 75} Z`} className="aw-light" />
      <path d={`M${PIVOT_X - 16} 26 Q${PIVOT_X} 8 ${PIVOT_X + 16} 26 Z`} className="aw-lamp" />

      <Wrestler side={0} hand={hand} lean={leans[0]} shake={shake(0)} name={names[0]} mood={mood(0)} part="body" />
      <Wrestler side={1} hand={hand} lean={leans[1]} shake={shake(1)} name={names[1]} mood={mood(1)} part="body" />

      {/* 탁자 */}
      <path d={`M${PIVOT_X - 48} ${TABLE_Y} V${FLOOR_Y} M${PIVOT_X + 48} ${TABLE_Y} V${FLOOR_Y}`} className="aw-table-leg" />
      <rect x={PIVOT_X - 64} y={TABLE_Y - 3} width={128} height={9} rx={2} className="aw-table" />
      {/* 손이 닿으면 끝나는 자리: 왼쪽(내 쪽으로 당김)은 파랑 = 이김, 오른쪽은 빨강 = 짐 */}
      <rect x={PIVOT_X - FOREARM - 9} y={TABLE_Y - 6} width={18} height={4} rx={2} className="aw-pad aw-pad--win" />
      <rect x={PIVOT_X + FOREARM - 9} y={TABLE_Y - 6} width={18} height={4} rx={2} className="aw-pad aw-pad--lose" />

      <Wrestler side={0} hand={hand} lean={leans[0]} shake={shake(0)} name={names[0]} mood={mood(0)} part="arm" />
      <Wrestler side={1} hand={hand} lean={leans[1]} shake={shake(1)} name={names[1]} mood={mood(1)} part="arm" />
      {/* 맞잡은 손 */}
      <circle cx={hand[0]} cy={hand[1]} r={9} fill={TOON_SKIN} stroke={TOON_OUTLINE} strokeWidth={O * 2} />
      {/* 힘겨루기 중: 손 주변이 떨리며 불꽃 */}
      {straining &&
        winner === null &&
        [0, 1, 2, 3].map((k) => {
          const a = now / 90 + k * 1.6
          const r1 = 12
          const r2 = 18 + Math.sin(now / 40 + k) * 3
          return (
            <path
              key={k}
              d={`M${hand[0] + Math.cos(a) * r1} ${hand[1] + Math.sin(a) * r1} L${hand[0] + Math.cos(a) * r2} ${hand[1] + Math.sin(a) * r2}`}
              className="aw-spark"
            />
          )
        })}
      {straining && winner === null && <Strain side={0} now={now} lean={leans[0]} />}
      {straining && winner === null && <Strain side={1} now={now} lean={leans[1]} />}
      {slamX !== null && (
        <g>
          <path d={starPath(slamX, TABLE_Y - 6, 20, 10)} className="aw-slam" />
          <path d={starPath(slamX, TABLE_Y - 6, 9, 8)} className="aw-slam__core" />
        </g>
      )}
    </svg>
  )
}
