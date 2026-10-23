import { useMemo } from 'react'
import { SIZE } from '../constants'
import { BLACK, type Board as BoardCells, EMPTY, isForbidden, xyOf } from '../rules/renju'

type Props = {
  board: BoardCells
  /** 마지막 수 (점 표시) */
  last: number | null
  /** 골라 둔 자리 (반투명 돌) */
  selected: number | null
  /** 미리 보기 돌 색 */
  myStone: number
  /** 흑 금수 자리 ✕ 표시 (내가 흑일 때) */
  showForbidden: boolean
  /** 이긴 다섯 줄 */
  line: number[]
  onPoint: (pos: number) => void
}

const U = 10
const PAD = 7
const VIEW = PAD * 2 + U * (SIZE - 1)
const c = (i: number) => PAD + i * U
/** 화점 (판의 점) */
const STARS = [3, 7, 11].flatMap((y) => [3, 7, 11].map((x) => [x, y]))

/** 오목판. 누르면 가장 가까운 교차점을 onPoint로 */
export function Board({ board, last, selected, myStone, showForbidden, line, onPoint }: Props) {
  const forbidden = useMemo(
    () => (showForbidden ? board.flatMap((cell, pos) => (cell === EMPTY && isForbidden(board, pos) ? [pos] : [])) : []),
    [board, showForbidden],
  )

  const down = (e: React.PointerEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const scale = rect.width / VIEW
    const x = Math.round(((e.clientX - rect.left) / scale - PAD) / U)
    const y = Math.round(((e.clientY - rect.top) / scale - PAD) / U)
    if (x >= 0 && x < SIZE && y >= 0 && y < SIZE) onPoint(y * SIZE + x)
  }

  const stone = (pos: number, color: number, extra = '') => {
    const [x, y] = xyOf(pos)
    return <circle key={`s${pos}`} className={`om-stone om-stone--${color === BLACK ? 'black' : 'white'}${extra}`} cx={c(x)} cy={c(y)} r={U * 0.44} />
  }

  const ends = line.length ? [xyOf(line[0]), xyOf(line[line.length - 1])] : null

  return (
    <svg className="om-board" viewBox={`0 0 ${VIEW} ${VIEW}`} onPointerDown={down} role="grid" aria-label="오목판">
      <rect className="om-board__bg" x={0} y={0} width={VIEW} height={VIEW} rx={2} />
      {Array.from({ length: SIZE }, (_, i) => (
        <g key={i} className="om-board__line">
          <line x1={c(0)} y1={c(i)} x2={c(SIZE - 1)} y2={c(i)} />
          <line x1={c(i)} y1={c(0)} x2={c(i)} y2={c(SIZE - 1)} />
        </g>
      ))}
      {STARS.map(([x, y]) => (
        <circle key={`${x}-${y}`} className="om-board__star" cx={c(x)} cy={c(y)} r={1.1} />
      ))}
      {forbidden.map((pos) => {
        const [x, y] = xyOf(pos)
        const d = U * 0.18
        return (
          <path
            key={`f${pos}`}
            className="om-forbidden"
            d={`M${c(x) - d} ${c(y) - d}L${c(x) + d} ${c(y) + d}M${c(x) + d} ${c(y) - d}L${c(x) - d} ${c(y) + d}`}
          />
        )
      })}
      {board.map((cell, pos) => (cell === EMPTY ? null : stone(pos, cell)))}
      {selected !== null && board[selected] === EMPTY && stone(selected, myStone, ' om-stone--ghost')}
      {last !== null && (
        <circle className="om-last" cx={c(xyOf(last)[0])} cy={c(xyOf(last)[1])} r={U * 0.13} />
      )}
      {ends && <line className="om-winline" x1={c(ends[0][0])} y1={c(ends[0][1])} x2={c(ends[1][0])} y2={c(ends[1][1])} />}
    </svg>
  )
}
