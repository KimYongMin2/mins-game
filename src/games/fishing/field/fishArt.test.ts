import { describe, expect, it } from 'vitest'
import { FISH } from '../play/fish'
import { fishSvg } from './fishArt'

describe('물고기 그림', () => {
  it('모든 물고기·꽝이 그려지고, 이로치는 필터가 붙음', () => {
    for (const f of FISH) {
      const svg = fishSvg(f.id)
      expect(svg.startsWith('<svg'), f.id).toBe(true)
      expect(svg.length, f.id).toBeGreaterThan(300)
    }
    expect(fishSvg('redbream', 'gold')).toContain('url(#iro-gold)')
    expect(fishSvg('nope')).toBe('')
  })
})
