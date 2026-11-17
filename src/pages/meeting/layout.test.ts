import { describe, expect, it } from 'vitest'
import { ME, arrange, screenId, screenOwner } from './layout'

const base = { ids: [ME, 'a', 'b', 'c'], camera: new Set<string>(), pinned: null, active: null, hideNoCamera: false }

describe('회의방 보기 방식', () => {
  it('바둑판은 모두 같은 칸', () => {
    expect(arrange({ ...base, layout: 'grid' })).toEqual({ main: null, rest: [ME, 'a', 'b', 'c'] })
  })

  it('크게 보기: 고정 → 말한 사람 → 카메라 → 아무나', () => {
    expect(arrange({ ...base, layout: 'focus', pinned: 'c', active: 'b' }).main).toBe('c')
    expect(arrange({ ...base, layout: 'focus', active: 'b' })).toEqual({ main: 'b', rest: [ME, 'a', 'c'] })
    expect(arrange({ ...base, layout: 'focus', camera: new Set(['c']) }).main).toBe('c')
    expect(arrange({ ...base, layout: 'focus' }).main).toBe('a')
  })

  it('나간 사람을 고정했으면 무시', () => {
    expect(arrange({ ...base, layout: 'focus', pinned: 'z', active: 'b' }).main).toBe('b')
  })

  it('혼자면 나를 크게', () => {
    expect(arrange({ ...base, ids: [ME], layout: 'spotlight' })).toEqual({ main: ME, rest: [] })
  })

  it('카메라 끈 사람 숨기기 (나·고정한 사람은 남김)', () => {
    expect(arrange({ ...base, layout: 'grid', hideNoCamera: true, camera: new Set(['b']), pinned: 'c' }).rest).toEqual([ME, 'b', 'c'])
  })

  it('화면 공유를 크게 (고정이 먼저, 최근 공유가 먼저)', () => {
    const ids = [ME, 'a', screenId('a'), 'b', screenId('b')]
    const screens = [screenId('a'), screenId('b')]
    expect(arrange({ ...base, ids, screens, layout: 'focus', active: 'a' }).main).toBe(screenId('b'))
    expect(arrange({ ...base, ids, screens, layout: 'focus', pinned: 'a' }).main).toBe('a')
    expect(arrange({ ...base, ids, screens, layout: 'grid', hideNoCamera: true }).rest).toEqual([ME, screenId('a'), screenId('b')])
    expect(screenOwner(screenId('me'))).toBe('me')
    expect(screenOwner('a')).toBeNull()
  })
})
