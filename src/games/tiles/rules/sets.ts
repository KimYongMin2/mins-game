// 줄(바닥에 놓인 타일 묶음) 판정. 줄은 3장 이상이고 둘 중 하나:
// - 같은 색 연속: 왼쪽부터 작은 숫자 → 큰 숫자로 한 칸씩 (예: 빨강 4·5·6). 3·5·4는 틀림. 1~13 안에서, 13 다음 1로 이어지지 않는다
// - 같은 숫자 다른 색 (색이 4개라 최대 4장). 색 순서는 상관없다
// 와일드는 놓인 자리의 숫자를 대신한다 (12·13·☺는 ☺가 14라 틀림, ☺·12·13은 됨).
import { COLORS, MAX_NUM, MIN_SET } from '../constants'
import { type TileId, colorOf, isWild, numOf } from './tiles'

export type SetKind = 'run' | 'group'

/** 놓인 순서대로 같은 색 연속이면 각 자리 숫자 */
function runNumbers(ids: readonly TileId[]): number[] | null {
  if (ids.length < MIN_SET || ids.length > MAX_NUM) return null
  const first = ids.findIndex((id) => !isWild(id))
  if (first < 0) return null
  const color = colorOf(ids[first])
  const start = numOf(ids[first]) - first
  if (start < 1 || start + ids.length - 1 > MAX_NUM) return null
  const ok = ids.every((id, i) => isWild(id) || (colorOf(id) === color && numOf(id) === start + i))
  return ok ? ids.map((_, i) => start + i) : null
}

/** 같은 숫자 다른 색이면 그 숫자 */
function groupNumber(ids: readonly TileId[]): number | null {
  const plain = ids.filter((id) => !isWild(id))
  if (ids.length < MIN_SET || ids.length > COLORS || plain.length === 0) return null
  const n = numOf(plain[0])
  if (plain.some((id) => numOf(id) !== n)) return null
  const colors = new Set(plain.map(colorOf))
  return colors.size === plain.length ? n : null
}

/** 올바른 줄이면 그 종류 (둘 다 되면 점수가 큰 쪽), 아니면 null */
export function setKind(ids: readonly TileId[]): SetKind | null {
  const run = runNumbers(ids)
  const group = groupNumber(ids)
  if (run && group !== null) return sum(run) >= group * ids.length ? 'run' : 'group'
  return run ? 'run' : group !== null ? 'group' : null
}

export function isValidSet(ids: readonly TileId[]): boolean {
  return setKind(ids) !== null
}

const sum = (ns: number[]) => ns.reduce((a, b) => a + b, 0)

/** 줄의 점수 (첫 등록 합). 와일드는 그 자리 숫자. 올바르지 않으면 0 */
export function setValue(ids: readonly TileId[]): number {
  const kind = setKind(ids)
  if (kind === 'run') return sum(runNumbers(ids)!)
  if (kind === 'group') return groupNumber(ids)! * ids.length
  return 0
}

/**
 * 순서 없는 타일 묶음을 올바른 줄로 놓는 순서 (봇이 줄을 만들 때 씀). 안 되면 null.
 * 연속이면 작은 숫자부터, 와일드는 빈 곳 → 남으면 위쪽 끝 → 13을 넘으면 아래쪽 끝
 */
export function orderSet(ids: readonly TileId[]): TileId[] | null {
  const plain = ids.filter((id) => !isWild(id)).sort((a, b) => numOf(a) - numOf(b))
  const wilds = ids.filter(isWild)
  const group = [...plain, ...wilds]
  if (groupNumber(group) !== null) return group
  if (plain.length === 0) return null
  const lo = numOf(plain[0])
  const span = numOf(plain[plain.length - 1]) - lo + 1
  const top = Math.min(MAX_NUM, lo + Math.max(span, ids.length) - 1)
  const start = top - ids.length + 1
  const left = [...wilds]
  const out = Array.from({ length: ids.length }, (_, i) => plain.find((id) => numOf(id) === start + i) ?? left.shift())
  // 같은 숫자가 두 장이면 한 장이 빠지므로 다 들어갔는지도 본다
  if (out.some((id) => id === undefined) || new Set(out).size !== ids.length) return null
  const run = out as TileId[]
  return isValidSet(run) ? run : null
}
