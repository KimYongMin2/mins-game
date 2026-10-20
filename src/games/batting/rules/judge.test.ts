import { describe, expect, it } from 'vitest'
import { type Cell, CELLS, cellAt, cellMiddle, cellPosition, contactAt, contactOf, judgeSwing, nearestCell, outcomeByDistance } from './judge'

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

describe('judgeSwing (타이밍 → 비거리 → 결과)', () => {
  const swing = (offset: number, touched: Cell = 5, ball: Cell = 5, difficulty: 'normal' | 'hard' = 'normal') =>
    judgeSwing({ difficulty, hand: 'right', touch: cellMiddle(touched), ball, swingAt: 1000 + offset, arriveAt: 1000 })

  it('공 가운데를 완벽한 타이밍에 치면 최대 비거리 140m 홈런', () => {
    expect(swing(0)).toMatchObject({ outcome: 'homerun', distance: 140 })
  })

  it('타이밍이 어긋날수록 덜 날아간다 (빠르든 늦든 같음)', () => {
    const d = [0, 20, 40, 60, 90, 120].map((o) => swing(o).distance!)
    for (let i = 1; i < d.length; i++) expect(d[i]).toBeLessThan(d[i - 1])
    expect(swing(-40).distance).toBe(swing(40).distance)
  })

  it.each([
    [0, 'homerun'],
    [30, 'homerun'],
    [40, 'triple'],
    [60, 'double'],
    [100, 'single'],
    [128, 'out'],
    [150, 'foul'],
    [181, 'whiff'],
  ])('정타 %ims → %s', (offset, outcome) => {
    expect(swing(offset).outcome).toBe(outcome)
  })

  it('비거리별 결과: 115m↑ 홈런, 95m↑ 3루타, 70m↑ 2루타, 30m↑ 안타, 그 밑은 범타', () => {
    expect(outcomeByDistance(115)).toBe('homerun')
    expect(outcomeByDistance(114)).toBe('triple')
    expect(outcomeByDistance(95)).toBe('triple')
    expect(outcomeByDistance(70)).toBe('double')
    expect(outcomeByDistance(30)).toBe('single')
    expect(outcomeByDistance(29)).toBe('out')
  })

  it('빗맞으면 완벽한 타이밍이어도 홈런은 안 나온다 (3루타까지)', () => {
    expect(swing(0, 5, 4)).toMatchObject({ contact: 'off', outcome: 'triple' })
    expect(swing(70, 5, 2).outcome).toBe('single')
  })

  it('정타라도 공 가운데에서 벗어나 맞으면 조금 덜 날아간다', () => {
    const center = swing(10).distance!
    const edge = judgeSwing({ difficulty: 'normal', hand: 'right', touch: { col: 1.9, row: 1.9 }, ball: 5, swingAt: 1010, arriveAt: 1000 })
    expect(edge.contact).toBe('sweet')
    expect(edge.distance!).toBeLessThan(center)
  })

  it('스침은 파울, 타이밍이 너무 어긋나면 헛스윙', () => {
    expect(swing(0, 6, 4)).toMatchObject({ outcome: 'foul', distance: null })
    expect(swing(-190, 6, 4).outcome).toBe('whiff')
  })

  it('배트 끝 너머는 타이밍이 완벽해도 헛스윙', () => {
    expect(swing(0, 4, 6)).toMatchObject({ outcome: 'whiff', contact: 'miss', distance: null })
  })

  it('어려움은 구간 폭 70%', () => {
    expect(swing(95, 5, 5, 'hard').outcome).toBe('foul')
    expect(swing(127, 5, 5, 'hard').outcome).toBe('whiff')
    expect(swing(20, 5, 5, 'hard').distance!).toBeLessThan(swing(20).distance!)
  })

  it('타이밍 차이는 부호 그대로 (빠르면 음수)', () => {
    expect(swing(-42).offsetMs).toBe(-42)
  })
})

describe('contactAt (칸 경계와 상관없이 터치)', () => {
  const six = cellMiddle(6)

  it('공이 들어온 칸 안 어디를 눌러도 정타', () => {
    expect(contactAt('right', { col: 2.05, row: 1.1 }, six)).toBe('sweet')
    expect(contactAt('right', { col: 2.95, row: 1.9 }, six)).toBe('sweet')
  })

  it('칸 경계(5·6 사이)를 누르면 좋은 쪽으로 판정', () => {
    expect(contactAt('right', { col: 2, row: 1.5 }, six)).toBe('sweet')
    expect(contactAt('right', { col: 1.5, row: 1.5 }, cellMiddle(5))).toBe('sweet')
  })

  it('공보다 반 칸 넘게 손잡이 쪽에서 맞으면 빗맞음, 끝 너머면 헛스윙', () => {
    // 공은 5번 가운데(1.5), 터치는 그보다 0.7칸 오른쪽
    expect(contactAt('right', { col: 2.2, row: 1.5 }, cellMiddle(5))).toBe('off')
    expect(contactAt('left', { col: 2.2, row: 1.5 }, cellMiddle(5))).toBe('miss')
    // 반 칸 이내로 끝 너머면 아직 정타
    expect(contactAt('right', { col: 1.9, row: 1.5 }, six)).toBe('miss')
    expect(contactAt('right', { col: 2.05, row: 1.5 }, six)).toBe('sweet')
  })

  it('nearestCell: 존 밖은 가장 가까운 칸', () => {
    expect(nearestCell({ col: 2.5, row: 1.5 })).toBe(6)
    expect(nearestCell({ col: -1, row: 5 })).toBe(7)
  })
})
