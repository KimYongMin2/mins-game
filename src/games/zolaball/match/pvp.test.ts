import { describe, expect, it } from 'vitest'
import { INNINGS } from '../rules/game'
import { type MatchState, createMatch, isUserBatting, isUserPitching, matchReducer, summarize } from './matchState'
import { type BaseballMsg, actionOf, outbox } from './pvp'

const STEP = 5

type Plan = {
  /** 투수일 때 구종·높이 고르는 시점(선택 시작 후 ms). null이면 시간 초과까지 안 고름 */
  pickAfter: number | null
  /** 타자일 때 도착 시각 기준 스윙 시점(ms). null이면 안 휘두름 */
  swingOffset: (n: number) => number | null
}

/** 두 기기를 가짜 통신(latency)으로 이어 경기를 끝까지 돌린다 */
function simulate(latency: number, a: Plan, b: Plan) {
  let A = createMatch({ difficulty: 'normal', userSide: 'away', opponent: 'remote' }, 0, 1)
  let B = createMatch({ difficulty: 'normal', userSide: 'home', opponent: 'remote' }, 0, 2)
  const wire: { at: number; to: 'A' | 'B'; msg: BaseballMsg }[] = []
  const done = { A: new Set<string>(), B: new Set<string>() }
  let t = 0
  while ((A.phase.kind !== 'final' || B.phase.kind !== 'final') && t < 1_500_000) {
    t += STEP
    for (const w of wire.filter((x) => x.at <= t)) {
      wire.splice(wire.indexOf(w), 1)
      const action = actionOf(w.msg)
      if (!action) continue
      if (w.to === 'A') A = matchReducer(A, action)
      else B = matchReducer(B, action)
    }
    for (const who of ['A', 'B'] as const) {
      let s = who === 'A' ? A : B
      // 화면처럼 '지난번에 보낸 뒤의 모든 변화'를 비교한다 (고르기·스윙·tick 모두)
      const prev: MatchState = s
      const plan = who === 'A' ? a : b
      const { phase } = s
      if (phase.kind === 'choosing' && isUserPitching(s) && plan.pickAfter !== null) {
        const key = `p${s.pitchCount}`
        if (!done[who].has(key) && t - phase.startedAt >= plan.pickAfter) {
          done[who].add(key)
          s = matchReducer(s, { type: 'selectKey', key: (s.pitchCount % 4) + 1 as 1 | 2 | 3 | 4 })
          s = matchReducer(s, { type: 'selectHeight', height: s.pitchCount % 2 ? 'high' : 'low' })
        }
      }
      if (phase.kind === 'pitching' && isUserBatting(s)) {
        const key = `s${s.pitchCount}`
        const off = plan.swingOffset(s.pitchCount)
        if (off !== null && !done[who].has(key) && t >= phase.pitch.arriveAt + off) {
          done[who].add(key)
          s = matchReducer(s, { type: 'swing', at: phase.pitch.arriveAt + off })
        }
      }
      s = matchReducer(s, { type: 'tick', now: t })
      for (const msg of outbox(prev, s)) wire.push({ at: t + latency, to: who === 'A' ? 'B' : 'A', msg })
      if (who === 'A') A = s
      else B = s
    }
  }
  return { A, B }
}

const never: Plan = { pickAfter: 400, swingOffset: () => null }

describe('친구 대전 (야구)', () => {
  it('두 기기의 경기가 똑같이 흘러간다 (점수판·볼카운트 기록)', () => {
    const mixed = (n: number) => (n % 3 === 0 ? null : 40 - (n % 5) * 20)
    const { A, B } = simulate(120, { pickAfter: 400, swingOffset: (n) => (n % 7 < 2 ? 0 : mixed(n)) }, { pickAfter: 1200, swingOffset: mixed })
    expect(A.phase.kind).toBe('final')
    expect(B.phase.kind).toBe('final')
    expect(A.game.linescore).toEqual(B.game.linescore)
    expect(A.game.stats).toEqual(B.game.stats)
    expect(A.game.pitching).toEqual(B.game.pitching)
    expect(A.pitchCount).toBe(B.pitchCount)
    const a = summarize(A)
    const b = summarize(B)
    expect(a.mode).toBe('pvp')
    expect(a.userRuns).toBe(b.botRuns)
    expect(a.botRuns).toBe(b.userRuns)
  })

  it('정타를 친 쪽이 안 치는 쪽을 이기고, 양쪽 다 경기가 끝난다', () => {
    // 처음 몇 공만 정타로 치고 그 뒤엔 안 친다 (계속 홈런이면 3아웃이 안 나와 이닝이 안 끝난다)
    const { A, B } = simulate(80, { pickAfter: 400, swingOffset: (n) => (n < 4 ? 0 : null) }, never)
    expect(A.phase.kind).toBe('final')
    expect(B.phase.kind).toBe('final')
    expect(summarize(A).outcome).toBe('win')
    expect(summarize(B).outcome).toBe('lose')
    expect(A.game.linescore.away.length).toBe(INNINGS)
  })

  it('투수가 시간 안에 안 고르면 무작위로 던져도 양쪽이 같은 공을 본다', () => {
    const { A, B } = simulate(150, { pickAfter: null, swingOffset: () => 0 }, { pickAfter: null, swingOffset: () => null })
    expect(A.game.linescore).toEqual(B.game.linescore)
    expect(A.pitchCount).toBe(B.pitchCount)
  })
})
