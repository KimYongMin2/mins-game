// 만화풍 그림에 쓰는 색과 모양 계산 (여러 게임이 같이 씀).

export const TOON_OUTLINE = '#1f2937'
export const TOON_SKIN = '#f6c7a0'

/** 뾰족한 별(번쩍 효과) 모양 경로. inner = 안쪽 꼭짓점 비율 */
export function starPath(cx: number, cy: number, r: number, points = 10, inner = 0.45): string {
  let d = ''
  for (let i = 0; i < points * 2; i++) {
    const a = (i / (points * 2)) * Math.PI * 2 - Math.PI / 2
    const rr = i % 2 === 0 ? r : r * inner
    d += `${i === 0 ? 'M' : 'L'}${cx + Math.cos(a) * rr} ${cy + Math.sin(a) * rr}`
  }
  return d + 'Z'
}
