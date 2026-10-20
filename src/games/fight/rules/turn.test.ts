import { describe, expect, it } from 'vitest'
import { MAX_TURNS } from '../constants'
import { FRESH, type Fighter, type Stance, canChoose, resolveTurn, winnerOf } from './turn'

const f = (life: number, stacks: number): Fighter => ({ life, stacks })

describe('canChoose', () => {
  it('타격은 스택이 있어야 고를 수 있다', () => {
    expect(canChoose(f(3, 0), 'attack')).toBe(false)
    expect(canChoose(f(3, 1), 'attack')).toBe(true)
    expect(canChoose(f(3, 0), 'ready')).toBe(true)
    expect(canChoose(f(3, 0), 'guard')).toBe(true)
  })
})

describe('resolveTurn', () => {
  const turn = (a: Fighter, sa: Stance, b: Fighter, sb: Stance) => resolveTurn([a, b], [sa, sb])

  it('준비는 스택 +1, 최대 3', () => {
    const r = turn(f(3, 0), 'ready', f(3, 3), 'ready')
    expect(r.fighters).toEqual([f(3, 1), f(3, 3)])
    expect(r.events).toEqual(['charge', 'charge-full'])
  })

  it('준비 중에 맞으면 생명력 −1, 스택은 안 쌓임. 친 쪽은 스택 소모', () => {
    const r = turn(f(3, 1), 'ready', f(3, 1), 'attack')
    expect(r.fighters).toEqual([f(2, 1), f(3, 0)])
    expect(r.events).toEqual(['hurt', 'strike'])
  })

  it('방어는 타격을 막는다 (친 쪽 스택만 소모)', () => {
    const r = turn(f(3, 2), 'attack', f(3, 0), 'guard')
    expect(r.fighters).toEqual([f(3, 1), f(3, 0)])
    expect(r.events).toEqual(['blocked', 'block'])
  })

  it('타격끼리는 상쇄 (둘 다 스택만 소모)', () => {
    const r = turn(f(2, 1), 'attack', f(3, 2), 'attack')
    expect(r.fighters).toEqual([f(2, 0), f(3, 1)])
    expect(r.events).toEqual(['clash', 'clash'])
  })

  it('방어끼리, 방어 vs 준비는 준비한 쪽만 +1', () => {
    expect(turn(f(3, 0), 'guard', f(3, 0), 'guard').fighters).toEqual([f(3, 0), f(3, 0)])
    const r = turn(f(3, 0), 'guard', f(3, 0), 'ready')
    expect(r.fighters).toEqual([f(3, 0), f(3, 1)])
    expect(r.events).toEqual(['guard', 'charge'])
  })

  it('스택 없이 타격을 고르면 준비로 바뀐다', () => {
    const r = turn(f(3, 0), 'attack', f(3, 0), 'guard')
    expect(r.stances).toEqual(['ready', 'guard'])
    expect(r.fighters[0]).toEqual(f(3, 1))
  })

  it('생명력은 0 밑으로 안 내려간다', () => {
    expect(turn(f(0, 0), 'ready', f(3, 1), 'attack').fighters[0].life).toBe(0)
  })
})

describe('강타', () => {
  const turn = (a: Fighter, sa: Stance, b: Fighter, sb: Stance) => resolveTurn([a, b], [sa, sb])

  it('스택 3개가 있어야 고를 수 있고, 3개를 모두 쓴다', () => {
    expect(canChoose(f(3, 2), 'smash')).toBe(false)
    expect(canChoose(f(3, 3), 'smash')).toBe(true)
    expect(turn(f(3, 3), 'smash', f(3, 0), 'ready').fighters[0].stacks).toBe(0)
  })

  it('방어를 뚫는다', () => {
    const r = turn(f(3, 3), 'smash', f(3, 1), 'guard')
    expect(r.events).toEqual(['smash-hit', 'pierced'])
    expect(r.fighters).toEqual([f(3, 0), f(2, 1)])
  })

  it('타격과 부딪히면 강타가 이긴다 (타격한 쪽도 스택은 씀)', () => {
    const r = turn(f(3, 3), 'smash', f(3, 2), 'attack')
    expect(r.events).toEqual(['smash-hit', 'overpowered'])
    expect(r.fighters).toEqual([f(3, 0), f(2, 1)])
  })

  it('준비 중인 상대도 맞는다', () => {
    expect(turn(f(3, 3), 'smash', f(3, 2), 'ready').fighters[1]).toEqual(f(2, 2))
  })

  it('강타끼리는 상쇄 (둘 다 스택 3개만 날아감)', () => {
    const r = turn(f(2, 3), 'smash', f(3, 3), 'smash')
    expect(r.events).toEqual(['clash', 'clash'])
    expect(r.fighters).toEqual([f(2, 0), f(3, 0)])
  })

  it('스택이 모자라면 준비로 바뀐다', () => {
    expect(turn(f(3, 2), 'smash', f(3, 0), 'guard').stances[0]).toBe('ready')
  })
})

describe('winnerOf', () => {
  it('생명력 0이 되면 진다', () => {
    expect(winnerOf([f(1, 0), f(0, 0)], 4)).toBe(0)
    expect(winnerOf([f(0, 0), f(2, 0)], 4)).toBe(1)
    expect(winnerOf([FRESH, FRESH], 4)).toBeNull()
  })

  it(`${MAX_TURNS}턴이 지나면 생명력이 많은 쪽 승리, 같으면 무승부`, () => {
    expect(winnerOf([f(2, 0), f(1, 0)], MAX_TURNS - 1)).toBeNull()
    expect(winnerOf([f(2, 0), f(1, 0)], MAX_TURNS)).toBe(0)
    expect(winnerOf([f(2, 0), f(3, 0)], MAX_TURNS)).toBe(1)
    expect(winnerOf([f(2, 0), f(2, 2)], MAX_TURNS)).toBe('draw')
  })
})
