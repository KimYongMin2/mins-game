import { describe, expect, it } from 'vitest'
import { PASS_MS } from '../constants'
import { measureLatency, tapError } from './calibrate'
import { inputKindOf } from './latency'

describe('타이밍 맞추기', () => {
  it('가장 가까운 가운데 지남 기준으로 어긋남을 잰다', () => {
    expect(tapError(0.5 * PASS_MS + 60)).toBeCloseTo(60)
    expect(tapError(3.5 * PASS_MS - 30)).toBeCloseTo(-30)
    // 엉뚱한 때(가운데에서 멀리)는 안 셈
    expect(tapError(PASS_MS)).toBeNull()
  })

  it('중앙값이라 한두 번 실수는 무시된다', () => {
    expect(measureLatency([70, 75, 80, 65, 72, 78, 74, -150, 190, 71])).toBe(73)
  })

  it('보정값 범위를 넘지 않는다', () => {
    expect(measureLatency([500, 500, 500])).toBeLessThanOrEqual(200)
  })

  it('터치와 그 밖은 따로', () => {
    expect(inputKindOf('touch')).toBe('touch')
    expect(inputKindOf('mouse')).toBe('other')
  })
})
