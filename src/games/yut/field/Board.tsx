import { CORNERS, NODE_XY, nodeOf } from '../rules/board'
import type { From, Move, Piece } from '../rules/moves'

// 윷판: 바깥 네모 + 대각선 두 줄, 칸 29개. 말은 사람 색 동그라미, 업힌 수는 숫자로.
// 옮길 수 있는 말은 깜빡이고, 누르면 고른 결과로 그 말을 옮긴다. 도착할 칸은 점선으로 미리 보여준다.

export const PLAYER_COLORS = ['#2563eb', '#e5484d', '#16a34a', '#d97706']

type Props = {
  pieces: Piece[][]
  /** 지금 고른 결과로 옮길 수 있는 것 (내 차례가 아니면 빈 배열) */
  moves: Move[]
  /** 이 플레이어 시점의 색을 진하게 */
  me: number
  lastTo: number | 'out' | null
  onPick: (from: From) => void
}

const onBoard = (p: Piece): p is Exclude<Piece, 'home' | 'out'> => p !== 'home' && p !== 'out'

const LINES = [
  // 바깥 네모
  'M30 30H270V270H30Z',
  // 대각선
  'M30 30L270 270',
  'M270 30L30 270',
]

export function Board({ pieces, moves, me, lastTo, onPick }: Props) {
  const movable = new Map(moves.filter((m) => m.from !== 'home').map((m) => [m.from as number, m]))
  const targets = moves.flatMap((m) => (m.to === 'out' ? [] : [nodeOf(m.to)]))
  return (
    <svg className="yt-board" viewBox="0 0 300 300" role="img" aria-label="윷판">
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
      {/* 도착 미리보기 */}
      {[...new Set(targets)].map((node) => (
        <circle key={`t${node}`} className="yt-target" cx={NODE_XY[node][0]} cy={NODE_XY[node][1]} r={16} />
      ))}
      {lastTo !== null && lastTo !== 'out' && (
        <circle className="yt-last" cx={NODE_XY[lastTo][0]} cy={NODE_XY[lastTo][1]} r={18} />
      )}
      {pieces.map((row, player) => {
        const groups = new Map<number, number>()
        for (const p of row) if (onBoard(p)) groups.set(nodeOf(p), (groups.get(nodeOf(p)) ?? 0) + 1)
        return [...groups].map(([node, count]) => {
          const [x, y] = NODE_XY[node]
          const canPick = player === me && movable.has(node)
          return (
            <g
              key={`${player}-${node}`}
              className={`yt-piece${canPick ? ' yt-piece--movable' : ''}`}
              onPointerDown={(e) => {
                if (!canPick) return
                e.preventDefault()
                onPick(node)
              }}
              role={canPick ? 'button' : undefined}
              aria-label={canPick ? `${count > 1 ? `업힌 말 ${count}개` : '말'} 옮기기` : undefined}
            >
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
    </svg>
  )
}
