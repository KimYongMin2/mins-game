import type { Stance, TurnEvent } from '../rules/turn'

// 옆에서 본 두 졸라맨. 왼쪽이 나, 오른쪽이 상대. 흰 바탕 선화.

export const VIEW_W = 360
export const VIEW_H = 220
const GROUND_Y = 190
const FIGHTER_X = [120, 240] as const

type Point = readonly [number, number]

/** 관절 위치 (앞쪽이 +x, 위쪽이 +y, 발 가운데가 원점) */
type Pose = {
  head: Point
  neck: Point
  hip: Point
  knees: readonly [Point, Point]
  feet: readonly [Point, Point]
  elbows: readonly [Point, Point]
  fists: readonly [Point, Point]
}

const POSES: Record<'idle' | 'ready' | 'guard' | 'attack' | 'hurt', Pose> = {
  // 주먹을 들고 선 자세
  idle: {
    head: [2, 102],
    neck: [0, 88],
    hip: [-2, 46],
    knees: [[-10, 23], [12, 23]],
    feet: [[-16, 0], [16, 0]],
    elbows: [[10, 66], [2, 70]],
    fists: [[22, 80], [14, 86]],
  },
  // 쪼그려 기 모으기
  ready: {
    head: [0, 92],
    neck: [0, 78],
    hip: [0, 38],
    knees: [[-18, 20], [18, 20]],
    feet: [[-18, 0], [18, 0]],
    elbows: [[-14, 60], [14, 60]],
    fists: [[-8, 44], [8, 44]],
  },
  // 팔을 엇갈려 얼굴을 막음
  guard: {
    head: [-4, 100],
    neck: [-4, 86],
    hip: [-4, 45],
    knees: [[-12, 22], [8, 23]],
    feet: [[-18, 0], [14, 0]],
    elbows: [[16, 70], [12, 64]],
    fists: [[14, 98], [20, 86]],
  },
  // 앞으로 내지르는 주먹
  attack: {
    head: [22, 98],
    neck: [16, 85],
    hip: [6, 45],
    knees: [[-6, 22], [22, 22]],
    feet: [[-22, 0], [28, 0]],
    elbows: [[36, 82], [2, 66]],
    fists: [[56, 84], [8, 78]],
  },
  // 맞고 뒤로 젖혀짐
  hurt: {
    head: [-20, 94],
    neck: [-13, 82],
    hip: [-4, 44],
    knees: [[-12, 22], [10, 22]],
    feet: [[-18, 0], [16, 0]],
    elbows: [[-22, 76], [-14, 62]],
    fists: [[-26, 96], [-30, 70]],
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
  if (f.event === 'hurt') return 'hurt'
  return f.stance
}

/** 이벤트 위에 띄우는 글자 */
const EVENT_TEXT: Partial<Record<TurnEvent, { text: string; tone: 'good' | 'bad' | 'plain' }>> = {
  charge: { text: '+1', tone: 'good' },
  'charge-full': { text: '꽉 참', tone: 'plain' },
  hurt: { text: '−1', tone: 'bad' },
  block: { text: '막음!', tone: 'good' },
  strike: { text: '명중!', tone: 'good' },
  blocked: { text: '막힘', tone: 'plain' },
}

function Fighter({ show, side, reveal, now, name }: { show: FighterShow; side: 0 | 1; reveal: number | null; now: number; name: string }) {
  const dir = side === 0 ? 1 : -1
  const pose = POSES[poseOf(show)]
  const p = reveal ?? 0
  // 공개 순간 동작: 타격은 앞으로 뛰어들고, 맞으면 뒤로 밀린다
  let shift = 0
  if (reveal !== null && show.stance === 'attack' && !show.hidden) {
    // 막히거나 부딪히면 상대 앞(방패·주먹)에서 멈춘다
    const reach = show.event === 'strike' ? 40 : show.event === 'clash' ? 6 : 10
    shift = reach * Math.min(1, p / 0.15)
  }
  if (reveal !== null && show.event === 'hurt') shift = -14 * Math.min(1, p / 0.2)
  const bob = reveal === null ? Math.sin(now / 160 + side * 1.3) * 1.5 : 0
  const ox = FIGHTER_X[side] + shift * dir
  const at = ([x, y]: Point) => `${ox + x * dir} ${GROUND_Y - y + (y > 30 ? bob : 0)}`
  const [hx, hy] = [ox + pose.head[0] * dir, GROUND_Y - pose.head[1] + bob]
  const limb = (a: Point, b: Point, c: Point) => `M${at(a)}L${at(b)}L${at(c)}`
  const ev = !show.hidden && show.event ? EVENT_TEXT[show.event] : undefined
  return (
    <g className={`ft-fighter${show.event === 'hurt' ? ' ft-fighter--hurt' : ''}`}>
      {/* 기 모으기: 몸 주위로 퍼지는 동그라미 */}
      {!show.hidden && (show.event === 'charge' || show.event === 'charge-full') && (
        <circle className="ft-aura" cx={ox} cy={GROUND_Y - 55} r={40 + 18 * p} opacity={1 - p} />
      )}
      {/* 방어: 앞에 방패 호 */}
      {!show.hidden && show.stance === 'guard' && (
        <path
          className={show.event === 'block' ? 'ft-shield ft-shield--hit' : 'ft-shield'}
          d={`M${ox + 34 * dir} ${GROUND_Y - 120}Q${ox + 52 * dir} ${GROUND_Y - 70} ${ox + 34 * dir} ${GROUND_Y - 20}`}
        />
      )}
      <path d={`M${at(pose.neck)}L${at(pose.hip)}`} />
      <path d={limb(pose.hip, pose.knees[0], pose.feet[0])} />
      <path d={limb(pose.hip, pose.knees[1], pose.feet[1])} />
      <path d={limb(pose.neck, pose.elbows[1], pose.fists[1])} />
      <path d={limb(pose.neck, pose.elbows[0], pose.fists[0])} />
      <circle className="ft-head" cx={hx} cy={hy} r={13} />
      {show.hidden && (
        <text className="ft-secret" x={FIGHTER_X[side]} y={GROUND_Y - 140}>
          ?
        </text>
      )}
      {ev && (
        <text className={`ft-pop ft-pop--${ev.tone}`} x={FIGHTER_X[side]} y={GROUND_Y - 135 - 12 * p}>
          {ev.text}
        </text>
      )}
      <text className="ft-name" x={FIGHTER_X[side]} y={GROUND_Y + 22}>
        {name}
      </text>
    </g>
  )
}

export function FightView({ fighters, reveal, now, names }: Props) {
  const clash = reveal !== null && fighters[0].event === 'clash'
  return (
    <svg className="ft-view" viewBox={`0 0 ${VIEW_W} ${VIEW_H}`} role="img" aria-label="마주 선 두 졸라맨">
      <path className="ft-ground" d={`M10 ${GROUND_Y}H${VIEW_W - 10}`} />
      <Fighter show={fighters[0]} side={0} reveal={reveal} now={now} name={names[0]} />
      <Fighter show={fighters[1]} side={1} reveal={reveal} now={now} name={names[1]} />
      {clash && (
        <g className="ft-clash">
          {Array.from({ length: 8 }, (_, i) => {
            const a = (i / 8) * Math.PI * 2
            const r1 = 6
            const r2 = 16 + 10 * (reveal ?? 0)
            const cx = VIEW_W / 2
            const cy = GROUND_Y - 106
            return <path key={i} d={`M${cx + Math.cos(a) * r1} ${cy + Math.sin(a) * r1}L${cx + Math.cos(a) * r2} ${cy + Math.sin(a) * r2}`} />
          })}
          <text className="ft-pop ft-pop--plain" x={VIEW_W / 2} y={GROUND_Y - 140}>
            상쇄!
          </text>
        </g>
      )}
    </svg>
  )
}
