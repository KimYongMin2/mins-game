import { describe, expect, it } from 'vitest'
import { tileId } from '../rules/tiles'
import { checkDraft, createDraft, draftReducer, placedOf, rackOf } from './draft'

const r = (n: number, copy = 0) => tileId(0, n, copy)

describe('작업판', () => {
  const base = [[r(4), r(5), r(6), r(7)]]
  const hand = [r(3), r(5, 1), tileId(1, 9)]

  it('바닥을 쪼개고 손패를 끼워 낸다', () => {
    let d = createDraft(base, hand, true)
    // 빨강 5·6·7을 골라 새 줄로 → 4 혼자 남음(틀림)
    for (const t of [r(5), r(6), r(7)]) d = draftReducer(d, { type: 'toggle', tile: t })
    d = draftReducer(d, { type: 'place', set: -1 })
    expect(d.table).toEqual([[r(4)], [r(5), r(6), r(7)]])
    expect(checkDraft(d)).toEqual({ ok: false, problem: 'nothing' })
    // 손의 3은 4 앞에, 5는 4 뒤에 (순서가 맞아야 함)
    d = draftReducer(d, { type: 'toggle', tile: r(3) })
    d = draftReducer(d, { type: 'place', set: 0, at: 0 })
    d = draftReducer(d, { type: 'toggle', tile: r(5, 1) })
    d = draftReducer(d, { type: 'place', set: 0 })
    expect(d.table[0]).toEqual([r(3), r(4), r(5, 1)])
    expect(checkDraft(d)).toEqual({ ok: true, placed: [r(3), r(5, 1)] })
    expect(rackOf(d)).toEqual([tileId(1, 9)])
    expect(placedOf(d)).toEqual([r(3), r(5, 1)])
  })

  it('같은 줄 안에서 자리 옮기기', () => {
    let d = createDraft([[r(4), r(6), r(5)]], [], true)
    d = draftReducer(d, { type: 'toggle', tile: r(5) })
    d = draftReducer(d, { type: 'place', set: 0, at: 1 })
    expect(d.table).toEqual([[r(4), r(5), r(6)]])
  })

  it('내 타일만 손으로 돌아오고, 되돌리기는 처음 바닥으로', () => {
    let d = createDraft(base, hand, true)
    d = draftReducer(d, { type: 'toggle', tile: r(3) })
    d = draftReducer(d, { type: 'place', set: 0 })
    d = draftReducer(d, { type: 'toggle', tile: r(3) })
    d = draftReducer(d, { type: 'toggle', tile: r(4) })
    d = draftReducer(d, { type: 'unplace' })
    expect(d.table).toEqual([[r(4), r(5), r(6), r(7)]])
    d = draftReducer(d, { type: 'toggle', tile: r(7) })
    d = draftReducer(d, { type: 'place', set: -1 })
    d = draftReducer(d, { type: 'undo' })
    expect(d.table).toEqual(base)
    expect(d.selected).toEqual([])
  })
})
