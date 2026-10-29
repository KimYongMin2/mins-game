// 내 차례에 바닥을 다시 짜는 동안의 작업판 (내 기기에만 있음). 끝내기를 누르면 table을 심판에게 낸다.
// 타일을 눌러 고르고(여러 장, 누른 순서대로) → 줄 안의 끼울 자리를 누르면 거기로, [새 줄]이면 새 줄로,
// 손패 칸을 누르면 손으로(내 타일만). 연속 줄은 순서가 맞아야 하므로 자리를 골라 끼운다.
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
  /** 고른 타일을 그 줄의 at번째 자리 앞에 (at이 없으면 맨 뒤, set이 -1이면 새 줄). at은 고른 타일을 빼기 전 기준 */
  | { type: 'place'; set: number; at?: number }
  /** 고른 타일 중 내 것을 손으로 */
  | { type: 'unplace' }
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

export function draftReducer(d: Draft, a: DraftAction): Draft {
  switch (a.type) {
    case 'reset':
      return createDraft(a.base, a.hand, a.melded)
    case 'toggle':
      return { ...d, selected: d.selected.includes(a.tile) ? d.selected.filter((id) => id !== a.tile) : [...d.selected, a.tile] }
    case 'place': {
      if (d.selected.length === 0) return d
      // 줄 번호·자리는 고른 타일을 빼기 전 기준
      const stripped = without(d.table, d.selected)
      const insert = (i: number) => {
        const before = d.table[i].slice(0, a.at ?? d.table[i].length).filter((id) => !d.selected.includes(id)).length
        const s = stripped[i]
        return [...s.slice(0, before), ...d.selected, ...s.slice(before)]
      }
      const table =
        a.set >= 0 && a.set < stripped.length ? stripped.map((s, i) => (i === a.set ? insert(i) : s)) : [...stripped, [...d.selected]]
      return { ...d, table: clean(table), selected: [] }
    }
    case 'unplace': {
      const mine = d.selected.filter((id) => d.hand.includes(id))
      if (mine.length === 0) return { ...d, selected: [] }
      return { ...d, table: clean(without(d.table, mine)), selected: [] }
    }
    case 'undo':
      return createDraft(d.base, d.hand, d.melded)
  }
}
