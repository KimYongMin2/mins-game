import { describe, expect, it } from 'vitest'
import { EMPTY_RECORD, addGame } from './records'

describe('addGame', () => {
  it('판 수·우승·킬을 봇 연습·친구 대전 따로 센다', () => {
    let r = addGame(EMPTY_RECORD, { mode: 'pvp', rank: 1, kills: 2, ranking: [] })
    r = addGame(r, { mode: 'pvp', rank: 3, kills: 1, ranking: [] })
    r = addGame(r, { mode: 'bot', rank: 2, kills: 0, ranking: [] })
    expect(r.pvp).toEqual({ games: 2, wins: 1, kills: 3 })
    expect(r.bot).toEqual({ games: 1, wins: 0, kills: 0 })
  })
})
