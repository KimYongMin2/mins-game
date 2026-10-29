import { describe, expect, it } from 'vitest'
import { createRng } from '../../../shared/random'
import { isValidSet, orderSet, setKind, setValue } from './sets'
import { TILE_COUNT, WILD_IDS, colorOf, handValue, isWild, numOf, shuffledDeck, tileId } from './tiles'
import { checkPlay } from './turn'

const [W1, W2] = WILD_IDS
const R = 0
const B = 1
const O = 2
const K = 3
const t = (color: number, num: number, copy = 0) => tileId(color, num, copy)

describe('타일', () => {
  it('104장 + 와일드 2장, 번호로 숫자·색을 안다', () => {
    expect(TILE_COUNT).toBe(106)
    expect(numOf(t(O, 7, 1))).toBe(7)
    expect(colorOf(t(O, 7, 1))).toBe(O)
    expect(isWild(W1) && isWild(W2)).toBe(true)
    const deck = shuffledDeck(createRng(1))
    expect(new Set(deck).size).toBe(106)
  })

  it('남은 손패 점수: 와일드는 13', () => {
    expect(handValue([t(R, 3), t(B, 10), W1])).toBe(26)
  })
})

describe('줄', () => {
  it('같은 색 연속 3장 이상, 왼쪽부터 작은 숫자 순서대로', () => {
    expect(setKind([t(R, 4), t(R, 5), t(R, 6)])).toBe('run')
    expect(isValidSet([t(R, 4), t(R, 6), t(R, 5)])).toBe(false)
    expect(isValidSet([t(R, 3), t(R, 5), t(R, 4)])).toBe(false)
    expect(isValidSet([t(R, 6), t(R, 5), t(R, 4)])).toBe(false)
    expect(isValidSet([t(R, 4), t(R, 5)])).toBe(false)
    expect(isValidSet([t(R, 4), t(B, 5), t(R, 6)])).toBe(false)
    expect(isValidSet([t(R, 12), t(R, 13), t(R, 1)])).toBe(false)
    expect(isValidSet([t(R, 4), t(R, 4, 1), t(R, 5)])).toBe(false)
  })

  it('같은 숫자 다른 색 3~4장', () => {
    expect(setKind([t(R, 7), t(B, 7), t(O, 7)])).toBe('group')
    expect(isValidSet([t(R, 7), t(B, 7), t(O, 7), t(K, 7)])).toBe(true)
    expect(isValidSet([t(R, 7), t(B, 7), t(R, 7, 1)])).toBe(false)
    expect(isValidSet([t(R, 7), t(B, 7), t(O, 7), t(K, 7), W1])).toBe(false)
  })

  it('같은 숫자는 색 순서 상관없음', () => {
    expect(isValidSet([t(K, 7), t(R, 7), t(B, 7)])).toBe(true)
    expect(isValidSet([W1, t(K, 7), t(R, 7)])).toBe(true)
  })

  it('와일드는 놓인 자리의 숫자', () => {
    expect(isValidSet([t(R, 12), t(R, 13), W1])).toBe(false)
    expect(isValidSet([W1, t(R, 12), t(R, 13)])).toBe(true)
    expect(isValidSet([t(R, 1), t(R, 2), W1])).toBe(true)
    expect(isValidSet([W1, t(R, 1), t(R, 2)])).toBe(false)
    expect(isValidSet([t(R, 4), t(R, 6), W1])).toBe(false)
    expect(isValidSet([t(R, 4), W1, t(R, 6)])).toBe(true)
  })

  it('와일드는 빈 곳을 채운다', () => {
    expect(isValidSet([t(B, 3), W1, t(B, 5)])).toBe(true)
    expect(isValidSet([t(B, 3), W1, t(B, 6)])).toBe(false)
    expect(isValidSet([t(B, 3), W1, W2, t(B, 6)])).toBe(true)
    expect(isValidSet([t(O, 9), t(K, 9), W1])).toBe(true)
  })

  it('점수: 와일드는 놓인 자리의 숫자', () => {
    expect(setValue([t(R, 4), t(R, 5), t(R, 6)])).toBe(15)
    expect(setValue([t(R, 4), W1, t(R, 6)])).toBe(15)
    expect(setValue([t(R, 4), t(R, 5), W1])).toBe(15)
    expect(setValue([W1, t(R, 12), t(R, 13)])).toBe(36)
    expect(setValue([t(R, 12), t(R, 13), W1])).toBe(0)
    expect(setValue([t(O, 9), t(K, 9), W1])).toBe(27)
  })

  it('봇이 줄을 만들 때 놓는 순서', () => {
    expect(orderSet([t(R, 6), W1, t(R, 4)])).toEqual([t(R, 4), W1, t(R, 6)])
    expect(orderSet([t(R, 12), W1, t(R, 13)])).toEqual([W1, t(R, 12), t(R, 13)])
    expect(orderSet([t(R, 5), t(R, 3), t(R, 4)])).toEqual([t(R, 3), t(R, 4), t(R, 5)])
    expect(orderSet([t(R, 5), t(R, 5, 1), W1])).toBeNull()
    expect(orderSet([t(R, 5), t(B, 9), W1])).toBeNull()
  })
})

describe('한 차례 검사', () => {
  const run = [t(R, 4), t(R, 5), t(R, 6)]

  it('첫 등록: 내 타일로만 합 25 이상', () => {
    const hand = [t(B, 10), t(O, 10), t(K, 10), t(R, 2)]
    expect(checkPlay({ oldTable: [run], hand, newTable: [run, [t(B, 10), t(O, 10), t(K, 10)]], melded: false })).toEqual({
      ok: true,
      placed: [t(B, 10), t(O, 10), t(K, 10)],
    })
    const small = [t(B, 3), t(O, 3), t(K, 3)]
    expect(checkPlay({ oldTable: [], hand: small, newTable: [small], melded: false })).toEqual({ ok: false, problem: 'too-small' })
  })

  it('첫 등록 전엔 바닥 줄을 건드릴 수 없다', () => {
    const hand = [t(R, 7), t(B, 10), t(O, 10), t(K, 10)]
    const newTable = [[...run, t(R, 7)], [t(B, 10), t(O, 10), t(K, 10)]]
    expect(checkPlay({ oldTable: [run], hand, newTable, melded: false })).toEqual({ ok: false, problem: 'touched' })
    expect(checkPlay({ oldTable: [run], hand, newTable, melded: true }).ok).toBe(true)
  })

  it('바닥을 다시 짜서 끼워 넣기 (첫 등록 뒤)', () => {
    // 빨강 4·5·6·7 + 손의 빨강 5 → 4·5·6 / 5·6·7은 안 되고, 4·5·5는 틀림. 빨강 3·4·5 / 5·6·7은 됨
    const old = [[t(R, 4), t(R, 5), t(R, 6), t(R, 7)]]
    const hand = [t(R, 3), t(R, 5, 1)]
    const newTable = [[t(R, 3), t(R, 4), t(R, 5)], [t(R, 5, 1), t(R, 6), t(R, 7)]]
    expect(checkPlay({ oldTable: old, hand, newTable, melded: true })).toEqual({ ok: true, placed: [t(R, 3), t(R, 5, 1)] })
  })

  it('바닥 타일을 가져가거나, 틀린 줄이 있거나, 아무것도 안 내면 안 됨', () => {
    const hand = [t(R, 7)]
    expect(checkPlay({ oldTable: [run], hand, newTable: [[t(R, 5), t(R, 6), t(R, 7)]], melded: true })).toEqual({ ok: false, problem: 'took-tile' })
    expect(checkPlay({ oldTable: [run], hand, newTable: [run, [t(R, 7)]], melded: true })).toEqual({ ok: false, problem: 'bad-set' })
    expect(checkPlay({ oldTable: [run], hand, newTable: [run], melded: true })).toEqual({ ok: false, problem: 'nothing' })
    expect(checkPlay({ oldTable: [run], hand, newTable: [[...run, t(B, 1)]], melded: true })).toEqual({ ok: false, problem: 'bad-tiles' })
  })
})
