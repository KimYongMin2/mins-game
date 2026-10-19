import { describe, expect, it } from 'vitest'
import { DRAW_MS } from '../constants'
import { type RoundState, createRound, currentDistance, roundReducer, summarizeRound } from './roundState'
import { windDrift } from './wind'

// 난이도 확인용 시뮬레이션 (시드 50개 평균)
// - 대충: 조준 보정 없이 일정하게 당겼다 놓기만
// - 잘 쏨: 바람만큼 정확히 반대로 조준하고, 흔들림은 운에 맡김
function play(seed: number, holdMs: number, compensateWind: boolean): number {
  let s: RoundState = createRound(0, seed)
  let guard = 0
  while (s.phase.kind !== 'done') {
    if (++guard > 100000) throw new Error('끝나지 않음')
    if (s.phase.kind === 'ready') {
      s = roundReducer(s, { type: 'press', at: s.now })
      if (compensateWind) {
        const d = windDrift(s.wind, currentDistance(s))
        s = roundReducer(s, { type: 'aimBy', dx: -d.x, dy: -d.y })
      }
    }
    if (s.phase.kind === 'drawing' && s.now - s.phase.startedAt >= holdMs) s = roundReducer(s, { type: 'release', at: s.now })
    s = roundReducer(s, { type: 'tick', now: s.now + 16 })
  }
  return summarizeRound(s).points
}

function average(compensateWind: boolean) {
  const scores = Array.from({ length: 50 }, (_, i) => play(i + 1, DRAW_MS + 300 + ((i * 137) % 900), compensateWind))
  return { avg: scores.reduce((a, b) => a + b, 0) / scores.length, min: Math.min(...scores), max: Math.max(...scores) }
}

describe('난이도 균형', () => {
  it('대충 쏘면 낮고, 바람을 읽으면 확실히 높다', () => {
    const lazy = average(false)
    const good = average(true)
    console.log(`대충 평균 ${lazy.avg.toFixed(1)} (${lazy.min}~${lazy.max}) / 잘 쏨 평균 ${good.avg.toFixed(1)} (${good.min}~${good.max})`)
    expect(lazy.avg).toBeLessThan(75)
    expect(good.avg).toBeGreaterThan(80)
    expect(good.avg - lazy.avg).toBeGreaterThan(15)
  })
})
