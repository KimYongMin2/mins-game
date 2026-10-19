import { describe, expect, it } from 'vitest'
import type { RoundSummary } from './play/roundState'
import { EMPTY_RECORD, addGame, averageOf } from './records'

const game = (points: number, xCount = 0, tenCount = xCount): RoundSummary => ({ shots: [], points, xCount, tenCount })

describe('addGame', () => {
  it('첫 경기는 무조건 최고 기록', () => {
    const { record, newBest } = addGame(EMPTY_RECORD, game(72, 1))
    expect(newBest).toBe(true)
    expect(record).toEqual({ games: 1, totalPoints: 72, best: { points: 72, xCount: 1, tenCount: 1 } })
  })

  it('더 높은 점수면 갱신, 낮으면 유지', () => {
    let r = addGame(EMPTY_RECORD, game(80)).record
    const lower = addGame(r, game(75))
    expect(lower.newBest).toBe(false)
    expect(lower.record.best).toEqual({ points: 80, xCount: 0, tenCount: 0 })
    r = addGame(lower.record, game(91, 2)).record
    expect(r.best).toEqual({ points: 91, xCount: 2, tenCount: 2 })
  })

  it('같은 점수면 X → 10점 개수로 비교, 모두 같으면 먼저 세운 기록 유지', () => {
    const r = addGame(EMPTY_RECORD, game(85.4, 1, 3)).record
    expect(addGame(r, game(85.4, 1, 3)).newBest).toBe(false)
    expect(addGame(r, game(85.4, 2, 2)).newBest).toBe(true)
    expect(addGame(r, game(85.4, 1, 4)).newBest).toBe(true)
    expect(addGame(r, game(85.3, 5, 5)).newBest).toBe(false)
  })

  it('소수점 누적 점수에 오차가 쌓이지 않는다', () => {
    let r = EMPTY_RECORD
    for (let i = 0; i < 10; i++) r = addGame(r, game(80.1)).record
    expect(r.totalPoints).toBe(801)
  })

  it('평균 점수', () => {
    expect(averageOf(EMPTY_RECORD)).toBeNull()
    let r = addGame(EMPTY_RECORD, game(80)).record
    r = addGame(r, game(90)).record
    expect(averageOf(r)).toBe(85)
  })
})
