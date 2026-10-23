import { describe, expect, it } from 'vitest'
import { createRng } from '../../../shared/random'
import type { Difficulty } from '../constants'
import { type Side, initialStones, remaining, simulate } from '../rules/physics'
import { judgeShot } from '../rules/turn'
import { chooseShot } from './shotBot'

/** 봇끼리 한 판. 이긴 쪽 */
function botGame(seed: number, levels: [Difficulty, Difficulty]) {
  const rng = createRng(seed)
  let stones = initialStones()
  let turn: Side = (seed % 2) as Side
  for (let n = 0; n < 200; n++) {
    const shot = chooseShot(rng, stones, turn, levels[turn])
    const { final } = simulate(stones, shot.index, shot.vx, shot.vy)
    const outcome = judgeShot(stones, final, turn, shot.index)
    stones = final
    if (outcome.kind === 'over') return { winner: outcome.winner, shots: n + 1 }
    if (outcome.kind === 'next') turn = (1 - turn) as Side
  }
  return { winner: null, shots: 200 }
}

describe('알까기 봇', () => {
  it('어려움 봇은 첫 수에 대체로 상대 돌을 떨어뜨린다', () => {
    let hits = 0
    for (let seed = 1; seed <= 20; seed++) {
      const s = initialStones()
      const shot = chooseShot(createRng(seed), s, 0, 'hard')
      if (remaining(simulate(s, shot.index, shot.vx, shot.vy).final, 1) < 5) hits++
    }
    console.log(`어려움 첫 수 명중: ${hits}/20`)
    expect(hits).toBeGreaterThan(12)
  })

  it('봇끼리 끝까지 가고, 어려움이 일반을 대체로 이긴다', () => {
    let hardWins = 0
    let total = 0
    for (let seed = 1; seed <= 20; seed++) {
      const { winner, shots } = botGame(seed, ['hard', 'normal'])
      expect(winner).not.toBeNull()
      total += shots
      if (winner === 0) hardWins++
    }
    console.log(`어려움 vs 일반: ${hardWins}/20승, 평균 ${(total / 20).toFixed(1)}번 튕김`)
    expect(hardWins).toBeGreaterThan(13)
  })
})
