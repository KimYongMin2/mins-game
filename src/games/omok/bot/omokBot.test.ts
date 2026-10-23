import { describe, expect, it } from 'vitest'
import { createRng } from '../../../shared/random'
import { SIZE, type Difficulty } from '../constants'
import { BLACK, type Board, WHITE, boardOf, canPlace, emptyBoard, isFull, isForbidden, place, winLine } from '../rules/renju'
import { chooseMove } from './omokBot'

/** 봇끼리 한 판. 이긴 색(무승부면 null) */
function botGame(seed: number, black: Difficulty, white: Difficulty) {
  const rng = createRng(seed)
  let b: Board = emptyBoard()
  for (let n = 0; ; n++) {
    const stone = n % 2 === 0 ? BLACK : WHITE
    const pos = chooseMove(rng, b, stone, stone === BLACK ? black : white)
    if (pos < 0) return { winner: null, b }
    expect(canPlace(b, pos, stone)).toBe(true)
    b = place(b, pos, stone)
    if (winLine(b, pos)) return { winner: stone, b }
    if (isFull(b)) return { winner: null, b }
  }
}

describe('오목 봇', () => {
  it('바로 이길 수 있으면 이긴다', () => {
    const b = boardOf(['●●●●.', '○○○○.'], 0, 3)
    expect(chooseMove(createRng(1), b, BLACK, 'normal')).toBe(3 * SIZE + 4)
  })

  it('어려움은 상대 4를 꼭 막는다', () => {
    const b = boardOf(['○○○○.', '●●...'], 0, 3)
    for (let seed = 1; seed <= 10; seed++) expect(chooseMove(createRng(seed), b, BLACK, 'hard')).toBe(3 * SIZE + 4)
  })

  it('흑 봇은 금수에 두지 않고, 어려움이 일반을 대체로 이긴다', () => {
    let hardWins = 0
    const games = 20
    for (let seed = 1; seed <= games; seed++) {
      // 흑·백을 번갈아 맡는다
      const hardBlack = seed % 2 === 0
      const { winner } = botGame(seed, hardBlack ? 'hard' : 'normal', hardBlack ? 'normal' : 'hard')
      if (winner === (hardBlack ? BLACK : WHITE)) hardWins++
    }
    console.log(`어려움 vs 일반: ${hardWins}/${games}승`)
    expect(hardWins).toBeGreaterThan(games * 0.7)
  })

  it('흑 금수 자리는 고르지 않는다', () => {
    // (7,7)이 쌍삼 자리. 다른 데 둘 데가 많으니 금수를 피해야 한다
    const b = boardOf(['......', '....●.', '....●.', '..●●..', '......'], 3, 3)
    const p = 6 * SIZE + 7
    expect(isForbidden(b, p)).toBe(true)
    for (let seed = 1; seed <= 10; seed++) expect(chooseMove(createRng(seed), b, BLACK, 'hard')).not.toBe(p)
  })
})
