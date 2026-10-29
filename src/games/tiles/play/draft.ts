// 내 차례에 바닥을 다시 짜는 동안의 작업판 (내 기기에만 있음). 끝내기를 누르면 table을 심판에게 낸다.
// 타일을 끌어 줄 안 원하는 자리·빈 바닥(새 줄)·손패 칸(내 타일만)에 놓는다. 눌러서 여러 장 고른 뒤 끌면 같이 움직인다.
// 고른 채로 줄을 누르면 맨 뒤, [새 줄]이면 새 줄로. 연속 줄은 순서가 맞아야 한다.
import { isValidSet } from '../rules/sets'
import { checkPlay, type PlayCheck, type Table } from '../rules/turn'
import type { TileId } from '../rules/tiles'

export type Draft = {
  /** 차례가 시작될 때 바닥과 손패 */
  base: Table
  hand: TileId[]
  melded: boolean
  /** 지금 짜고 있는 바닥 */
  table: Table
  selected: TileId[]
}

export type DraftAction =
  | { type: 'reset'; base: Table; hand: TileId[]; melded: boolean }
  | { type: 'toggle'; tile: TileId }
  /**
   * 타일(없으면 고른 타일)을 그 줄의 at번째 자리 앞에 (at이 없으면 맨 뒤, set이 -1이면 새 줄).
   * at은 옮길 타일을 빼기 전 기준
   */
  | { type: 'place'; set: number; at?: number; tiles?: TileId[] }
  /** 타일(없으면 고른 타일) 중 내 것을 손으로 */
  | { type: 'unplace'; tiles?: TileId[] }
  | { type: 'undo' }

export function createDraft(base: Table, hand: TileId[], melded: boolean): Draft {
  return { base, hand, melded, table: base.map((s) => [...s]), selected: [] }
}

/** 아직 손에 있는 타일 (바닥에 안 올린 것) */
export function rackOf(d: Draft): TileId[] {
  const used = new Set(d.table.flat())
  return d.hand.filter((id) => !used.has(id))
}

/** 바닥에 올린 내 타일 */
export function placedOf(d: Draft): TileId[] {
  const used = new Set(d.table.flat())
  return d.hand.filter((id) => used.has(id))
}

export function checkDraft(d: Draft): PlayCheck {
  return checkPlay({ oldTable: d.base, hand: d.hand, newTable: d.table, melded: d.melded })
}

const without = (table: Table, ids: readonly TileId[]) => table.map((s) => s.filter((id) => !ids.includes(id)))
const clean = (table: Table) => table.filter((s) => s.length > 0)

/**
 * 줄 가운데에 끼웠는데 합친 줄이 틀리면, 끼운 자리에서 둘로 나눠 양쪽이 다 맞는 쪽으로 끊는다.
 * 예: 3·4·5·6·7·8의 5와 6 사이에 6 → 3·4·5·6 / 6·7·8. 어느 쪽으로도 안 되면 그대로 (빨간 줄)
 */
function splitIfNeeded(left: TileId[], moving: readonly TileId[], right: TileId[]): Table {
  const whole = [...left, ...moving, ...right]
  if (left.length === 0 || right.length === 0 || isValidSet(whole)) return [whole]
  for (const parts of [
    [[...left, ...moving], right],
    [left, [...moving, ...right]],
  ]) {
    if (parts.every(isValidSet)) return parts
  }
  return [whole]
}

export function draftReducer(d: Draft, a: DraftAction): Draft {
  switch (a.type) {
    case 'reset':
      return createDraft(a.base, a.hand, a.melded)
    case 'toggle':
      return { ...d, selected: d.selected.includes(a.tile) ? d.selected.filter((id) => id !== a.tile) : [...d.selected, a.tile] }
    case 'place': {
      const moving = a.tiles ?? d.selected
      if (moving.length === 0) return d
      // 줄 번호·자리는 옮길 타일을 빼기 전 기준
      const stripped = without(d.table, moving)
      const insert = (i: number): Table => {
        const before = d.table[i].slice(0, a.at ?? d.table[i].length).filter((id) => !moving.includes(id)).length
        const s = stripped[i]
        return splitIfNeeded(s.slice(0, before), moving, s.slice(before))
      }
      const table =
        a.set >= 0 && a.set < stripped.length ? stripped.flatMap((s, i) => (i === a.set ? insert(i) : [s])) : [...stripped, [...moving]]
      return { ...d, table: clean(table), selected: [] }
    }
    case 'unplace': {
      const mine = (a.tiles ?? d.selected).filter((id) => d.hand.includes(id))
      if (mine.length === 0) return { ...d, selected: [] }
      return { ...d, table: clean(without(d.table, mine)), selected: [] }
    }
    case 'undo':
      return createDraft(d.base, d.hand, d.melded)
  }
}
