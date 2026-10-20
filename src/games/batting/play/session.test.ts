import { describe, expect, it } from 'vitest'
import { TOTAL_PITCHES } from '../constants'
import type { Cell } from '../rules/judge'
import { type SessionState, createSession, sessionReducer, summarizeSession } from './session'

const STEP = 5

/** 경기를 끝까지 돌린다. batter가 공을 보고 언제 어디를 칠지 정한다 */
function play(seed: number, batter: (s: SessionState) => { cell: Cell; at: number } | null, hand: 'right' | 'left' = 'right') {
  let s = createSession({ now: 0, seed, difficulty: 'normal', hand })
  let t = 0
  let swungFor = -1
  while (s.phase.kind !== 'done' && t < 120_000) {
    t += STEP
    const { phase } = s
    if (phase.kind === 'pitching' && swungFor !== s.index) {
      const plan = batter(s)
      if (plan && t >= plan.at) {
        s = sessionReducer(s, { type: 'swing', cell: plan.cell, at: plan.at })
        swungFor = s.index
      }
    }
    s = sessionReducer(s, { type: 'tick', now: t })
  }
  return s
}

const pitchOf = (s: SessionState) => (s.phase.kind === 'pitching' ? s.phase.pitch : null)

describe('10구 경기', () => {
  it('안 치면 10구 모두 스트라이크, 0점', () => {
    const s = play(1, () => null)
    expect(s.records).toHaveLength(TOTAL_PITCHES)
    expect(s.records.every((r) => r.outcome === 'looking')).toBe(true)
    expect(summarizeSession(s).points).toBe(0)
  })

  it('들어오는 칸을 정확한 타이밍에 치면 모두 홈런, 100점', () => {
    const s = play(2, (st) => {
      const p = pitchOf(st)!
      return { cell: p.cell, at: p.arriveAt }
    })
    expect(s.records.map((r) => r.outcome)).toEqual(Array(TOTAL_PITCHES).fill('homerun'))
    expect(summarizeSession(s)).toMatchObject({ points: 100, homeruns: 10, hits: 10 })
  })

  it('좌타도 같은 칸을 맞히면 홈런', () => {
    const s = play(3, (st) => ({ cell: pitchOf(st)!.cell, at: pitchOf(st)!.arriveAt }), 'left')
    expect(summarizeSession(s).homeruns).toBe(10)
  })

  it('너무 일찍 치면 헛스윙, 공은 미트까지 간 뒤 다음 공', () => {
    const s = play(4, (st) => ({ cell: pitchOf(st)!.cell, at: pitchOf(st)!.releaseAt + 10 }))
    expect(s.records.every((r) => r.outcome === 'whiff')).toBe(true)
    expect(s.records).toHaveLength(TOTAL_PITCHES)
  })

  it('늦게 치면 기록에 늦은 만큼 남는다', () => {
    const s = play(5, (st) => ({ cell: pitchOf(st)!.cell, at: pitchOf(st)!.arriveAt + 45 }))
    expect(s.records.every((r) => r.outcome === 'double' && r.offsetMs === 45)).toBe(true)
  })

  it('와인드업 중 터치와 두 번째 스윙은 무시', () => {
    let s = createSession({ now: 0, seed: 6, difficulty: 'normal', hand: 'right' })
    let t = 0
    while (s.phase.kind !== 'windup') s = sessionReducer(s, { type: 'tick', now: (t += STEP) })
    expect(sessionReducer(s, { type: 'swing', cell: 5, at: t })).toBe(s)
    while (s.phase.kind !== 'pitching') s = sessionReducer(s, { type: 'tick', now: (t += STEP) })
    const p = pitchOf(s)!
    s = sessionReducer(s, { type: 'swing', cell: p.cell, at: p.releaseAt })
    expect(s.phase).toMatchObject({ kind: 'pitching', record: { outcome: 'whiff' } })
    expect(sessionReducer(s, { type: 'swing', cell: p.cell, at: p.arriveAt })).toBe(s)
  })

  it('같은 시드면 같은 공이 온다', () => {
    const cells = (seed: number) => play(seed, () => null).records.map((r) => `${r.pitch.type}${r.pitch.cell}`)
    expect(cells(9)).toEqual(cells(9))
    expect(cells(9)).not.toEqual(cells(10))
  })
})
