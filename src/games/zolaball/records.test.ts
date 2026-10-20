import { describe, expect, it } from 'vitest'
import type { RecordStore } from '../../shared/storage/records'
import type { MatchSummary } from './match/matchState'
import { EMPTY_RECORD, addMatch, formatAverage, formatEra, formatInnings, loadRecord, saveRecord } from './records'

function summary(over: Partial<MatchSummary>): MatchSummary {
  return {
    config: { difficulty: 'normal', userSide: 'away' },
    mode: 'bot',
    outcome: 'win',
    userRuns: 3,
    botRuns: 1,
    linescore: { away: [1, 2, 0], home: [0, 1, 0] },
    userStats: { atBats: 9, hits: 4, homeruns: 1, strikeouts: 2, walks: 1, rbi: 3 },
    userPitching: { outs: 9, runsAllowed: 2 },
    ...over,
  }
}

describe('addMatch', () => {
  it('친구 대전은 승패무만 따로 세고 봇전 기록·타격 기록에 섞지 않는다', () => {
    let r = addMatch(EMPTY_RECORD, summary({ mode: 'pvp' }))
    r = addMatch(r, summary({ mode: 'pvp', outcome: 'lose' }))
    expect(r.pvp).toEqual({ wins: 1, losses: 1, draws: 0 })
    expect(r.normal).toEqual(EMPTY_RECORD.normal)
    expect([r.atBats, r.homeruns]).toEqual([0, 0])
  })

  it('난이도별 승패무와 타격 기록을 더한다', () => {
    let r = addMatch(EMPTY_RECORD, summary({}))
    r = addMatch(r, summary({ outcome: 'lose', config: { difficulty: 'hard', userSide: 'home' } }))
    r = addMatch(r, summary({ outcome: 'draw' }))
    expect(r.normal).toEqual({ wins: 1, losses: 0, draws: 1 })
    expect(r.hard).toEqual({ wins: 0, losses: 1, draws: 0 })
    expect([r.atBats, r.hits, r.homeruns]).toEqual([27, 12, 3])
    expect([r.rbi, r.outsPitched, r.runsAllowed]).toEqual([9, 27, 6])
  })

  it('원래 기록은 바꾸지 않는다', () => {
    addMatch(EMPTY_RECORD, summary({}))
    expect(EMPTY_RECORD.normal.wins).toBe(0)
  })
})

describe('formatAverage', () => {
  it.each([
    [0, 0, '-'],
    [1, 3, '.333'],
    [0, 5, '.000'],
    [4, 4, '1.000'],
  ])('%i안타 / %i타수 → %s', (h, ab, text) => {
    expect(formatAverage(h, ab)).toBe(text)
  })
})

describe('평균자책점·이닝 표기', () => {
  it.each([
    [2, 9, '2.00'],
    [1, 18, '0.50'],
    [5, 7, '6.43'],
    [3, 0, '-'],
  ])('%i실점 / %i아웃 → %s', (runs, outs, text) => {
    expect(formatEra(runs, outs)).toBe(text)
  })

  it.each([
    [0, '0'],
    [1, '⅓'],
    [2, '⅔'],
    [7, '2⅓'],
    [9, '3'],
  ])('%i아웃 → %s이닝', (outs, text) => {
    expect(formatInnings(outs)).toBe(text)
  })
})

describe('저장소', () => {
  it('저장한 기록을 그대로 읽는다', () => {
    const data = new Map<string, object>()
    const store: RecordStore = {
      load: (id, fallback) => (data.get(id) as typeof fallback) ?? fallback,
      save: (id, record) => void data.set(id, record),
    }
    expect(loadRecord(store)).toEqual(EMPTY_RECORD)
    const r = addMatch(EMPTY_RECORD, summary({}))
    saveRecord(r, store)
    expect(loadRecord(store)).toEqual(r)
  })
})
