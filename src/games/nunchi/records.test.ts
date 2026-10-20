import { describe, expect, it } from 'vitest'
import { EMPTY_RECORD, addGame } from './records'

describe('addGame', () => {
  it('판 수와 1등을 봇 연습·친구 대전 따로 센다', () => {
    let r = addGame(EMPTY_RECORD, { mode: 'pvp', rank: 1, ranking: [] })
    r = addGame(r, { mode: 'pvp', rank: 3, ranking: [] })
    r = addGame(r, { mode: 'bot', rank: 2, ranking: [] })
    expect(r.pvp).toEqual({ games: 2, wins: 1 })
    expect(r.bot).toEqual({ games: 1, wins: 0 })
  })
})
