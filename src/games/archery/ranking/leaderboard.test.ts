import { describe, expect, it } from 'vitest'
import { type ArcheryLeaderRow, buildBoards } from './leaderboard'

function row(id: string, over: Partial<ArcheryLeaderRow> = {}): ArcheryLeaderRow {
  return {
    playerId: id,
    nickname: id,
    games: 1,
    avgPoints: 70,
    best: { points: 70, xCount: 0, tenCount: 0, at: '2026-10-19T10:00:00Z' },
    mostX: { xCount: 0, points: 70, at: '2026-10-19T10:00:00Z' },
    ...over,
  }
}

const board = (rows: ArcheryLeaderRow[], key: string) => buildBoards(rows).find((b) => b.key === key)!.entries
const ids = (entries: { playerId: string }[]) => entries.map((e) => e.playerId)

describe('최고 점수', () => {
  it('점수 → X → 10점 개수 → 먼저 기록 순', () => {
    const rows = [
      row('a', { best: { points: 88.4, xCount: 1, tenCount: 3, at: '2026-10-19T10:00:00Z' } }),
      row('b', { best: { points: 91.2, xCount: 0, tenCount: 2, at: '2026-10-19T10:00:00Z' } }),
      row('c', { best: { points: 88.4, xCount: 2, tenCount: 2, at: '2026-10-19T10:00:00Z' } }),
      row('d', { best: { points: 88.4, xCount: 1, tenCount: 4, at: '2026-10-19T10:00:00Z' } }),
      row('e', { best: { points: 88.4, xCount: 1, tenCount: 3, at: '2026-10-19T09:00:00Z' } }),
    ]
    const e = board(rows, 'best')
    expect(ids(e)).toEqual(['b', 'c', 'd', 'e', 'a'])
    expect(e.map((x) => x.rank)).toEqual([1, 2, 3, 4, 5])
    expect(e[0]).toMatchObject({ display: '91.2점', detail: 'X 0 · 10점 2' })
  })

  it('모든 기준이 같으면 같은 등수', () => {
    const same = { points: 80, xCount: 1, tenCount: 1, at: '2026-10-19T10:00:00Z' }
    const e = board([row('a', { best: same }), row('b', { best: same }), row('c')], 'best')
    expect(e.map((x) => x.rank)).toEqual([1, 1, 3])
  })
})

describe('평균 점수', () => {
  it('3경기 이상만, 높은 순', () => {
    const rows = [
      row('a', { games: 2, avgPoints: 99 }),
      row('b', { games: 3, avgPoints: 75.25 }),
      row('c', { games: 10, avgPoints: 82.4 }),
    ]
    const e = board(rows, 'average')
    expect(ids(e)).toEqual(['c', 'b'])
    expect(e[1]).toMatchObject({ display: '75.3점', detail: '3경기' })
  })
})

describe('한 경기 최다 X', () => {
  it('X → 그 경기 점수 → 먼저 기록, X가 없으면 빠진다', () => {
    const rows = [
      row('a', { mostX: { xCount: 2, points: 85, at: '2026-10-19T10:00:00Z' } }),
      row('b', { mostX: { xCount: 3, points: 70, at: '2026-10-19T10:00:00Z' } }),
      row('c', { mostX: { xCount: 2, points: 90, at: '2026-10-19T10:00:00Z' } }),
      row('d'),
    ]
    const e = board(rows, 'mostX')
    expect(ids(e)).toEqual(['b', 'c', 'a'])
    expect(e[0]).toMatchObject({ display: 'X 3개', detail: '그 경기 70.0점' })
  })
})

it('상위 10명만', () => {
  const rows = Array.from({ length: 15 }, (_, i) =>
    row(`p${i}`, { best: { points: 50 + i, xCount: 0, tenCount: 0, at: '2026-10-19T10:00:00Z' } }),
  )
  const e = board(rows, 'best')
  expect(e).toHaveLength(10)
  expect(e[0].playerId).toBe('p14')
})
