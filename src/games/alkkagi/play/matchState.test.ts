import { describe, expect, it } from 'vitest'
import { MAX_SPEED, PICK_MS, REVEAL_MS, TURN_MS } from '../constants'
import { type MatchAction, type MatchState, createMatch, matchReducer, rollingMs, summarizeMatch } from './matchState'

const run = (s: MatchState, ...actions: MatchAction[]) => actions.reduce(matchReducer, s)
const tick = (now: number): MatchAction => ({ type: 'tick', now })

/** 봇전: 카드를 골라 공개가 끝난 상태 */
function started(seed: number, me: 'black' | 'white') {
  const s = createMatch({ now: 0, seed, mode: 'bot', difficulty: 'hard' })
  const card = me === 'black' ? s.blackCard : ((1 - s.blackCard) as 0 | 1)
  return run(s, { type: 'pick', card }, tick(REVEAL_MS))
}

/** t부터 끝(또는 조건)까지 시간을 흘린다 */
function until(s: MatchState, t: number, done: (s: MatchState) => boolean) {
  for (; !done(s) && t < 10_000_000; t += 50) s = run(s, tick(t))
  return { s, t }
}

describe('경기 진행', () => {
  it('흑 카드면 내가 먼저, 백이면 봇이 먼저', () => {
    expect(started(1, 'black')).toMatchObject({ turn: 0, black: 0, phase: { kind: 'aiming' } })
    expect(started(1, 'white')).toMatchObject({ turn: 1, black: 1 })
  })

  it('카드를 안 고르면 10초 뒤 무작위', () => {
    const s = run(createMatch({ now: 0, seed: 3, mode: 'bot', difficulty: 'normal' }), tick(PICK_MS))
    expect(s.phase.kind).toBe('reveal')
  })

  it('튕기면 굴러간 뒤 판이 바뀌고, 못 맞히면 봇 차례', () => {
    let s = started(2, 'black')
    // 옆으로 약하게: 아무것도 못 맞힘
    s = run(s, { type: 'shoot', index: 0, vx: 3, vy: 0 })
    expect(s.phase.kind).toBe('rolling')
    if (s.phase.kind !== 'rolling') return
    s = run(s, tick(REVEAL_MS + rollingMs(s.phase.result)))
    expect(s.turn).toBe(1)
    expect(s.stones[0].x).toBeGreaterThan(3)
  })

  it('상대 돌을 떨어뜨리고 내 돌이 남으면 한 번 더', () => {
    let s = started(3, 'black')
    // 0번 돌(아래 3, 11)에서 위쪽 같은 x의 상대 돌(3, 3)로 곧게: 맞은 돌이 밀려 떨어진다
    const target = s.stones.findIndex((x) => x.side === 1 && x.x === s.stones[0].x)
    expect(target).toBeGreaterThan(-1)
    s = run(s, { type: 'shoot', index: 0, vx: 0, vy: -MAX_SPEED * 0.85 })
    if (s.phase.kind !== 'rolling') throw new Error('rolling')
    expect(s.phase.outcome.kind).toBe('again')
    s = run(s, tick(REVEAL_MS + rollingMs(s.phase.result)))
    expect(s.turn).toBe(0)
  })

  it('남의 돌이나 떨어진 돌은 못 튕긴다', () => {
    const s = started(4, 'black')
    expect(run(s, { type: 'shoot', index: 7, vx: 1, vy: 0 }).phase.kind).toBe('aiming')
  })

  it('20초 안에 안 튕기면 약하게 저절로', () => {
    const s = run(started(5, 'black'), tick(REVEAL_MS + TURN_MS))
    expect(s.shots).toBe(1)
  })

  it('손을 놓아도 봇과 끝까지 간다', () => {
    const { s } = until(started(6, 'white'), REVEAL_MS, (x) => x.phase.kind === 'done')
    expect(s.phase.kind).toBe('done')
    expect(summarizeMatch(s).stone).toBe('white')
  })
})
