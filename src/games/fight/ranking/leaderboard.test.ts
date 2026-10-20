import { describe, expect, it } from 'vitest'
import { type FightLeaderRow, buildBoards } from './leaderboard'
import { toGameRow } from './online'

function row(id: string, over: Partial<FightLeaderRow> = {}): FightLeaderRow {
  return { playerId: id, nickname: id, wins: 3, losses: 2, draws: 0, bestStreak: 1, bestStreakAt: '2026-10-20T10:00:00Z', ...over }
}

const board = (rows: FightLeaderRow[], key: string) => buildBoards(rows).find((b) => b.key === key)!.entries
const ids = (e: { playerId: string }[]) => e.map((x) => x.playerId)

describe('승률', () => {
  it('승+패 5경기 이상만, 승률 → 승 수 순 (무승부 제외)', () => {
    const rows = [
      row('a', { wins: 4, losses: 0 }), // 4경기라 빠짐
      row('b', { wins: 4, losses: 1, draws: 3 }),
      row('c', { wins: 8, losses: 2 }),
      row('d', { wins: 3, losses: 2 }),
    ]
    const e = board(rows, 'winRate')
    expect(ids(e)).toEqual(['c', 'b', 'd'])
    expect(e[1]).toMatchObject({ display: '80%', detail: '4승 1패 3무' })
  })
})

describe('최다 연승', () => {
  it('연승 → 먼저 기록 순, 0연승은 빠짐', () => {
    const rows = [
      row('a', { bestStreak: 4, bestStreakAt: '2026-10-20T11:00:00Z' }),
      row('b', { bestStreak: 4, bestStreakAt: '2026-10-20T09:00:00Z' }),
      row('c', { bestStreak: 6 }),
      row('d', { bestStreak: 0, bestStreakAt: null }),
    ]
    const e = board(rows, 'streak')
    expect(ids(e)).toEqual(['c', 'b', 'a'])
    expect(e[0].display).toBe('6연승')
  })
})

describe('toGameRow', () => {
  it('이긴 경기만 연승을 남긴다', () => {
    const s = { mode: 'bot' as const, difficulty: 'hard' as const, turns: 9, life: [1, 0] as const, strikes: 3 }
    expect(toGameRow({ ...s, outcome: 'win' }, 3, ' 민 ', 'x')).toEqual({
      id: 'x',
      nickname: '민',
      difficulty: 'hard',
      outcome: 'win',
      turns: 9,
      win_streak: 3,
    })
    expect(toGameRow({ ...s, outcome: 'lose' }, 0, '민', 'y').win_streak).toBe(0)
  })
})
