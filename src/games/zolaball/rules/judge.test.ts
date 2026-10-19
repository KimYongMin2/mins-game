import { describe, expect, it } from 'vitest'
import { diffForResult, judgeSwing } from './judge'

const normal = (diffMs: number) => judgeSwing({ diffMs, difficulty: 'normal', pitchIsBall: false })
const hard = (diffMs: number) => judgeSwing({ diffMs, difficulty: 'hard', pitchIsBall: false })

describe('judgeSwing (일반)', () => {
  it.each([
    [0, 'homerun'],
    [15, 'homerun'],
    [16, 'double'],
    [30, 'double'],
    [31, 'single'],
    [55, 'single'],
    [56, 'out'],
    [85, 'out'],
    [86, 'foul'],
    [130, 'foul'],
    [131, 'miss'],
    [1000, 'miss'],
  ] as const)('%ims → %s', (diff, expected) => {
    expect(normal(diff)).toBe(expected)
    expect(normal(-diff)).toBe(expected) // 빠른 스윙도 같은 구간
  })
})

describe('judgeSwing (어려움: 구간 70%)', () => {
  it.each([
    [10.5, 'homerun'],
    [11, 'double'],
    [21, 'double'],
    [22, 'single'],
    [38.5, 'single'],
    [39, 'out'],
    [59.5, 'out'],
    [60, 'foul'],
    [91, 'foul'],
    [92, 'miss'],
  ] as const)('%ims → %s', (diff, expected) => {
    expect(hard(diff)).toBe(expected)
  })
})

describe('볼에 스윙하면 타이밍과 상관없이 헛스윙', () => {
  it.each([0, 10, 40, 70, 100, 150, 500, -30])('%ims → miss', (diff) => {
    expect(judgeSwing({ diffMs: diff, difficulty: 'normal', pitchIsBall: true })).toBe('miss')
    expect(judgeSwing({ diffMs: diff, difficulty: 'hard', pitchIsBall: true })).toBe('miss')
  })
})


describe('diffForResult', () => {
  it('고른 시각 차이로 판정하면 그 결과가 나온다', () => {
    let seed = 1
    const random = () => {
      seed = (seed * 16807) % 2147483647
      return (seed - 1) / 2147483646
    }
    for (const result of ['homerun', 'double', 'single', 'out', 'foul', 'miss'] as const) {
      for (let i = 0; i < 50; i++) {
        const diffMs = diffForResult(result, random)
        expect(judgeSwing({ diffMs, difficulty: 'normal', pitchIsBall: false })).toBe(result)
      }
    }
  })
})
