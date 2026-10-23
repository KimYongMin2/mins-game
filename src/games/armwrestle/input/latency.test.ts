import { describe, expect, it } from 'vitest'
import { inputKindOf, learnLatency } from './latency'

describe('입력 지연 보정', () => {
  it('늘 늦게 누르면 보정값이 그만큼으로 다가간다', () => {
    let v = 40
    // 실제 지연 80ms인 폰: 보정 뒤 남은 어긋남 = 80 - v
    for (let i = 0; i < 30; i++) v = learnLatency(v, 80 - v)
    expect(v).toBeCloseTo(80, 0)
  })

  it('너무 많이 어긋난 건(다른 지나감을 노림) 안 배운다', () => {
    expect(learnLatency(40, 300)).toBe(40)
    expect(learnLatency(40, -200)).toBe(40)
  })

  it('범위를 넘지 않는다', () => {
    let v = 110
    for (let i = 0; i < 20; i++) v = learnLatency(v, 140)
    expect(v).toBeLessThanOrEqual(120)
    expect(learnLatency(-25, -100)).toBeGreaterThanOrEqual(-30)
  })

  it('터치와 그 밖은 따로', () => {
    expect(inputKindOf('touch')).toBe('touch')
    expect(inputKindOf('mouse')).toBe('other')
    expect(inputKindOf('pen')).toBe('other')
  })
})
