import { describe, expect, it } from 'vitest'
import { ME, arrange } from './layout'

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
})
