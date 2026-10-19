import { describe, expect, it } from 'vitest'
import { diffForResult, downgrade, judgeSwing } from './judge'

const normal = (diffMs: number) => judgeSwing({ diffMs, difficulty: 'normal', pitchIsBall: false })
const hard = (diffMs: number) => judgeSwing({ diffMs, difficulty: 'hard', pitchIsBall: false })

describe('judgeSwing (일반)', () => {
  it.each([
    [0, 'homerun'],
    [25, 'homerun'],
    [26, 'double'],
    [50, 'double'],
    [51, 'single'],
    [85, 'single'],
    [86, 'out'],
    [120, 'out'],
    [121, 'foul'],
    [170, 'foul'],
    [171, 'miss'],
    [1000, 'miss'],
  ] as const)('%ims → %s', (diff, expected) => {
    expect(normal(diff)).toBe(expected)
    expect(normal(-diff)).toBe(expected) // 빠른 스윙도 같은 구간
  })
})

describe('judgeSwing (어려움: 구간 70%)', () => {
  it.each([
    [17.5, 'homerun'],
    [18, 'double'],
    [35, 'double'],
    [36, 'single'],
    [59.5, 'single'],
    [60, 'out'],
    [84, 'out'],
    [85, 'foul'],
    [119, 'foul'],
    [120, 'miss'],
  ] as const)('%ims → %s', (diff, expected) => {
    expect(hard(diff)).toBe(expected)
  })
})

describe('볼에 스윙하면 한 단계 하향', () => {
  it.each([
    [0, 'double'],
    [40, 'single'],
    [70, 'out'],
    [100, 'foul'],
    [150, 'miss'],
    [500, 'miss'],
  ] as const)('%ims → %s', (diff, expected) => {
    expect(judgeSwing({ diffMs: diff, difficulty: 'normal', pitchIsBall: true })).toBe(expected)
  })
})

describe('downgrade', () => {
  it('헛스윙은 더 내려가지 않는다', () => {
    expect(downgrade('miss')).toBe('miss')
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
