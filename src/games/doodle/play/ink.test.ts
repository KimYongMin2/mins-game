import { describe, expect, it } from 'vitest'
import { applyOps, readOps, tooBig } from './ink'

describe('그림 조각', () => {
  it('도형은 두 점, 채우기는 한 점만 받음', () => {
    expect(readOps([{ op: 's', id: 1, c: '#e8473f', w: 4, p: [0, 0, 100, 100], k: 'r' }])).toHaveLength(1)
    expect(readOps([{ op: 's', id: 1, c: '#e8473f', w: 4, p: [0, 0, 100, 100, 5, 5], k: 'e' }])).toBeNull()
    expect(readOps([{ op: 's', id: 1, c: '#e8473f', w: 4, p: [10, 10], k: 'f' }])).toHaveLength(1)
    expect(readOps([{ op: 's', id: 1, c: '#e8473f', w: 4, p: [10, 10, 20, 20], k: 'z' }])).toBeNull()
    expect(readOps([{ op: 's', id: 1, c: 'red', w: 4, p: [10, 10] }])).toBeNull()
  })

  it('되돌리기는 도형·채우기도 하나씩, 도형엔 점을 못 더함', () => {
    let s = applyOps([], [
      { op: 's', id: 1, c: '#000000', w: 4, p: [0, 0, 10, 10] },
      { op: 's', id: 2, c: '#000000', w: 4, p: [0, 0, 50, 50], k: 'l' },
      { op: 'a', id: 2, p: [60, 60] },
      { op: 's', id: 3, c: '#ffd23f', w: 4, p: [5, 5], k: 'f' },
    ])
    expect(s.map((x) => x.k ?? 'p')).toEqual(['p', 'l', 'f'])
    expect(s[1].p).toEqual([0, 0, 50, 50])
    s = applyOps(s, [{ op: 'u' }])
    expect(s.map((x) => x.k ?? 'p')).toEqual(['p', 'l'])
  })

  it('채우기는 한 판에 60번까지', () => {
    const fills = Array.from({ length: 61 }, (_, i) => ({ id: i, c: '#000000', w: 4, p: [1, 1], k: 'f' as const }))
    expect(tooBig(fills)).toBe(true)
    expect(tooBig(fills.slice(0, 60))).toBe(false)
  })
})
