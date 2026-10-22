import { describe, expect, it } from 'vitest'
import type { MatchSummary } from './play/matchState'
import { EMPTY_RECORD, addGame, soloAverage } from './records'

const game = (outcome: MatchSummary['outcome'], mode: MatchSummary['mode'] = 'bot', tries = 6): MatchSummary => ({
  mode,
  difficulty: 'hard',
  length: 4,
  outcome,
  tries,
  foeTries: mode === 'solo' ? 0 : tries,
})

describe('addGame', () => {
  it('봇전: 난이도별 승패와 연승', () => {
    let r = EMPTY_RECORD
    for (const o of ['win', 'win', 'draw', 'win'] as const) r = addGame(r, game(o))
    expect(r.hard).toEqual({ wins: 3, losses: 0, draws: 1, streak: 1, bestStreak: 2 })
    expect(r.normal).toEqual(EMPTY_RECORD.normal)
  })

  it('친구 대전은 따로 센다', () => {
    const r = addGame(addGame(EMPTY_RECORD, game('win', 'pvp')), game('draw', 'pvp'))
    expect(r.pvp).toEqual({ wins: 1, losses: 0, draws: 1 })
    expect(r.hard).toEqual(EMPTY_RECORD.hard)
  })

  it('혼자 하기: 숫자 개수별 최소 횟수와 평균 (못 맞힌 경기는 평균에서 뺌)', () => {
    let r = EMPTY_RECORD
    r = addGame(r, game('win', 'solo', 7))
    r = addGame(r, game('lose', 'solo', 20))
    r = addGame(r, game('win', 'solo', 5))
    expect(r.solo4).toEqual({ games: 3, solved: 2, solvedTries: 12, best: 5 })
    expect(soloAverage(r.solo4)).toBe(6)
    expect(r.solo3).toEqual(EMPTY_RECORD.solo3)
  })
})
