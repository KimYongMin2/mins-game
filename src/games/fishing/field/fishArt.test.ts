import { describe, expect, it } from 'vitest'
import { FISH } from '../play/fish'
import { dedupeAttrs, fishImageUrl, fishSvg } from './fishArt'

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

  it('3D용 그림 파일엔 같은 속성이 두 번 없음 (XML 오류 막기)', () => {
    expect(dedupeAttrs('<path a="1" b="2" a="3"/>')).toBe('<path a="1" b="2" />')
    for (const f of FISH) {
      const svg = decodeURIComponent(fishImageUrl(f.id, 'gold').split(',').slice(1).join(','))
      for (const tag of svg.match(/<[a-zA-Z][^>]*>/g) ?? []) {
        const names = (tag.match(/\s([\w:-]+)="/g) ?? []).map((x) => x.trim())
        expect(new Set(names).size, `${f.id}: ${tag.slice(0, 60)}`).toBe(names.length)
      }
    }
  })
})
