import { describe, expect, it } from 'vitest'
import { alternateSeats, assignTeams, lastTeam, sameTeam, teamsReady } from './teams'

describe('팀 나누기', () => {
  it('고르지 않은 사람은 적은 팀으로', () => {
    expect(assignTeams(['a', 'b', 'c', 'd'], {})).toEqual([0, 1, 0, 1])
    expect(assignTeams(['a', 'b', 'c', 'd'], { a: 1, b: 1 })).toEqual([1, 1, 0, 0])
    expect(assignTeams(['a', 'b', 'c'], { c: 0 })).toEqual([1, 0, 0])
  })
  it('두 팀 다 있어야 시작', () => {
    expect(teamsReady([0, 0])).toBe(false)
    expect(teamsReady([0, 1])).toBe(true)
  })
  it('번갈아 앉기', () => {
    expect(alternateSeats([0, 0, 1, 1])).toEqual([0, 2, 1, 3])
    expect(alternateSeats([1, 0, 0, 0, 1])).toEqual([0, 1, 4, 2, 3])
  })
  it('남은 팀', () => {
    expect(lastTeam([true, false, true, false], [0, 1, 0, 1])).toBe(0)
    expect(lastTeam([true, true, false], [0, 1, 1])).toBe(null)
    expect(lastTeam([false, false], [0, 1])).toBe(null)
    expect(sameTeam([0, 1, 0], 0, 2)).toBe(true)
    expect(sameTeam(null, 0, 2)).toBe(false)
  })
})
