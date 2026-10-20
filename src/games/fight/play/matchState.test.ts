import { describe, expect, it } from 'vitest'
import { CHOOSE_MS, INTRO_MS, MAX_TURNS, REVEAL_MS } from '../constants'
import type { Stance } from '../rules/turn'
import { type MatchState, createMatch, matchReducer, summarizeMatch } from './matchState'

const STEP = 20

/** 경기를 끝까지 돌린다. plan이 턴마다 내 자세를 정한다 (null이면 안 고름) */
function play(seed: number, plan: (s: MatchState) => Stance | null, difficulty: 'normal' | 'hard' = 'normal') {
  let s = createMatch({ now: 0, seed, difficulty })
  let t = 0
  let pickedTurn = -1
  while (s.phase.kind !== 'done' && t < 600_000) {
    t += STEP
    if (s.phase.kind === 'choosing' && pickedTurn !== s.turns.length) {
      const stance = plan(s)
      if (stance) s = matchReducer(s, { type: 'pick', side: 0, stance })
      pickedTurn = s.turns.length
    }
    s = matchReducer(s, { type: 'tick', now: t })
  }
  return s
}

describe('경기 진행', () => {
  it('시작 → 고르기 2초 → 공개 → 다음 턴', () => {
    let s = createMatch({ now: 0, seed: 1, difficulty: 'normal' })
    s = matchReducer(s, { type: 'tick', now: INTRO_MS })
    expect(s.phase).toMatchObject({ kind: 'choosing', until: INTRO_MS + CHOOSE_MS })
    s = matchReducer(s, { type: 'pick', side: 0, stance: 'guard' })
    s = matchReducer(s, { type: 'tick', now: INTRO_MS + CHOOSE_MS })
    expect(s.phase.kind).toBe('reveal')
    expect(s.turns[0].stances[0]).toBe('guard')
    s = matchReducer(s, { type: 'tick', now: INTRO_MS + CHOOSE_MS + REVEAL_MS })
    expect(s.phase.kind).toBe('choosing')
  })

  it('고르는 동안 바꿀 수 있고 마지막 것이 들어간다. 안 고르면 준비', () => {
    let s = matchReducer(createMatch({ now: 0, seed: 2, difficulty: 'normal' }), { type: 'tick', now: INTRO_MS })
    s = matchReducer(s, { type: 'pick', side: 0, stance: 'guard' })
    s = matchReducer(s, { type: 'pick', side: 0, stance: 'ready' })
    s = matchReducer(s, { type: 'tick', now: INTRO_MS + CHOOSE_MS })
    expect(s.turns[0].stances[0]).toBe('ready')

    const idle = play(3, () => null)
    expect(idle.turns.every((t) => t.stances[0] === 'ready')).toBe(true)
  })

  it('스택 없이 타격은 못 고르고, 봇 자리는 못 고른다', () => {
    const s = matchReducer(createMatch({ now: 0, seed: 4, difficulty: 'normal' }), { type: 'tick', now: INTRO_MS })
    expect(matchReducer(s, { type: 'pick', side: 0, stance: 'attack' })).toBe(s)
    expect(matchReducer(s, { type: 'pick', side: 1, stance: 'guard' })).toBe(s)
  })

  it('준비만 하면 결국 봇에게 진다', () => {
    const s = play(5, () => 'ready')
    expect(summarizeMatch(s)).toMatchObject({ outcome: 'lose', life: [0, 3] })
  })

  it('방어만 하면 안 지지만 턴 제한에 걸린다', () => {
    const s = play(6, () => 'guard', 'hard')
    expect(s.turns).toHaveLength(MAX_TURNS)
    expect(summarizeMatch(s).life[0]).toBe(3)
  })

  it('봇의 고른 것을 보고 이기는 자세를 고르면 이긴다', () => {
    const s = play(7, (st) => {
      if (st.phase.kind !== 'choosing') return null
      const bot = st.phase.picks[1]!
      const me = st.fighters[0]
      if (bot === 'attack') return 'guard'
      if (bot === 'ready' && me.stacks > 0) return 'attack'
      return 'ready'
    })
    expect(summarizeMatch(s)).toMatchObject({ outcome: 'win' })
    expect(summarizeMatch(s).strikes).toBe(3)
  })

  it('같은 시드면 봇이 똑같이 둔다', () => {
    const moves = (seed: number) => play(seed, () => 'guard').turns.map((t) => t.stances[1]).join()
    expect(moves(11)).toBe(moves(11))
  })
})
