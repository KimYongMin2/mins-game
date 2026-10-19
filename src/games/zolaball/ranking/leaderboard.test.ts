import { describe, expect, it } from 'vitest'
import { type BoardKey, type LeaderRow, buildBoards } from './leaderboard'

function row(id: string, over: Partial<LeaderRow>): LeaderRow {
  return {
    playerId: id,
    nickname: id,
    games: 0,
    wins: 0,
    losses: 0,
    draws: 0,
    atBats: 0,
    hits: 0,
    homeruns: 0,
    rbi: 0,
    bestRbi: 0,
    outsPitched: 0,
    runsAllowed: 0,
    ...over,
  }
}

function board(rows: LeaderRow[], key: BoardKey, limit?: number) {
  return buildBoards(rows, limit).find((b) => b.key === key)!.entries
}

describe('승률', () => {
  it('3경기 미만은 빠지고, 무승부는 승률 계산에서 제외', () => {
    const rows = [
      row('a', { games: 2, wins: 2 }),
      row('b', { games: 3, wins: 2, losses: 1 }),
      row('c', { games: 4, wins: 1, losses: 1, draws: 2 }),
    ]
    const e = board(rows, 'winRate')
    expect(e.map((x) => x.playerId)).toEqual(['b', 'c'])
    expect(e[0]).toMatchObject({ rank: 1, display: '.667', detail: '2승 1패 0무' })
    expect(e[1].display).toBe('.500')
  })

  it('전부 무승부면 순위에 오르지 않는다', () => {
    expect(board([row('a', { games: 3, draws: 3 })], 'winRate')).toEqual([])
  })
})

describe('타율', () => {
  it('10타수 이상만, 높은 순', () => {
    const rows = [
      row('a', { atBats: 9, hits: 9 }),
      row('b', { atBats: 10, hits: 3 }),
      row('c', { atBats: 20, hits: 8 }),
    ]
    const e = board(rows, 'battingAvg')
    expect(e.map((x) => [x.playerId, x.display])).toEqual([
      ['c', '.400'],
      ['b', '.300'],
    ])
  })
})

describe('경기당 타점과 최다 타점', () => {
  it('경기당 타점은 3경기 이상, 최다 타점은 1경기부터', () => {
    const rows = [row('a', { games: 2, rbi: 10, bestRbi: 7 }), row('b', { games: 4, rbi: 6, bestRbi: 3 })]
    expect(board(rows, 'rbiPerGame').map((x) => [x.playerId, x.display])).toEqual([['b', '1.50']])
    expect(board(rows, 'bestRbi').map((x) => [x.playerId, x.display])).toEqual([
      ['a', '7타점'],
      ['b', '3타점'],
    ])
  })
})

describe('평균자책점', () => {
  it('6이닝(18아웃) 이상, 낮을수록 위', () => {
    const rows = [
      row('a', { outsPitched: 17, runsAllowed: 0 }),
      row('b', { outsPitched: 18, runsAllowed: 4 }),
      row('c', { outsPitched: 27, runsAllowed: 3 }),
    ]
    const e = board(rows, 'era')
    expect(e.map((x) => [x.playerId, x.display, x.detail])).toEqual([
      ['c', '1.00', '9이닝 3실점'],
      ['b', '2.00', '6이닝 4실점'],
    ])
  })
})

describe('등수', () => {
  it('같은 값은 같은 등수, 다음은 건너뛴다 (1, 1, 3)', () => {
    const rows = [
      row('a', { games: 1, bestRbi: 5 }),
      row('b', { games: 1, bestRbi: 5 }),
      row('c', { games: 1, bestRbi: 2 }),
    ]
    expect(board(rows, 'bestRbi').map((x) => x.rank)).toEqual([1, 1, 3])
  })

  it('상위 N명만', () => {
    const rows = Array.from({ length: 15 }, (_, i) => row(`p${i}`, { games: 1, bestRbi: i }))
    const e = board(rows, 'bestRbi', 10)
    expect(e).toHaveLength(10)
    expect(e[0].playerId).toBe('p14')
  })
})
