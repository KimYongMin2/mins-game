import { describe, expect, it } from 'vitest'
import { createRng } from '../../../shared/random'
import type { Difficulty, Length } from '../constants'
import { type Digits, type Score, isSolved, randomNumber, score } from '../rules/numbers'
import { chooseBotGuess } from './guessBot'

/** 봇이 무작위 숫자를 맞히는 데 걸린 평균 횟수 */
function averageTries(difficulty: Difficulty, length: Length, games = 150): number {
  const rng = createRng(difficulty === 'hard' ? 11 : 22)
  let total = 0
  for (let g = 0; g < games; g++) {
    const secret = randomNumber(rng, length)
    const clues: { digits: Digits; score: Score }[] = []
    for (;;) {
      const digits = chooseBotGuess(rng, length, clues, difficulty)
      const s = score(secret, digits)
      clues.push({ digits, score: s })
      if (isSolved(s, length) || clues.length >= 60) break
    }
    total += clues.length
  }
  return total / games
}

describe('봇 부르기', () => {
  it('같은 숫자를 두 번 부르지 않는다', () => {
    const rng = createRng(5)
    const clues = [{ digits: [1, 2, 3], score: { strike: 0, ball: 0 } }]
    for (let i = 0; i < 50; i++) expect(chooseBotGuess(rng, 3, clues, 'normal').join('')).not.toBe('123')
  })

  it('어려움은 일반보다 훨씬 빨리 맞힌다', () => {
    const avg = {
      normal3: averageTries('normal', 3),
      hard3: averageTries('hard', 3),
      normal4: averageTries('normal', 4),
      hard4: averageTries('hard', 4),
    }
    console.log('봇 평균 시도 횟수', avg)
    expect(avg.hard3).toBeLessThan(6)
    expect(avg.hard4).toBeLessThan(7)
    expect(avg.normal3).toBeGreaterThan(avg.hard3 + 1.5)
    expect(avg.normal4).toBeGreaterThan(avg.hard4 + 1.5)
  })
})
