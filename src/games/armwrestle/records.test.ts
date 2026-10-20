import { describe, expect, it } from 'vitest'
import type { MatchSummary } from './play/matchState'
import { EMPTY_RECORD, addGame } from './records'

const game = (outcome: MatchSummary['outcome'], over: Partial<MatchSummary> = {}): MatchSummary => ({
  mode: 'bot',
  event: 'timing',
  difficulty: 'hard',
  outcome,
  wins: outcome === 'win' ? [2, 1] : [0, 2],
  taps: 0,
  perfects: 3,
  ...over,
})

describe('addGame', () => {
  it('종목·난이도별로 승패와 연승을 센다', () => {
    let r = EMPTY_RECORD
    for (const o of ['win', 'win', 'lose', 'win'] as const) r = addGame(r, game(o))
    expect(r.timing.hard).toEqual({ wins: 3, losses: 1, streak: 1, bestStreak: 2 })
    expect(r.timing.normal).toEqual(EMPTY_RECORD.timing.normal)
    expect(r.mash).toEqual(EMPTY_RECORD.mash)
  })

  it('친구 대전은 따로 센다', () => {
    const r = addGame(addGame(EMPTY_RECORD, game('win', { mode: 'pvp' })), game('lose', { mode: 'pvp', event: 'mash' }))
    expect(r.pvp).toEqual({ wins: 1, losses: 1 })
    expect(r.timing).toEqual(EMPTY_RECORD.timing)
  })
})
