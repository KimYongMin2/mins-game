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

/** 오른쪽(투수 쪽)을 보고 배트를 어깨 뒤로 든 타자 */
export function Batter({ x, ground = 0, height: h }: FigureProps) {
  const g = ground
  const r = h * 0.12
  const neck = g + h - r * 2
  const shoulder = g + h * 0.7
  const hip = g + h * 0.42
  const hands = { x: x - h * 0.14, y: g + h * 0.72 }

  return (
    <g className="zb-figure">
      {/* 다리: 무릎을 살짝 굽힌 자세 */}
      <path
        d={`M${point(x, hip)} L${point(x + h * 0.13, g + h * 0.2)} L${point(x + h * 0.2, g)}
            M${point(x, hip)} L${point(x - h * 0.12, g + h * 0.2)} L${point(x - h * 0.18, g)}`}
      />
      {/* 몸통 */}
      <path d={`M${point(x, neck)} L${point(x, hip)}`} />
      {/* 팔: 앞팔은 가슴 앞으로, 뒷팔은 팔꿈치를 들어 두 손을 뒤쪽 어깨 위에 모은다 */}
      <path
        d={`M${point(x, shoulder)} L${point(x + h * 0.06, g + h * 0.56)} L${point(hands.x, hands.y)}
            M${point(x, shoulder)} L${point(x - h * 0.22, g + h * 0.6)} L${point(hands.x, hands.y)}`}
      />
      {/* 배트 */}
      <path
        className="zb-bat"
        d={`M${point(hands.x, hands.y)} L${point(x - h * 0.4, g + h * 1.12)}`}
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
