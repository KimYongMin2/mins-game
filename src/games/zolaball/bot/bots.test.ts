import { describe, expect, it } from 'vitest'
import type { PitchCall, PitchType } from '../play/pitch'
import { createRng } from '../play/random'
import { type Difficulty, type SwingResult, judgeSwing } from '../rules/judge'
import { botDecideSwing } from './batterBot'
import { botChoosePitch } from './pitcherBot'

const N = 20000
const FRESH = { balls: 0, strikes: 0 }

function strikeRate(difficulty: Difficulty, count = FRESH, recent: PitchType[] = []) {
  const rng = createRng(1)
  let strikes = 0
  for (let i = 0; i < N; i++) if (!botChoosePitch(difficulty, count, recent, rng).isBall) strikes++
  return strikes / N
}

function batterResults(difficulty: Difficulty, pitch: PitchCall, recent: PitchType[] = [], count = FRESH) {
  const rng = createRng(2)
  const counts: Record<SwingResult | 'take', number> = {
    homerun: 0, double: 0, single: 0, out: 0, foul: 0, miss: 0, take: 0,
  }
  for (let i = 0; i < N; i++) {
    const s = botDecideSwing(difficulty, pitch, count, recent, rng)
    if (!s.swing) counts.take++
    else counts[judgeSwing({ diffMs: s.diffMs, difficulty: 'normal', pitchIsBall: pitch.isBall })]++
  }
  const rate = (k: keyof typeof counts) => counts[k] / N
  return {
    swing: 1 - rate('take'),
    solid: rate('homerun') + rate('double') + rate('single') + rate('out'),
    hit: rate('homerun') + rate('double') + rate('single'),
    miss: rate('miss'),
  }
}

const strike: PitchCall = { type: 'fastball', isBall: false, height: 'high' }
const ball: PitchCall = { type: 'fastball', isBall: true, height: 'low' }

describe('봇 투수', () => {
  it('일반: 스트라이크 약 60%', () => {
    expect(strikeRate('normal')).toBeCloseTo(0.6, 1)
  })

  it('어려움: 3볼이면 스트라이크, 2스트라이크면 유인구가 늘어난다', () => {
    expect(strikeRate('hard', { balls: 3, strikes: 1 })).toBeGreaterThan(0.8)
    expect(strikeRate('hard', { balls: 0, strikes: 2 })).toBeLessThan(0.45)
  })

  it('어려움: 같은 구종을 두 번 던졌으면 대체로 바꾼다', () => {
    const rng = createRng(3)
    let switched = 0
    for (let i = 0; i < N; i++) {
      if (botChoosePitch('hard', FRESH, ['fastball', 'fastball'], rng).type === 'breaking') switched++
    }
    expect(switched / N).toBeGreaterThan(0.7)
  })
})

describe('봇 타자', () => {
  it('일반: 스트라이크의 약 50%를 정타(페어 타구)로 만든다', () => {
    expect(batterResults('normal', strike).solid).toBeCloseTo(0.5, 1)
  })

  it('일반: 볼에도 자주 스윙한다', () => {
    expect(batterResults('normal', ball).swing).toBeGreaterThan(0.4)
  })

  it('어려움: 볼을 잘 참는다', () => {
    expect(batterResults('hard', ball).swing).toBeLessThan(0.2)
  })

  it('어려움: 같은 구종이 반복되면 더 잘 친다', () => {
    const first = batterResults('hard', strike, ['breaking'])
    const repeated = batterResults('hard', strike, ['fastball', 'fastball'])
    expect(repeated.hit).toBeGreaterThan(first.hit + 0.05)
    expect(repeated.miss).toBeLessThan(first.miss)
  })

  it('볼에 스윙하면 결과가 한 단계 낮아져 안타가 줄어든다', () => {
    const onStrike = batterResults('normal', strike)
    const onBall = batterResults('normal', ball)
    expect(onBall.hit / onBall.swing).toBeLessThan(onStrike.hit / onStrike.swing)
  })
})
