import { describe, expect, it } from 'vitest'
import { EMPTY_RECORD, addGame } from './records'

describe('addGame', () => {
  it('판 수와 우승을 봇 연습·친구 대전 따로 센다', () => {
    let r = addGame(EMPTY_RECORD, { mode: 'pvp', won: true, standings: [] })
    r = addGame(r, { mode: 'bot', won: false, standings: [] })
    expect(r.pvp).toEqual({ games: 1, wins: 1 })
    expect(r.bot).toEqual({ games: 1, wins: 0 })
  })
})
