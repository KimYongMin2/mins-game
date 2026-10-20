import type { PointerEvent } from 'react'
import type { Hand } from '../constants'
import { BALL_RADIUS, RELEASE, type Vec3 } from '../play/pitch'
import type { ZonePoint } from '../rules/judge'
import { CELL_SIZE, HORIZON_Y, VIEW_H, VIEW_W, project, zoneRect } from './view'

// 정면 화면: 포수 뒤에서 본 투수·존·타자. 흰 바탕 선화.

/** 투수 동작: 0~1 와인드업, 1에서 공을 놓고, 1~2 팔로스루 */
export type PitcherPose = number

export type SwingPose = {
  /** 0 준비 → CONTACT_AT 공을 맞히는 자세 → 1 팔로스루 */
  progress: number
  /** 터치한 곳 */
  point: ZonePoint
}

/** 터치한 순간이 곧 맞는 순간이라 배트가 빨리 공에 닿게 한다 */
const CONTACT_AT = 0.2

export type Mark = { at: Vec3; latest: boolean }

type Props = {
  hand: Hand
  pitcher: PitcherPose
  ball: Vec3 | null
  swing: SwingPose | null
  /** 공이 지나간 자리 (×) */
  marks: Mark[]
  /** 이번 공이 지나온 길 (오래된 것부터) */
  trail: Vec3[]
  /** 누르는 순간 그 자리에 잠깐 표시 */
  touched: ZonePoint | null
  onPointerDown?: (e: PointerEvent<SVGSVGElement>) => void
}

const ZONE = zoneRect()

/** 화면에서 보이는 공 반지름. 멀리서도 보이게 키운다 */
function ballRadius(scale: number) {
  return Math.max(2.6, BALL_RADIUS * scale * 1.5)
}

/** 존 안 위치(칸 단위) → 화면 좌표 */
function viewOf(p: ZonePoint) {
  return { x: ZONE.x + p.col * CELL_SIZE.width, y: ZONE.y + p.row * CELL_SIZE.height }
}

/** 땅 위 한 점 */
const ground = (x: number, z: number) => project({ x, y: 0, z })

function Ground() {
  const plate = ground(0, 0)
  const lines = [-1, 1].map((side) => {
    const far = ground(side * 90, 90)
    return `M${plate.x} ${plate.y}L${far.x} ${far.y}`
  })
  const mound = ground(0, 18.4)
  const fence = ground(0, 115)
  const fenceTop = project({ x: 0, y: 3, z: 115 })
  // 관중석: 펜스 뒤로 줄지어 앉은 머리들
  const heads: { x: number; y: number }[] = []
  for (let row = 0; row < 3; row++) {
    const y = fenceTop.y - 5 - row * 6
    for (let x = 4 + (row % 2) * 6; x < VIEW_W; x += 12) heads.push({ x, y })
  }
  return (
    <g className="bt-ground">
      <path className="bt-faint" d={`M0 ${HORIZON_Y}H${VIEW_W}`} />
      <path className="bt-faint" d={`M0 ${fenceTop.y}H${VIEW_W}M0 ${fence.y}H${VIEW_W}`} />
      {heads.map((h, i) => (
        <circle key={i} className="bt-fan" cx={h.x} cy={h.y} r={2.2} />
      ))}
      {lines.map((d) => (
        <path key={d} d={d} />
      ))}
      <ellipse cx={mound.x} cy={mound.y} rx={1.6 * mound.scale} ry={0.3 * mound.scale} />
    </g>
  )
}

/** 멀리 있는 투수. 몸 크기는 실제 거리에 맞춘다 */
function Pitcher({ pose }: { pose: PitcherPose }) {
  const at = (x: number, y: number, z = 18.2) => project({ x, y: y + 0.25, z })
  const head = at(0, 1.72)
  const neck = at(0, 1.55)
  const hip = at(0, 0.95)
  const shoulder = at(-0.2, 1.48)
  // 공을 쥔 손: 가슴 앞 → 뒤로 크게 → 놓는 곳 → 반대쪽 아래
  let hand: { x: number; y: number }
  if (pose <= 0) hand = at(-0.05, 1.25)
  else if (pose < 0.7) {
    const k = pose / 0.7
    hand = at(-0.05 - 0.6 * k, 1.25 + 0.75 * k, 18.2 + 0.4 * k)
  } else if (pose <= 1) {
    const k = (pose - 0.7) / 0.3
    const back = { x: -0.65, y: 2.0, z: 18.6 }
    hand = project({
      x: back.x + (RELEASE.x - back.x) * k,
      y: back.y + 0.25 + (RELEASE.y - back.y) * k,
      z: back.z + (RELEASE.z - back.z) * k,
    })
  } else {
    const k = Math.min(1, pose - 1)
    hand = project({ x: RELEASE.x + 0.75 * k, y: RELEASE.y - 0.8 * k, z: RELEASE.z })
  }
  const glove = at(0.25, pose > 0 && pose < 1 ? 1.45 : 1.2, 17.9)
  const footL = at(-0.25, 0)
  const footR = at(0.25, 0)
  const s = head.scale
  return (
    <g className="bt-figure">
      <path d={`M${neck.x} ${neck.y}L${hip.x} ${hip.y}M${hip.x} ${hip.y}L${footL.x} ${footL.y}M${hip.x} ${hip.y}L${footR.x} ${footR.y}`} />
      <path d={`M${shoulder.x} ${shoulder.y}L${hand.x} ${hand.y}M${neck.x} ${neck.y}L${glove.x} ${glove.y}`} />
      <circle className="bt-head" cx={head.x} cy={head.y} r={0.14 * s} />
    </g>
  )
}

/** 존 테두리와 옅은 칸 선. 칸 경계와 상관없이 아무 곳이나 누를 수 있다 */
function Zone({ touched }: { touched: ZonePoint | null }) {
  const t = touched && viewOf(touched)
  return (
    <g className="bt-zone">
      <rect x={ZONE.x} y={ZONE.y} width={ZONE.width} height={ZONE.height} />
      <path
        className="bt-zone__grid"
        d={[1, 2]
          .map(
            (i) =>
              `M${ZONE.x + i * CELL_SIZE.width} ${ZONE.y}V${ZONE.y + ZONE.height}M${ZONE.x} ${ZONE.y + i * CELL_SIZE.height}H${ZONE.x + ZONE.width}`,
          )
          .join('')}
      />
      {t && <circle className="bt-zone__touched" cx={t.x} cy={t.y} r={16} />}
    </g>
  )
}

/** 앞쪽 타자. 실제 비율로 그리면 화면을 덮어서 옆에 크게 그린다 */
function Batter({ hand, swing }: { hand: Hand; swing: SwingPose | null }) {
  // 우타 기준(왼쪽 타석)으로 그리고 좌타는 좌우를 뒤집는다
  const side = hand === 'right' ? 1 : -1
  const fx = (x: number) => (side === 1 ? x : VIEW_W - x)
  const bodyX = 34
  const head = { x: bodyX, y: 150 }
  const neck = { x: bodyX + 2, y: 178 }
  const hip = { x: bodyX + 4, y: 300 }
  const shoulder = { x: bodyX + 4, y: 192 }

  // 배트: 손 위치와 끝 위치. 준비 → 맞히는 자세 → 팔로스루를 잇는다
  const ready = { hands: { x: bodyX + 18, y: 196 }, tip: { x: bodyX - 6, y: 112 } }
  let pose = ready
  if (swing) {
    const real = viewOf(swing.point)
    // 우타 기준 좌표로 그리므로 좌타는 터치 위치도 뒤집는다
    const target = { x: side === 1 ? real.x : VIEW_W - real.x, y: real.y }
    // 스윗스팟이 터치한 곳, 배트 끝은 그보다 반 칸 너머 (판정과 같게)
    const handsY = target.y + 14
    const hands = { x: Math.min(ZONE.x - 8, target.x - 80), y: handsY }
    const sweetLen = Math.hypot(target.x - hands.x, target.y - hands.y)
    const dir = { x: (target.x - hands.x) / sweetLen, y: (target.y - hands.y) / sweetLen }
    const contact = { hands, tip: { x: target.x + dir.x * CELL_SIZE.width * 0.5, y: target.y + dir.y * CELL_SIZE.width * 0.5 } }
    const follow = { hands: { x: hands.x + 30, y: hands.y - 40 }, tip: { x: hands.x + 10, y: hands.y - 150 } }
    const lerp = (a: typeof ready, b: typeof ready, k: number) => ({
      hands: { x: a.hands.x + (b.hands.x - a.hands.x) * k, y: a.hands.y + (b.hands.y - a.hands.y) * k },
      tip: { x: a.tip.x + (b.tip.x - a.tip.x) * k, y: a.tip.y + (b.tip.y - a.tip.y) * k },
    })
    const p = swing.progress
    pose = p < CONTACT_AT ? lerp(ready, contact, p / CONTACT_AT) : lerp(contact, follow, (p - CONTACT_AT) / (1 - CONTACT_AT))
  }
  const knee = { x: bodyX + 22, y: 350 }
  return (
    <g className="bt-figure bt-batter">
      <path
        d={`M${fx(neck.x)} ${neck.y}L${fx(hip.x)} ${hip.y}L${fx(knee.x)} ${knee.y}L${fx(bodyX + 14)} ${VIEW_H + 10}M${fx(hip.x)} ${hip.y}L${fx(bodyX - 18)} ${VIEW_H + 10}`}
      />
      <path d={`M${fx(shoulder.x)} ${shoulder.y}L${fx(pose.hands.x)} ${pose.hands.y}`} />
      <path className="bt-bat" d={`M${fx(pose.hands.x)} ${pose.hands.y}L${fx(pose.tip.x)} ${pose.tip.y}`} />
      <circle className="bt-head" cx={fx(head.x)} cy={head.y} r={24} />
    </g>
  )
}

/** 궤적 꼬리: 가까울수록 굵게 (공 크기를 따라감) */
function Trail({ points }: { points: Vec3[] }) {
  const p = points.map(project)
  return (
    <g className="bt-trail">
      {p.slice(1).map((b, i) => {
        const a = p[i]
        return <path key={i} d={`M${a.x} ${a.y}L${b.x} ${b.y}`} strokeWidth={ballRadius(b.scale) * 0.9} />
      })}
    </g>
  )
}

export function FrontView({ hand, pitcher, ball, swing, marks, trail, touched, onPointerDown }: Props) {
  // 카메라 뒤로 넘어간 공(뒤로 뜬 파울)은 그리지 않는다
  const b = ball && ball.z > -2 ? project(ball) : null
  return (
    <svg className="bt-view" onPointerDown={onPointerDown} viewBox={`0 0 ${VIEW_W} ${VIEW_H}`} role="img" aria-label="타석에서 본 투수와 스트라이크 존">
      <Ground />
      <Pitcher pose={pitcher} />
      <Zone touched={touched} />
      {marks.map((m, i) => {
        const p = project(m.at)
        const r = 7
        return (
          <path
            key={i}
            className={m.latest ? 'bt-mark bt-mark--latest' : 'bt-mark'}
            d={`M${p.x - r} ${p.y - r}L${p.x + r} ${p.y + r}M${p.x + r} ${p.y - r}L${p.x - r} ${p.y + r}`}
          />
        )
      })}
      <Trail points={trail} />
      {b && <circle className="bt-ball" cx={b.x} cy={b.y} r={ballRadius(b.scale)} />}
      <Batter hand={hand} swing={swing} />
    </svg>
  )
}
