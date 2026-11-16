import { describe, expect, it } from 'vitest'
import { type BattingLeaderRow, buildBoards } from './leaderboard'

const AT = '2026-10-20T10:00:00Z'

function row(id: string, over: Partial<BattingLeaderRow> = {}): BattingLeaderRow {
  return {
    playerId: id,
    nickname: id,
    games: 1,
    best: { points: 500, homeruns: 0, hits: 5, at: AT },
    mostHr: { homeruns: 0, points: 500, at: AT },
    ...over,
  }
}

const board = (rows: BattingLeaderRow[], key: string) => buildBoards(rows).find((b) => b.key === key)!.entries
const ids = (entries: { playerId: string }[]) => entries.map((e) => e.playerId)

describe('최고 점수', () => {
  it('점수 → 홈런 → 안타 이상 → 먼저 기록 순', () => {
    const rows = [
      row('a', { best: { points: 700, homeruns: 1, hits: 6, at: AT } }),
      row('b', { best: { points: 820, homeruns: 0, hits: 9, at: AT } }),
      row('c', { best: { points: 700, homeruns: 2, hits: 5, at: AT } }),
      row('d', { best: { points: 700, homeruns: 1, hits: 7, at: AT } }),
      row('e', { best: { points: 700, homeruns: 1, hits: 6, at: '2026-10-20T09:00:00Z' } }),
    ]
    const e = board(rows, 'best')
    expect(ids(e)).toEqual(['b', 'c', 'd', 'e', 'a'])
    expect(e[0]).toMatchObject({ rank: 1, display: '820점', detail: '홈런 0 · 안타 이상 9' })
  })

  it('모든 기준이 같으면 같은 등수', () => {
    const e = board([row('a'), row('b'), row('c', { best: { points: 100, homeruns: 0, hits: 1, at: AT } })], 'best')
    expect(e.map((x) => x.rank)).toEqual([1, 1, 3])
  })

  it('상위 10명까지만', () => {
    const rows = Array.from({ length: 12 }, (_, i) => row(`p${i}`, { best: { points: i * 10, homeruns: 0, hits: 1, at: AT } }))
    expect(board(rows, 'best')).toHaveLength(10)
  })
})

describe('한 경기 최다 홈런', () => {
  it('홈런 → 그 경기 점수 → 먼저 기록 순, 홈런 0개는 빠진다', () => {
    const rows = [
      row('a', { mostHr: { homeruns: 3, points: 600, at: AT } }),
      row('b', { mostHr: { homeruns: 4, points: 550, at: AT } }),
      row('c', { mostHr: { homeruns: 3, points: 640, at: AT } }),
      row('d'),
    ]
    const e = board(rows, 'mostHr')
    expect(ids(e)).toEqual(['b', 'c', 'a'])
    expect(e[0]).toMatchObject({ display: '홈런 4개', detail: '그 경기 550점' })
  })
})
