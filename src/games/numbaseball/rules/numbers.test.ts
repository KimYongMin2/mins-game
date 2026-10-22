import { describe, expect, it } from 'vitest'
import { createRng } from '../../../shared/random'
import { allNumbers, canAppend, consistent, isValidNumber, randomNumber, score, scoreText } from './numbers'

describe('숫자 규칙', () => {
  it('서로 다른 숫자, 맨 앞 0 금지', () => {
    expect(isValidNumber([4, 7, 2], 3)).toBe(true)
    expect(isValidNumber([0, 7, 2], 3)).toBe(false)
    expect(isValidNumber([4, 7, 7], 3)).toBe(false)
    expect(isValidNumber([4, 7], 3)).toBe(false)
    expect(isValidNumber([1, 0, 2, 3], 4)).toBe(true)
  })

  it('입력 중: 첫 자리 0과 이미 쓴 숫자는 못 붙인다', () => {
    expect(canAppend([], 0, 3)).toBe(false)
    expect(canAppend([1], 0, 3)).toBe(true)
    expect(canAppend([1, 2], 2, 3)).toBe(false)
    expect(canAppend([1, 2, 3], 4, 3)).toBe(false)
  })

  it('스트라이크·볼·아웃', () => {
    expect(score([4, 7, 2], [4, 2, 7])).toEqual({ strike: 1, ball: 2 })
    expect(score([4, 7, 2], [1, 3, 5])).toEqual({ strike: 0, ball: 0 })
    expect(score([1, 2, 3, 4], [1, 2, 3, 4])).toEqual({ strike: 4, ball: 0 })
    expect(scoreText({ strike: 1, ball: 2 }, 3)).toBe('1S 2B')
    expect(scoreText({ strike: 0, ball: 1 }, 3)).toBe('1B')
    expect(scoreText({ strike: 0, ball: 0 }, 4)).toBe('OUT')
    expect(scoreText({ strike: 3, ball: 0 }, 3)).toBe('3S')
  })

  it('만들 수 있는 숫자 개수', () => {
    expect(allNumbers(3)).toHaveLength(9 * 9 * 8)
    expect(allNumbers(4)).toHaveLength(9 * 9 * 8 * 7)
    expect(allNumbers(4).every((n) => isValidNumber(n, 4))).toBe(true)
  })

  it('무작위 숫자도 규칙에 맞다', () => {
    const rng = createRng(1)
    for (let i = 0; i < 200; i++) expect(isValidNumber(randomNumber(rng, 4), 4)).toBe(true)
  })

  it('단서에 맞는 후보만 남긴다', () => {
    const left = consistent(allNumbers(3), [{ digits: [1, 2, 3], score: { strike: 3, ball: 0 } }])
    expect(left).toEqual([[1, 2, 3]])
  })
})
