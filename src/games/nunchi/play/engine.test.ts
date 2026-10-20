import { describe, expect, it } from 'vitest'
import { CALL_MS, COLLIDE_MS, COUNTDOWN_MS, RESULT_MS, RPS_PICK_MS, RPS_REVEAL_MS } from '../constants'
import { type EngineState, type Player, type PlayerKind, collidedOf, createEngine, engineReducer, ranksOf } from './engine'

const players = (...kinds: PlayerKind[]): Player[] => kinds.map((kind, i) => ({ id: `p${i}`, name: `사람${i}`, kind }))
const at = (s: EngineState, now: number) => engineReducer(s, { type: 'tick', now })
const press = (s: EngineState, player: number, now: number) => engineReducer(at(s, now), { type: 'press', player })
const calling = (n: number) => at(createEngine({ now: 0, seed: 1, players: players('user', ...Array<PlayerKind>(n - 1).fill('remote')) }), COUNTDOWN_MS)
const T = COUNTDOWN_MS

describe('collidedOf', () => {
  it(`${COLLIDE_MS}ms 안에 누른 사람들만`, () => {
    const c = collidedOf([
      { player: 0, at: 1000 },
      { player: 1, at: 1000 + COLLIDE_MS },
      { player: 2, at: 2000 },
    ])
    expect([...c].sort()).toEqual([0, 1])
  })
})

describe('외치기', () => {
  it('차례대로 누르면 마지막 한 명이 탈락', () => {
    let s = calling(4)
    s = press(s, 2, T + 500)
    s = press(s, 0, T + 1500)
    s = press(s, 3, T + 2500)
    expect(s.phase.kind).toBe('call')
    s = at(s, T + 2500 + COLLIDE_MS + 1)
    expect(s.phase).toMatchObject({ kind: 'result', losers: [{ player: 1, reason: 'last' }], replay: false })
  })

  it('겹치면 그 자리에서 판이 끝나고 겹친 사람만 탈락, 남은 사람끼리 1부터 다시', () => {
    let s = calling(5)
    s = press(s, 0, T + 500)
    s = press(s, 1, T + 1500)
    s = press(s, 2, T + 1600)
    s = at(s, T + 1600 + COLLIDE_MS)
    expect(s.phase.kind).toBe('call')
    s = at(s, T + 1600 + COLLIDE_MS + 1)
    expect(s.phase.kind).toBe('result')
    if (s.phase.kind !== 'result') return
    expect(s.phase.losers.map((l) => l.player).sort()).toEqual([1, 2])
    s = at(s, s.now + RESULT_MS)
    expect(s.phase.kind).toBe('countdown')
    expect(s.alive).toEqual([true, false, false, true, true])
    s = at(s, s.now + COUNTDOWN_MS)
    expect(s.presses).toEqual([])
  })

  it('셋이 겹치면 셋 다', () => {
    let s = calling(5)
    s = press(s, 0, T + 1000)
    s = press(s, 1, T + 1200)
    s = press(s, 2, T + 1400)
    s = at(s, T + 1400 + COLLIDE_MS + 1)
    if (s.phase.kind !== 'result') throw new Error()
    expect(s.phase.losers.map((l) => l.player).sort()).toEqual([0, 1, 2])
  })

  it('한 판에 한 번만 누를 수 있다', () => {
    const s = press(calling(3), 0, T + 100)
    expect(engineReducer(s, { type: 'press', player: 0 })).toBe(s)
  })

  it('10초가 지나면 안 누른 사람 모두 탈락', () => {
    let s = calling(5)
    s = press(s, 0, T + 500)
    s = press(s, 1, T + 3000)
    s = at(s, T + CALL_MS)
    if (s.phase.kind !== 'result') throw new Error()
    expect(s.phase.losers).toEqual([2, 3, 4].map((player) => ({ player, reason: 'timeout' })))
  })

  it('모두 겹쳐서 다 탈락하게 되면 그 판은 다시', () => {
    let s = calling(3)
    s = press(s, 0, T + 500)
    s = press(s, 1, T + 600)
    s = press(s, 2, T + 700)
    s = at(s, T + 700 + COLLIDE_MS + 1)
    expect(s.phase).toMatchObject({ kind: 'result', losers: [], replay: true })
    s = at(s, s.now + RESULT_MS)
    expect(s.phase.kind).toBe('countdown')
    expect(s.alive.every(Boolean)).toBe(true)
  })
})

describe('결승 가위바위보', () => {
  function final() {
    let s = calling(3)
    s = press(s, 0, T + 500)
    s = press(s, 1, T + 1500)
    s = at(s, T + 1500 + COLLIDE_MS + 1)
    s = at(s, s.now + RESULT_MS)
    return s
  }

  it('두 명 남으면 가위바위보, 이긴 쪽이 우승', () => {
    let s = final()
    expect(s.phase.kind).toBe('rps')
    s = engineReducer(s, { type: 'pick', player: 0, hand: 'rock' })
    s = engineReducer(s, { type: 'pick', player: 1, hand: 'scissors' })
    s = at(s, s.now + RPS_PICK_MS)
    expect(s.phase).toMatchObject({ kind: 'reveal', winner: 0 })
    s = at(s, s.now + RPS_REVEAL_MS)
    expect(s.phase.kind).toBe('done')
    expect(ranksOf(s)).toEqual([1, 2, 3])
  })

  it('비기면 다시, 안 고르면 무작위', () => {
    let s = final()
    s = engineReducer(s, { type: 'pick', player: 0, hand: 'paper' })
    s = engineReducer(s, { type: 'pick', player: 1, hand: 'paper' })
    s = at(s, s.now + RPS_PICK_MS)
    expect(s.phase).toMatchObject({ kind: 'reveal', winner: null })
    s = at(s, s.now + RPS_REVEAL_MS)
    expect(s.phase.kind).toBe('rps')
    s = at(s, s.now + RPS_PICK_MS)
    expect(s.phase.kind).toBe('reveal')
    if (s.phase.kind === 'reveal') expect(Object.keys(s.phase.hands)).toHaveLength(2)
  })
})

describe('경기 전체', () => {
  it('봇끼리 끝까지: 우승 한 명, 같은 판에 탈락하면 같은 등수 (한 판에 여럿이 떨어져 한 명만 남으면 결승 없이 우승)', () => {
    for (let seed = 0; seed < 20; seed++) {
      let s = createEngine({ now: 0, seed, players: players('bot', 'bot', 'bot', 'bot', 'bot', 'bot') })
      for (let now = 0; now < 300_000 && s.phase.kind !== 'done'; now += 16) s = at(s, now)
      expect(s.phase.kind).toBe('done')
      const ranks = ranksOf(s)
      expect(ranks.filter((r) => r === 1)).toHaveLength(1)
      for (const group of s.out) expect(new Set(group.map((i) => ranks[i])).size).toBe(1)
    }
  })

  it('친구가 나가면 탈락, 결승 중이면 남은 사람이 우승', () => {
    let s = calling(4)
    s = engineReducer(s, { type: 'drop', player: 3 })
    expect(s.alive[3]).toBe(false)
    expect(s.phase.kind).toBe('countdown')
    s = engineReducer(s, { type: 'drop', player: 2 })
    expect(s.phase.kind).toBe('rps')
    s = engineReducer(s, { type: 'drop', player: 1 })
    expect(s.phase.kind).toBe('done')
    expect(ranksOf(s)[0]).toBe(1)
  })
})
