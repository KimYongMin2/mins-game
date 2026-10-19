import { describe, expect, it } from 'vitest'
import type { RoundSummary } from './play/roundState'
import { EMPTY_RECORD, addGame, averageOf } from './records'

const game = (points: number, xCount = 0): RoundSummary => ({ shots: [], points, xCount })

describe('addGame', () => {
  it('첫 경기는 무조건 최고 기록', () => {
    const { record, newBest } = addGame(EMPTY_RECORD, game(72, 1))
    expect(newBest).toBe(true)
    expect(record).toEqual({ games: 1, totalPoints: 72, best: { points: 72, xCount: 1 } })
  })

  it('더 높은 점수면 갱신, 낮으면 유지', () => {
    let r = addGame(EMPTY_RECORD, game(80)).record
    const lower = addGame(r, game(75))
    expect(lower.newBest).toBe(false)
    expect(lower.record.best).toEqual({ points: 80, xCount: 0 })
    r = addGame(lower.record, game(91, 2)).record
    expect(r.best).toEqual({ points: 91, xCount: 2 })
  })

  it('같은 점수면 X가 많을 때만 갱신', () => {
    const r = addGame(EMPTY_RECORD, game(85, 1)).record
    expect(addGame(r, game(85, 1)).newBest).toBe(false)
    expect(addGame(r, game(85, 3)).newBest).toBe(true)
  })

  it('평균 점수', () => {
    expect(averageOf(EMPTY_RECORD)).toBeNull()
    let r = addGame(EMPTY_RECORD, game(80)).record
    r = addGame(r, game(90)).record
    expect(averageOf(r)).toBe(85)
  })
})
