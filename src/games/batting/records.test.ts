import { describe, expect, it } from 'vitest'
import type { SessionSummary } from './play/session'
import { EMPTY_RECORD, addGame, averageOf } from './records'

const summary = (points: number, homeruns: number, hits: number, difficulty: 'normal' | 'hard' = 'normal'): SessionSummary => ({
  difficulty,
  hand: 'right',
  records: [],
  points,
  homeruns,
  hits,
})

describe('addGame', () => {
  it('난이도별로 경기 수·누적 점수·최고 기록을 쌓는다', () => {
    let r = EMPTY_RECORD
    ;({ record: r } = addGame(r, summary(20, 1, 4)))
    const second = addGame(r, summary(14, 0, 5))
    expect(second.newBest).toBe(false)
    r = second.record
    expect(r.normal).toEqual({ games: 2, totalPoints: 34, best: { points: 20, homeruns: 1, hits: 4 } })
    expect(averageOf(r.normal)).toBe(17)
    expect(r.hard.games).toBe(0)
  })

  it('어려움 기록은 따로', () => {
    const { record, newBest } = addGame(EMPTY_RECORD, summary(6, 0, 2, 'hard'))
    expect(newBest).toBe(true)
    expect(record.hard.best?.points).toBe(6)
    expect(record.normal.best).toBeNull()
  })

  it('같은 점수면 홈런이 많아야 갱신', () => {
    const { record } = addGame(EMPTY_RECORD, summary(20, 1, 4))
    expect(addGame(record, summary(20, 2, 2)).newBest).toBe(true)
    expect(addGame(record, summary(20, 1, 4)).newBest).toBe(false)
  })
})
