// 한 차례에 내려놓은 것 검사. 차례인 사람은 바닥을 마음대로 쪼개고 다시 짜서 손패를 끼워 넣고,
// 끝낼 때 바닥 전체(newTable)를 낸다. 심판은 처음 바닥(oldTable)·손패와 비교한다.
// - 처음 바닥의 타일은 하나도 빠지면 안 된다 (손으로 가져갈 수 없음)
// - 손패에서 1장 이상 내려놓아야 한다 (아니면 1장 가져오기)
// - 바닥의 모든 줄이 올바라야 한다
// - 첫 등록 전: 처음 바닥의 줄은 건드릴 수 없고, 새 줄은 내 타일로만, 합 FIRST_MELD 이상
import { FIRST_MELD } from '../constants'
import { isValidSet, setValue } from './sets'
import type { TileId } from './tiles'

export type Table = TileId[][]

export type PlayProblem =
  | 'nothing'
  /** 바닥에 없는 타일·손패에 없는 타일을 씀 / 같은 타일 두 번 */
  | 'bad-tiles'
  /** 처음 바닥 타일을 가져감 */
  | 'took-tile'
  | 'bad-set'
  /** 첫 등록 전에 바닥 줄을 건드림 */
  | 'touched'
  /** 첫 등록 합이 모자람 */
  | 'too-small'

export type PlayCheck = { ok: true; placed: TileId[] } | { ok: false; problem: PlayProblem }

const sameSet = (a: readonly TileId[], b: readonly TileId[]) => a.length === b.length && [...a].sort().join() === [...b].sort().join()

export function checkPlay(opts: { oldTable: Table; hand: readonly TileId[]; newTable: Table; melded: boolean }): PlayCheck {
  const { oldTable, hand, newTable, melded } = opts
  const onTable = new Set(oldTable.flat())
  const inHand = new Set(hand)
  const seen = new Set<TileId>()
  const placed: TileId[] = []
  for (const id of newTable.flat()) {
    if (seen.has(id)) return { ok: false, problem: 'bad-tiles' }
    seen.add(id)
    if (onTable.has(id)) continue
    if (!inHand.has(id)) return { ok: false, problem: 'bad-tiles' }
    placed.push(id)
  }
  if ([...onTable].some((id) => !seen.has(id))) return { ok: false, problem: 'took-tile' }
  if (placed.length === 0) return { ok: false, problem: 'nothing' }
  const sets = newTable.filter((s) => s.length > 0)
  if (sets.some((s) => !isValidSet(s))) return { ok: false, problem: 'bad-set' }
  if (!melded) {
    // 처음 바닥 줄은 그대로 남아 있어야 하고, 나머지 줄은 내 타일로만
    const left = [...sets]
    for (const old of oldTable) {
      const i = left.findIndex((s) => sameSet(s, old))
      if (i < 0) return { ok: false, problem: 'touched' }
      left.splice(i, 1)
    }
    if (left.some((s) => s.some((id) => onTable.has(id)))) return { ok: false, problem: 'touched' }
    if (left.reduce((sum, s) => sum + setValue(s), 0) < FIRST_MELD) return { ok: false, problem: 'too-small' }
  }
  return { ok: true, placed }
}

export const PROBLEM_TEXT: Record<PlayProblem, string> = {
  nothing: '내 타일을 1장 이상 내려놓아야 해요',
  'bad-tiles': '잘못된 타일이 있어요',
  'took-tile': '바닥 타일은 가져갈 수 없어요',
  'bad-set': '틀린 줄이 있어요 (빨간 줄)',
  touched: '첫 등록 전엔 바닥 줄을 건드릴 수 없어요',
  'too-small': `첫 등록은 내 타일로 합 ${FIRST_MELD} 이상이어야 해요`,
}
