import { describe, expect, it } from 'vitest'
import { SIZE } from '../constants'
import { BLACK, WHITE, boardOf, canPlace, forbiddenKind, isForbidden, makesFive, place, winLine } from './renju'

// 그림은 판의 (3, 3)부터 그린다. '.'은 빈칸, P는 둘 자리(빈칸)
function setup(rows: string[]) {
  const b = boardOf(rows, 3, 3)
  const y = rows.findIndex((r) => r.includes('P'))
  return { b, p: (3 + y) * SIZE + 3 + rows[y].indexOf('P') }
}

describe('다섯', () => {
  it('흑은 정확히 다섯이면 승리, 여섯은 아님', () => {
    const five = setup(['●●P●●'])
    expect(makesFive(five.b, five.p, BLACK)).toBe(true)
    const six = setup(['●●●P●●'])
    expect(makesFive(six.b, six.p, BLACK)).toBe(false)
  })

  it('백은 여섯 이상도 승리', () => {
    const { b, p } = setup(['○○○P○○'])
    expect(makesFive(b, p, WHITE)).toBe(true)
    expect(winLine(place(b, p, WHITE), p)).toHaveLength(6)
  })

  it('대각선도 된다', () => {
    const { b, p } = setup(['●....', '.●...', '..P..', '...●.', '....●'])
    expect(winLine(place(b, p, BLACK), p)).toHaveLength(5)
  })
})

describe('흑 금수', () => {
  it('쌍삼은 금수', () => {
    const { b, p } = setup(['......', '....●.', '....●.', '..●●P.', '......', '......'])
    expect(isForbidden(b, p)).toBe(true)
    expect(forbiddenKind(b, p)).toBe('쌍삼')
    expect(canPlace(b, p, WHITE)).toBe(true)
  })

  it('한쪽이 막힌 3은 열린 3이 아니라 쌍삼이 아니다', () => {
    const { b, p } = setup(['......', '....●.', '....●.', '.○●●P.', '......', '......'])
    expect(isForbidden(b, p)).toBe(false)
  })

  it('4-3은 된다', () => {
    const { b, p } = setup(['......', '.....●', '.....●', '..●●●P.', '.......', '.......'])
    expect(isForbidden(b, p)).toBe(false)
  })

  it('쌍사는 금수', () => {
    const { b, p } = setup(['....○.', '....●.', '....●.', '....●.', '○●●●P.', '......'])
    expect(forbiddenKind(b, p)).toBe('쌍사')
  })

  it('한 줄 안의 쌍사도 금수', () => {
    const { b, p } = setup(['●.●P●.●'])
    expect(forbiddenKind(b, p)).toBe('쌍사')
  })

  it('장목(6개 이상)은 금수', () => {
    const { b, p } = setup(['●●●P●●'])
    expect(forbiddenKind(b, p)).toBe('장목')
  })

  it('다섯을 만드는 수는 쌍삼이 같이 생겨도 둘 수 있다', () => {
    const { b, p } = setup(['......', '....●.', '....●.', '●●●●P.', '......', '......'])
    expect(isForbidden(b, p)).toBe(false)
    expect(makesFive(b, p, BLACK)).toBe(true)
  })

  it('열린 4 하나는 된다', () => {
    const { b, p } = setup(['.●●●P.'])
    expect(isForbidden(b, p)).toBe(false)
  })
})
