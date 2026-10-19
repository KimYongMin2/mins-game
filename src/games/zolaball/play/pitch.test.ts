import { describe, expect, it } from 'vitest'
import { type PitchCall, STRIKE_ZONE, ballPosition, createPitch, pitchEndAt } from './pitch'

const call = (over: Partial<PitchCall> = {}): PitchCall => ({
  type: 'fastball',
  isBall: false,
  height: 'high',
  ...over,
})

describe('createPitch', () => {
  it('변화구는 직구보다 느리다', () => {
    const fast = createPitch(call({ type: 'fastball' }), 0)
    const breaking = createPitch(call({ type: 'breaking' }), 0)
    expect(breaking.arriveAt - fast.arriveAt).toBeGreaterThan(100)
  })

  it('높은 공은 낮은 공보다 조금 빨리 도착한다', () => {
    const high = createPitch(call({ height: 'high' }), 0)
    const low = createPitch(call({ height: 'low' }), 0)
    expect(high.arriveAt).toBeLessThan(low.arriveAt)
    expect(low.arriveAt - high.arriveAt).toBeLessThan(60)
  })

  it('높은 직구 볼은 높은 변화구 볼보다 더 높게, 낮은 변화구 볼은 낮은 직구 볼보다 더 낮게', () => {
    const h = (type: 'fastball' | 'breaking', height: 'high' | 'low') =>
      createPitch(call({ type, isBall: true, height }), 0).plateHeight
    expect(h('fastball', 'high')).toBeGreaterThan(h('breaking', 'high'))
    expect(h('breaking', 'low')).toBeLessThan(h('fastball', 'low'))
  })

  it('볼은 존 위나 아래로, 스트라이크는 존 안으로', () => {
    expect(createPitch(call({ isBall: true, height: 'high' }), 0).plateHeight).toBeGreaterThan(STRIKE_ZONE.top)
    expect(createPitch(call({ isBall: true, height: 'low' }), 0).plateHeight).toBeLessThan(STRIKE_ZONE.bottom)
    for (const height of ['high', 'low'] as const) {
      const h = createPitch(call({ height }), 0).plateHeight
      expect(h).toBeGreaterThanOrEqual(STRIKE_ZONE.bottom)
      expect(h).toBeLessThanOrEqual(STRIKE_ZONE.top)
    }
  })
})

describe('ballPosition', () => {
  it.each([
    ['fastball', false, 'high'],
    ['fastball', true, 'low'],
    ['breaking', false, 'low'],
    ['breaking', true, 'high'],
  ] as const)('%s isBall=%s %s: 도착 시점에 홈플레이트, 정해진 높이', (type, isBall, height) => {
    const p = createPitch({ type, isBall, height }, 1000)
    const pos = ballPosition(p, p.arriveAt)!
    expect(pos.x).toBeCloseTo(0)
    expect(pos.y).toBeCloseTo(p.plateHeight)
  })

  it('던지기 전에는 공이 없다', () => {
    const p = createPitch(call(), 1000)
    expect(ballPosition(p, 999)).toBeNull()
  })

  it('변화구는 직구보다 늦게 떨어진다 (중간 지점에서 더 높다)', () => {
    const fast = createPitch(call({ type: 'fastball', height: 'low' }), 0)
    const breaking = createPitch(call({ type: 'breaking', height: 'low' }), 0)
    const mid = (p: typeof fast) => ballPosition(p, p.releaseAt + (p.arriveAt - p.releaseAt) * 0.6)!.y
    expect(mid(breaking)).toBeGreaterThan(mid(fast))
  })

  it('홈플레이트를 지나면 포수 위치에서 멈추고 땅 아래로 가지 않는다', () => {
    const p = createPitch(call({ type: 'breaking', isBall: true, height: 'low' }), 0)
    const a = ballPosition(p, pitchEndAt(p) - 50)!
    const b = ballPosition(p, pitchEndAt(p))!
    expect(a).toEqual(b)
    expect(b.x).toBeLessThan(0)
    expect(b.y).toBeGreaterThan(0)
  })
})
