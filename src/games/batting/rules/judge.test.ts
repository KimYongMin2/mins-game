import { describe, expect, it } from 'vitest'
import { type Cell, CELLS, cellAt, cellPosition, contactOf, judgeSwing } from './judge'

describe('칸 번호', () => {
  it('키패드 배치: 1 2 3 / 4 5 6 / 7 8 9', () => {
    expect(cellPosition(1)).toEqual({ col: 0, row: 0 })
    expect(cellPosition(6)).toEqual({ col: 2, row: 1 })
    expect(cellPosition(7)).toEqual({ col: 0, row: 2 })
    for (const c of CELLS) {
      const { col, row } = cellPosition(c)
      expect(cellAt(col, row)).toBe(c)
    }
  })
})

describe('contactOf (맞은 위치)', () => {
  it('같은 칸은 정타', () => {
    for (const c of CELLS) {
      expect(contactOf('right', c, c)).toBe('sweet')
      expect(contactOf('left', c, c)).toBe('sweet')
    }
  })

  it('기획 예시: 공 6번, 4번 터치 → 우타 헛스윙, 좌타 스침', () => {
    expect(contactOf('right', 4, 6)).toBe('miss')
    expect(contactOf('left', 4, 6)).toBe('graze')
  })

  it('배트 끝 너머는 한 칸이라도 헛스윙 (우타는 오른쪽, 좌타는 왼쪽이 너머)', () => {
    expect(contactOf('right', 5, 6)).toBe('miss')
    expect(contactOf('left', 5, 4)).toBe('miss')
    expect(contactOf('right', 1, 5)).toBe('miss') // 끝 너머 대각선
  })

  it('손잡이 쪽 한 칸은 빗맞음, 두 칸은 스침', () => {
    expect(contactOf('right', 5, 4)).toBe('off')
    expect(contactOf('left', 5, 6)).toBe('off')
    expect(contactOf('right', 6, 4)).toBe('graze')
    expect(contactOf('left', 4, 6)).toBe('graze')
  })

  it('위·아래 한 칸은 빗맞음, 두 칸은 헛스윙', () => {
    expect(contactOf('right', 5, 2)).toBe('off')
    expect(contactOf('left', 5, 8)).toBe('off')
    expect(contactOf('right', 2, 8)).toBe('miss')
  })

  it('손잡이 쪽 대각선 한 칸은 스침', () => {
    expect(contactOf('right', 5, 1)).toBe('graze')
    expect(contactOf('right', 5, 7)).toBe('graze')
    expect(contactOf('left', 5, 3)).toBe('graze')
    expect(contactOf('left', 5, 9)).toBe('graze')
  })

  it('우타와 좌타는 좌우 대칭', () => {
    const mirror = (c: Cell) => {
      const { col, row } = cellPosition(c)
      return cellAt(2 - col, row)
    }
    for (const t of CELLS) for (const b of CELLS) expect(contactOf('left', mirror(t), mirror(b))).toBe(contactOf('right', t, b))
  })
})

describe('judgeSwing (타이밍)', () => {
  const swing = (offset: number, touched: Cell = 5, ball: Cell = 5, difficulty: 'normal' | 'hard' = 'normal') =>
    judgeSwing({ difficulty, hand: 'right', touched, ball, swingAt: 1000 + offset, arriveAt: 1000 })

  it.each([
    [0, 'homerun'],
    [-20, 'homerun'],
    [21, 'triple'],
    [-35, 'triple'],
    [50, 'double'],
    [-80, 'single'],
    [100, 'out'],
    [-150, 'foul'],
    [161, 'whiff'],
  ])('정타 %ims → %s', (offset, outcome) => {
    expect(swing(offset).outcome).toBe(outcome)
  })

  it('빗맞음은 좋은 타이밍이어도 안타까지', () => {
    expect(swing(0, 5, 4).outcome).toBe('single')
    expect(swing(60, 5, 4).outcome).toBe('out')
    expect(swing(-130, 5, 2).outcome).toBe('foul')
    expect(swing(200, 5, 2).outcome).toBe('whiff')
  })

  it('스침은 파울, 타이밍이 너무 어긋나면 헛스윙', () => {
    expect(swing(0, 6, 4).outcome).toBe('foul')
    expect(swing(-170, 6, 4).outcome).toBe('whiff')
  })

  it('배트 끝 너머는 타이밍이 완벽해도 헛스윙', () => {
    expect(swing(0, 4, 6)).toMatchObject({ outcome: 'whiff', contact: 'miss' })
  })

  it('어려움은 구간 폭 70% (홈런 ±14ms)', () => {
    expect(swing(14, 5, 5, 'hard').outcome).toBe('homerun')
    expect(swing(15, 5, 5, 'hard').outcome).toBe('triple')
    expect(swing(113, 5, 5, 'hard').outcome).toBe('whiff')
  })

  it('타이밍 차이는 부호 그대로 (빠르면 음수)', () => {
    expect(swing(-42).offsetMs).toBe(-42)
  })
})
