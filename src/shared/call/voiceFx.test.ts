import { describe, expect, it } from 'vitest'
import { nearestNote, scaleMask } from './voiceFx'

// midi: 60 = 도(C4), 61 = 도#, 62 = 레 …
describe('오토튠 음계', () => {
  it('반음 전부면 가장 가까운 반음', () => {
    const all = scaleMask({ kind: 'chromatic' })
    expect(nearestNote(61.3, all)).toBe(61)
    expect(nearestNote(60.7, all)).toBe(61)
  })

  it('다장조는 반음(#) 없이 도레미파솔라시', () => {
    const c = scaleMask({ kind: 'major', root: 0 })
    expect(c.map((on, i) => (on ? i : -1)).filter((i) => i >= 0)).toEqual([0, 2, 4, 5, 7, 9, 11])
    // 도#(61)쯤이면 도나 레로
    expect(nearestNote(60.9, c)).toBe(60)
    expect(nearestNote(61.8, c)).toBe(62)
    // 미(64)와 파(65)는 반음 차이라 그대로
    expect(nearestNote(64.4, c)).toBe(64)
  })

  it('라단조는 다장조와 같은 음, 솔장조는 파 대신 파#', () => {
    expect(scaleMask({ kind: 'minor', root: 9 })).toEqual(scaleMask({ kind: 'major', root: 0 }))
    const g = scaleMask({ kind: 'major', root: 7 })
    expect(g[5]).toBe(false)
    expect(g[6]).toBe(true)
  })
})
