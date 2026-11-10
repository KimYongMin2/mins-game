import { describe, expect, it } from 'vitest'
import { GAMES } from './gameList'
import { playerRange } from './PlayerDots'

describe('인원 점 표기', () => {
  it('인원 글자를 범위로', () => {
    expect(playerRange('1인')).toEqual([1, 1])
    expect(playerRange('2인')).toEqual([2, 2])
    expect(playerRange('2~8인')).toEqual([2, 8])
  })
  it('모든 게임의 인원을 읽을 수 있고, 조작법이 3~4줄', () => {
    for (const g of GAMES) {
      const [min, max] = playerRange(g.players)
      expect(min).toBeGreaterThanOrEqual(1)
      expect(max).toBeGreaterThanOrEqual(min)
      expect(g.howto.length).toBeGreaterThanOrEqual(3)
      expect(g.howto.length).toBeLessThanOrEqual(4)
    }
  })
})
