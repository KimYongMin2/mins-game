import type { PointerEvent } from 'react'
import { CORNERS, NODE_XY, nodeOf } from '../rules/board'
import type { From, Piece } from '../rules/moves'

// 윷판: 바깥 네모 + 대각선 두 줄, 칸 29개. 말은 사람 색 동그라미, 업힌 수는 숫자로.
// 두 번에 나눠 옮긴다: 깜빡이는 말을 눌러 고르면 갈 칸이 점선으로 뜨고, 그 칸을 눌러야 옮긴다.
// 다른 데를 누르면 고른 게 풀린다 (말을 잘못 눌러 바로 옮겨지지 않게).

export const PLAYER_COLORS = ['#2563eb', '#e5484d', '#16a34a', '#d97706']

type Props = {
  pieces: Piece[][]
  /** 지금 고른 결과로 옮길 수 있는 내 말 칸 (내 차례가 아니면 빈 배열) */
  movable: number[]
  /** 고른 말 (새 말이면 'home') */
  selected: From | null
  /** 고른 말이 갈 곳 ('out'이면 출발점에 '나가기'로 표시) */
  target: number | 'out' | null
  /** 이 플레이어 시점의 색을 진하게 */
  me: number
  lastTo: number | 'out' | null
  onSelect: (from: From | null) => void
  onConfirm: () => void
}

const onBoard = (p: Piece): p is Exclude<Piece, 'home' | 'out'> => p !== 'home' && p !== 'out'

const LINES = [
  // 바깥 네모
  'M30 30H270V270H30Z',
  // 대각선
  'M30 30L270 270',
  'M270 30L30 270',
]

export function Board({ pieces, movable, selected, target, me, lastTo, onSelect, onConfirm }: Props) {
  const targetNode = target === 'out' ? 0 : target
  // 갈 칸을 누르면 옮기고, 움직일 수 있는 말을 누르면 그 말을 고르고(다시 누르면 풀기), 나머지는 풀기
  function tap(node: number | null) {
    if (node !== null && node === targetNode) onConfirm()
    else if (node !== null && movable.includes(node)) onSelect(selected === node ? null : node)
    else onSelect(null)
  }
  // 칸 가까이 누르면 그 칸으로 친다 (작은 칸도 누르기 쉽게)
  function nodeNear(e: PointerEvent<SVGSVGElement>): number | null {
    const svg = e.currentTarget
    const pt = svg.createSVGPoint()
    pt.x = e.clientX
    pt.y = e.clientY
    const ctm = svg.getScreenCTM()
    if (!ctm) return null
    const { x, y } = pt.matrixTransform(ctm.inverse())
    let best: number | null = null
    let bestD = 22
    for (const [n, [nx, ny]] of Object.entries(NODE_XY)) {
      const d = Math.hypot(nx - x, ny - y)
      if (d < bestD) {
        bestD = d
        best = Number(n)
      }
    }
    return best
  }
  return (
    <svg
      className="yt-board"
      viewBox="0 0 300 300"
      role="img"
      aria-label="윷판"
      onPointerDown={(e) => {
        e.preventDefault()
        tap(nodeNear(e))
      }}
    >
      {LINES.map((d) => (
        <path key={d} className="yt-board__line" d={d} />
      ))}
      {Object.entries(NODE_XY).map(([n, [x, y]]) => {
        const node = Number(n)
        const corner = CORNERS.includes(node)
        return <circle key={n} className={`yt-node${corner ? ' yt-node--corner' : ''}`} cx={x} cy={y} r={corner ? 13 : 8} />
      })}
      <text className="yt-board__label" x={270} y={296}>
        출발 · 끝
      </text>
      {lastTo !== null && lastTo !== 'out' && (
        <circle className="yt-last" cx={NODE_XY[lastTo][0]} cy={NODE_XY[lastTo][1]} r={18} />
      )}
      {pieces.map((row, player) => {
        const groups = new Map<number, number>()
        for (const p of row) if (onBoard(p)) groups.set(nodeOf(p), (groups.get(nodeOf(p)) ?? 0) + 1)
        return [...groups].map(([node, count]) => {
          const [x, y] = NODE_XY[node]
          const canPick = player === me && movable.includes(node)
          const picked = canPick && selected === node
          const cls = picked ? ' yt-piece--picked' : canPick && selected === null ? ' yt-piece--movable' : canPick ? ' yt-piece--can' : ''
          return (
            <g key={`${player}-${node}`} className={`yt-piece${cls}`}>
              <circle cx={x} cy={y} r={canPick ? 14 : 12} fill={PLAYER_COLORS[player]} />
              {count > 1 && (
                <text x={x} y={y + 5}>
                  {count}
                </text>
              )}
            </g>
          )
        })
      })}
      {/* 갈 칸: 말 위에 그려서 잡을 칸도 잘 보이게 */}
      {targetNode !== null && (
        <g className="yt-target">
          <circle cx={NODE_XY[targetNode][0]} cy={NODE_XY[targetNode][1]} r={18} />
          <text x={NODE_XY[targetNode][0]} y={NODE_XY[targetNode][1] - 24}>
            {target === 'out' ? '나가기' : '여기로'}
          </text>
        </g>
      )}
    </svg>
  )
}
