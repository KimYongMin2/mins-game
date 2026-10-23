import type { Point } from '../play/pitch'
import type { Impact, ImpactPower } from './impact'

// 타격 순간 효과: 번쩍 터지는 별 + 사방으로 뻗는 선 + '딱!' 글자. power가 셀수록 크다.

const DURATION = 320
const SIZE: Record<ImpactPower, number> = { weak: 0.7, strong: 1.2, homerun: 1.7 }
const WORD: Record<ImpactPower, string> = { weak: '틱', strong: '딱!', homerun: '빡!!' }

function star(cx: number, cy: number, r: number, points = 10) {
  let d = ''
  for (let i = 0; i < points * 2; i++) {
    const a = (i / (points * 2)) * Math.PI * 2 - Math.PI / 2
    const rr = i % 2 === 0 ? r : r * 0.45
    d += `${i === 0 ? 'M' : 'L'}${cx + Math.cos(a) * rr} ${cy + Math.sin(a) * rr}`
  }
  return d + 'Z'
}

export function ImpactBurst({ impact }: { impact: Impact }) {
  const k = impact.ms / DURATION
  if (k < 0 || k > 1) return null
  const size = SIZE[impact.power] * (0.5 + k * 0.9)
  const cx = impact.at.x
  const cy = -impact.at.y
  const fade = 1 - k
  return (
    <g className="zb-impact" opacity={fade}>
      {Array.from({ length: 8 }, (_, i) => {
        const a = (i / 8) * Math.PI * 2 + 0.3
        const r1 = size * 1.1
        const r2 = size * (1.6 + k * 0.8)
        return <path key={i} d={`M${cx + Math.cos(a) * r1} ${cy + Math.sin(a) * r1} L${cx + Math.cos(a) * r2} ${cy + Math.sin(a) * r2}`} className="zb-impact__line" />
      })}
      <path d={star(cx, cy, size)} className="zb-impact__star" />
      <path d={star(cx, cy, size * 0.5, 8)} className="zb-impact__core" />
      <text x={cx + size * 0.6} y={cy - size * 1.3} fontSize={SIZE[impact.power] * 0.9} className="zb-impact__word">
        {WORD[impact.power]}
      </text>
    </g>
  )
}

/** 야구공: 흰 공에 빨간 실밥 + 주황 꼬리 + 노란 빛 테두리 (하늘·잔디 위에서도 잘 보이게) */
export function Ball({ at, r, halo, trail }: { at: Point; r: number; halo: number; trail: Point[] }) {
  return (
    <g>
      {trail.map((p, i) => (
        <circle key={i} cx={p.x} cy={-p.y} r={r * (0.9 - i * 0.13)} className="zb-ball-trail" opacity={0.7 - i * 0.12} />
      ))}
      <circle cx={at.x} cy={-at.y} r={halo} className="zb-ball-halo" />
      <circle cx={at.x} cy={-at.y} r={r} className="zb-ball" />
      <path
        d={`M${at.x - r * 0.55} ${-at.y - r * 0.75} Q${at.x - r * 0.15} ${-at.y} ${at.x - r * 0.55} ${-at.y + r * 0.75} M${at.x + r * 0.55} ${-at.y - r * 0.75} Q${at.x + r * 0.15} ${-at.y} ${at.x + r * 0.55} ${-at.y + r * 0.75}`}
        className="zb-ball__stitch"
      />
    </g>
  )
}
