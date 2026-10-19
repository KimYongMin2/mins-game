import { describe, expect, it } from 'vitest'
import { SWING_DURATION_MS } from '../constants'
import { pitchEndAt } from '../play/pitch'
import { type PracticeState, initialPracticeState, practiceReducer } from './practiceState'

function pitched(isBall = false): PracticeState {
  return practiceReducer(initialPracticeState(0), {
    type: 'pitch',
    releaseAt: 1000,
    call: { type: 'fastball', isBall, height: 'low' },
  })
}

describe('practiceReducer', () => {
  it('공 도착 시점에 스윙하면 홈런', () => {
    const s = pitched()
    const after = practiceReducer(s, { type: 'swing', at: s.pitch!.arriveAt, difficulty: 'normal' })
    expect(after.outcome).toEqual({ kind: 'swing', result: 'homerun', diffMs: 0 })
    expect(after.contact).toBe(true)
  })

  it('늦은 스윙은 diffMs가 양수', () => {
    const s = pitched()
    const after = practiceReducer(s, { type: 'swing', at: s.pitch!.arriveAt + 60, difficulty: 'normal' })
    expect(after.outcome).toEqual({ kind: 'swing', result: 'single', diffMs: 60 })
  })

  it('투구당 판정은 한 번뿐', () => {
    const s = pitched()
    const first = practiceReducer(s, { type: 'swing', at: s.pitch!.arriveAt + 300, difficulty: 'normal' })
    const second = practiceReducer(first, {
      type: 'swing',
      at: s.pitch!.arriveAt + 300 + SWING_DURATION_MS,
      difficulty: 'normal',
    })
    expect(second.outcome).toEqual(first.outcome)
  })

  it('공을 던지기 전 스윙은 판정하지 않는다', () => {
    const s = pitched()
    const after = practiceReducer(s, { type: 'swing', at: 500, difficulty: 'normal' })
    expect(after.swung).toBe(false)
    expect(after.outcome).toBeNull()
  })

  it('스윙하지 않으면 투구 종료 때 볼/스트라이크', () => {
    const strike = pitched(false)
    expect(practiceReducer(strike, { type: 'tick', now: pitchEndAt(strike.pitch!) }).outcome).toEqual({
      kind: 'take',
      call: 'strike',
    })
    const ball = pitched(true)
    const ended = practiceReducer(ball, { type: 'tick', now: pitchEndAt(ball.pitch!) })
    expect(ended.outcome).toEqual({ kind: 'take', call: 'ball' })
    expect(ended.pitch).toBeNull()
  })

  it('투구 종료 전에는 공이 남아 있다', () => {
    const s = pitched()
    const t = practiceReducer(s, { type: 'tick', now: pitchEndAt(s.pitch!) - 1 })
    expect(t.pitch).not.toBeNull()
    expect(t.outcome).toBeNull()
  })
})
