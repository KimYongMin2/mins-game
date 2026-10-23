import { describe, expect, it } from 'vitest'
import { BANG_SHOW_MS, BLANK_SHOW_MS, INTRO_MS, SUSPENSE_MS, TURN_MS } from '../constants'
import { type EngineState, type Player, aliveIndexes, createEngine, engineReducer, nextAlive, ranksOf } from './engine'

const people = (n: number): Player[] => Array.from({ length: n }, (_, i) => ({ id: `p${i}`, name: `사람${i}`, kind: i === 0 ? 'user' : 'remote' }))

/** 시작해서 0번 차례, 총알이 chamber번째인 상태로 맞춘다 */
function start(n: number, chamber: number): EngineState {
  const s = engineReducer(createEngine({ now: 0, seed: 1, players: people(n) }), { type: 'tick', now: INTRO_MS })
  return { ...s, turn: 0, chamber, pulls: 0, aimAt: null }
}

const shoot = (s: EngineState, player: number, target: number) => {
  let next = engineReducer(s, { type: 'aim', player, target })
  next = engineReducer(next, { type: 'pull', player })
  const show = next.phase.kind === 'fire' && next.phase.fire.bang ? BANG_SHOW_MS : BLANK_SHOW_MS
  return engineReducer(next, { type: 'tick', now: next.now + SUSPENSE_MS + show })
}

describe('차례', () => {
  it('빈 칸이면 지목당한 사람 차례', () => {
    const s = shoot(start(3, 6), 0, 2)
    expect(s.turn).toBe(2)
    expect(s.pulls).toBe(1)
    expect(s.alive).toEqual([true, true, true])
  })

  it('나를 쐈는데 빈 칸이면 내가 한 번 더', () => {
    const s = shoot(start(3, 6), 0, 0)
    expect(s.turn).toBe(0)
    expect(s.phase.kind).toBe('aim')
  })

  it('남을 맞히면 그 사람 탈락, 총알 다시 넣고 쏜 사람이 계속', () => {
    const s = shoot(start(3, 1), 0, 2)
    expect(s.alive).toEqual([true, true, false])
    expect(s.turn).toBe(0)
    expect(s.pulls).toBe(0)
    expect(s.kills[0]).toBe(1)
  })

  it('나를 쏴서 죽으면 다음 자리 사람 차례', () => {
    const s = shoot(start(3, 1), 0, 0)
    expect(s.alive).toEqual([false, true, true])
    expect(s.turn).toBe(1)
    expect(s.kills[0]).toBe(0)
  })

  it('여섯 번째엔 꼭 나간다', () => {
    let s = start(2, 6)
    for (let k = 0; k < 5; k++) s = shoot(s, s.turn, s.turn)
    expect(s.pulls).toBe(5)
    s = shoot(s, s.turn, 1 - s.turn)
    expect(s.phase.kind).toBe('done')
  })

  it('차례가 아니면 못 쏘고, 시간이 지나면 골라 둔 사람을 쏜다', () => {
    let s = start(3, 6)
    s = engineReducer(s, { type: 'pull', player: 1, target: 0 })
    expect(s.phase.kind).toBe('aim')
    s = engineReducer(s, { type: 'aim', player: 0, target: 1 })
    s = engineReducer(s, { type: 'tick', now: s.now + TURN_MS })
    expect(s.phase.kind === 'fire' && s.phase.fire.target).toBe(1)
  })

  it('나간 사람 차례면 다음 자리로, 둘만 남다 나가면 끝', () => {
    let s = start(3, 6)
    s = engineReducer(s, { type: 'drop', player: 0 })
    expect(s.turn).toBe(1)
    s = engineReducer(s, { type: 'drop', player: 2 })
    expect(s.phase.kind).toBe('done')
    expect(ranksOf(s)).toEqual([3, 1, 2])
  })

  it('다음 자리는 탈락한 사람을 건너뛴다', () => {
    expect(nextAlive([true, false, false, true], 0)).toBe(3)
    expect(nextAlive([true, false, false, true], 3)).toBe(0)
  })
})

describe('봇끼리 끝까지', () => {
  it('2~8명 모두 한 명이 우승', () => {
    for (const n of [2, 3, 4, 5, 6, 7, 8]) {
      for (let seed = 1; seed <= 20; seed++) {
        const players: Player[] = Array.from({ length: n }, (_, i) => ({ id: `b${i}`, name: '', kind: 'bot' }))
        let s = createEngine({ now: 0, seed, players })
        let now = 0
        while (s.phase.kind !== 'done' && now < 2_000_000) {
          now += 50
          s = engineReducer(s, { type: 'tick', now })
        }
        expect(s.phase.kind).toBe('done')
        expect(aliveIndexes(s)).toHaveLength(1)
        expect(ranksOf(s).filter((r) => r === 1)).toHaveLength(1)
        expect(new Set(ranksOf(s)).size).toBe(n)
      }
    }
  })
})
