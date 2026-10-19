import { describe, expect, it } from 'vitest'
import { DRAW_MS } from '../constants'
import { type RoundState, createRound, roundReducer, summarizeRound } from './roundState'

// 난이도 확인용: 아무 보정 없이 일정하게 당겼다 놓기만 하면 몇 점이 나오는지
function lazyGame(seed: number, holdMs: number): number {
  let s: RoundState = createRound(0, seed)
  let guard = 0
  while (s.phase.kind !== 'done') {
    if (++guard > 100000) throw new Error('끝나지 않음')
    if (s.phase.kind === 'ready') s = roundReducer(s, { type: 'press', at: s.now })
    if (s.phase.kind === 'drawing' && s.now - s.phase.startedAt >= holdMs) s = roundReducer(s, { type: 'release', at: s.now })
    s = roundReducer(s, { type: 'tick', now: s.now + 16 })
  }
  return summarizeRound(s).points
}

describe('난이도 균형', () => {
  // 지금 기준(바람은 기획대로)으로는 보정 없이도 80점대가 나온다. 더 어렵게 할지는 플레이해 보고 정한다.
  it('조준 보정 없이 쏘기만 하면 평균 90점 미만', () => {
    const scores = Array.from({ length: 50 }, (_, i) => lazyGame(i + 1, DRAW_MS + 300))
    const avg = scores.reduce((a, b) => a + b, 0) / scores.length
    console.log(`보정 없음 평균 ${avg.toFixed(1)}점 (최저 ${Math.min(...scores)}, 최고 ${Math.max(...scores)})`)
    expect(avg).toBeLessThan(90)
  })
})
