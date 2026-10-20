// 옆에서 본 팔씨름. 왼쪽이 나, 오른쪽이 상대. 탁자 가운데에서 맞잡은 손이 위치만큼 기운다.

export const VIEW_W = 360
export const VIEW_H = 210
const TABLE_Y = 140
const PIVOT_X = VIEW_W / 2
/** 팔꿈치에서 맞잡은 손까지 */
const FOREARM = 52
/** 끝까지 넘어갔을 때 기울기 */
const MAX_TILT = (72 * Math.PI) / 180

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

function Wrestler({ side, hand, lean, shake, name, lost }: { side: 0 | 1; hand: Point; lean: number; shake: number; name: string; lost: boolean }) {
  // 왼쪽(나) 기준으로 그리고 오른쪽은 좌우를 뒤집는다
  const fx = (x: number) => (side === 0 ? x : VIEW_W - x)
  const p = ([x, y]: Point) => `${fx(x)} ${y}`
  const hip: Point = [92 + lean * 0.4, 128]
  const neck: Point = [100 + lean, 74 + shake]
  const head: Point = [97 + lean * 1.1, 58 + shake]
  const elbow: Point = [PIVOT_X - 18, TABLE_Y - 2]
  const shoulder: Point = [neck[0] + 4, neck[1] + 8]
  return (
    <g className={`aw-wrestler aw-wrestler--${side === 0 ? 'me' : 'foe'}${lost ? ' aw-wrestler--lost' : ''}`}>
      {/* 의자 */}
      <path className="aw-chair" d={`M${p([70, 132])}L${p([112, 132])}M${p([76, 132])}L${p([76, 196])}M${p([106, 132])}L${p([106, 196])}`} />
      <path d={`M${p(neck)}L${p(hip)}`} />
      {/* 다리: 앉은 자세 */}
      <path d={`M${p(hip)}L${p([126, 134])}L${p([124, 196])}`} />
      {/* 안 쓰는 팔은 무릎 위에 */}
      <path d={`M${p(shoulder)}L${p([98 + lean * 0.5, 108])}L${p([116, 126])}`} />
      {/* 겨루는 팔: 어깨 → 팔꿈치(탁자 위) → 맞잡은 손 (손 좌표는 이미 화면 기준) */}
      <path d={`M${p(shoulder)}L${p(elbow)}L${hand[0]} ${hand[1]}`} className="aw-arm" />
      <circle className="aw-head" cx={fx(head[0])} cy={head[1]} r={13} />
      <text className="aw-name" x={fx(100)} y={VIEW_H - 2}>
        {name}
      </text>
    </g>
  )
}

export function ArmView({ pos, straining, now, names, winner }: Props) {
  const tilt = pos * MAX_TILT
  const hand: Point = [PIVOT_X + Math.sin(tilt) * FOREARM, TABLE_Y - 4 - Math.cos(tilt) * FOREARM]
  const shake = (side: 0 | 1) => (straining ? Math.sin(now / 35 + side * 2) * 1.2 : 0)
  return (
    <svg className="aw-view" viewBox={`0 0 ${VIEW_W} ${VIEW_H}`} role="img" aria-label="팔씨름하는 두 졸라맨">
      <path className="aw-floor" d={`M10 196H${VIEW_W - 10}`} />
      {/* 탁자 */}
      <path className="aw-table" d={`M${PIVOT_X - 62} ${TABLE_Y}H${PIVOT_X + 62}M${PIVOT_X - 50} ${TABLE_Y}V196M${PIVOT_X + 50} ${TABLE_Y}V196`} />
      {/* 이기는 쪽은 앞으로 기울고, 지는 쪽은 뒤로 젖혀진다 */}
      <Wrestler side={0} hand={hand} lean={pos * 8} shake={shake(0)} name={names[0]} lost={winner === 1} />
      <Wrestler side={1} hand={hand} lean={-pos * 8} shake={shake(1)} name={names[1]} lost={winner === 0} />
      {/* 맞잡은 손 */}
      <circle className="aw-grip" cx={hand[0]} cy={hand[1]} r={7} />
      {/* 손이 닿으면 지는 자리: 왼쪽(내 쪽)은 빨강, 오른쪽(상대 쪽)은 파랑 */}
      <path className="aw-pad aw-pad--lose" d={`M${PIVOT_X - FOREARM - 8} ${TABLE_Y - 1}h16`} />
      <path className="aw-pad aw-pad--win" d={`M${PIVOT_X + FOREARM - 8} ${TABLE_Y - 1}h16`} />
    </svg>
  )
}
