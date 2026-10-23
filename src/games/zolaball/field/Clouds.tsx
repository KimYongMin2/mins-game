import { memo } from 'react'
// 하늘의 흰 구름. 작은 구름은 투수-타자 시점에, 큰 구름은 전체 필드 시점에 보인다.
const CLOUDS = [
  { x: 4, y: 9.5, size: 1.4 },
  { x: 14, y: 11, size: 1.1 },
  { x: 45, y: 60, size: 7 },
  { x: 92, y: 75, size: 9 },
  { x: 140, y: 58, size: 6 },
]

function cloudPath(x: number, y: number, s: number) {
  // 바닥은 평평하고 위는 볼록한 세 덩이
  const top = -y
  return `M${x - 2 * s} ${top}
    a${s * 0.8} ${s * 0.8} 0 0 1 ${s * 1.2} ${-s * 0.7}
    a${s} ${s} 0 0 1 ${s * 1.8} ${-s * 0.3}
    a${s * 0.8} ${s * 0.8} 0 0 1 ${s} ${s * 1}
    Z`
}

export const Clouds = memo(function Clouds() {
  return (
    <g className="zb-cloud">
      {CLOUDS.map((c) => (
        <path key={`${c.x}-${c.y}`} d={cloudPath(c.x, c.y, c.size)} />
      ))}
    </g>
  )
})
