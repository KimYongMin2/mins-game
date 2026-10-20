import { describe, expect, it } from 'vitest'
import { DECIDE_MS, INTRO_MS, THROW_SHOW_MS } from '../constants'
import { enter } from '../rules/board'
import type { Throw } from '../rules/throw'
import { type EngineState, type Player, type PlayerKind, canMove, canThrow, createEngine, engineReducer } from './engine'

const players = (...kinds: PlayerKind[]): Player[] => kinds.map((kind, i) => ({ id: `p${i}`, name: `사람${i}`, kind }))
const at = (s: EngineState, now: number) => engineReducer(s, { type: 'tick', now })

/** 0번 차례, 결과 pending을 들고 말을 고르는 상태로 만든다 */
function choosing(pending: Throw[], over: Partial<EngineState> = {}): EngineState {
  const s = at(createEngine({ now: 0, seed: 1, players: players('user', 'remote'), pieceCount: 2 }), INTRO_MS)
  return { ...s, turn: 0, pending, throwsLeft: 0, lockUntil: 0, ...over }
}

describe('차례', () => {
  it('던질 게 남으면 먼저 던지고, 다 던지면 옮긴다', () => {
    let s = at(createEngine({ now: 0, seed: 1, players: players('user', 'remote'), pieceCount: 2 }), INTRO_MS)
    s = { ...s, turn: 0 }
    expect(canThrow(s, 0)).toBe(true)
    expect(canThrow(s, 1)).toBe(false)
    expect(canMove(s, 0)).toBe(false)
    // 빽도가 나오면 (말이 없어) 버려지니까 빽도가 아닌 시드를 고른다
    let seed = 1
    let thrown: EngineState
    do thrown = engineReducer({ ...s, seed: seed++ }, { type: 'throw', player: 0 })
    while (thrown.lastThrow?.result === 'backdo')
    expect(thrown.pending).toHaveLength(1)
    // 결과를 보여주는 동안은 못 움직임
    expect(canMove(thrown, 0) || canThrow(thrown, 0)).toBe(false)
  })

  it('결과를 다 쓰면 다음 사람', () => {
    let s = choosing(['gae'])
    s = engineReducer(s, { type: 'move', player: 0, throwIdx: 0, from: 'home' })
    expect(s.turn).toBe(1)
    expect(s.throwsLeft).toBe(1)
  })

  it('도·개·걸로 잡으면 한 번 더, 윷으로 잡으면 추가 없음 (결과를 쓰는 순서에 따라 다름)', () => {
    const base = { pieces: [[enter(1), 'home'], [enter(3), enter(5)]] as EngineState['pieces'] }
    // 윷 → 개: 개로 먼저(1 → 3, 잡음 → 한 번 더)
    let a = choosing(['yut', 'gae'], base)
    a = engineReducer(a, { type: 'move', player: 0, throwIdx: 1, from: 1 })
    expect(a.throwsLeft).toBe(1)
    // 윷 → 개: 윷으로 먼저 (1 → 5 잡음 → 추가 없음), 남은 개를 써야 함
    let b = choosing(['yut', 'gae'], base)
    b = engineReducer(b, { type: 'move', player: 0, throwIdx: 0, from: 1 })
    expect(b.throwsLeft).toBe(0)
    expect(b.pending).toEqual(['gae'])
    expect(b.turn).toBe(0)
  })

  it('판에 말이 없을 때 빽도만 나오면 버리고 다음 사람', () => {
    let s = at(createEngine({ now: 0, seed: 1, players: players('user', 'remote'), pieceCount: 2 }), INTRO_MS)
    s = { ...s, turn: 0, pending: ['backdo'], throwsLeft: 0 }
    s = engineReducer(s, { type: 'tick', now: s.now })
    // tidy는 행동 뒤에 돌므로, 빽도만 남긴 채 시간이 지나면 저절로 넘어간다
    s = at(s, s.now + DECIDE_MS)
    expect(s.turn).toBe(1)
  })

  it('20초 안에 안 하면 저절로 (던지기 → 움직이기)', () => {
    let s = at(createEngine({ now: 0, seed: 2, players: players('user', 'remote'), pieceCount: 2 }), INTRO_MS)
    s = { ...s, turn: 0 }
    s = at(s, INTRO_MS + DECIDE_MS)
    expect(s.pending.length + (s.turn === 1 ? 1 : 0)).toBeGreaterThan(0)
    s = at(s, s.now + THROW_SHOW_MS + DECIDE_MS)
    s = at(s, s.now + THROW_SHOW_MS + DECIDE_MS)
    expect(s.pieces[0].some((p) => p !== 'home') || s.turn === 1).toBe(true)
  })
})

describe('경기 전체', () => {
  it('봇끼리 끝까지: 누군가 말을 다 내보내면 끝', () => {
    for (const pieceCount of [2, 3, 4]) {
      for (let seed = 0; seed < 10; seed++) {
        let s = createEngine({ now: 0, seed, players: players('bot', 'bot', 'bot', 'bot'), pieceCount })
        for (let now = 0; now < 3_000_000 && s.phase.kind !== 'done'; now += 50) s = at(s, now)
        expect(s.phase.kind).toBe('done')
        if (s.phase.kind === 'done') expect(s.pieces[s.phase.winner].every((p) => p === 'out')).toBe(true)
      }
    }
  })

  it('친구가 나가면 차례에서 빠지고, 혼자 남으면 그 사람이 우승', () => {
    let s = at(createEngine({ now: 0, seed: 1, players: players('user', 'remote', 'remote'), pieceCount: 2 }), INTRO_MS)
    s = { ...s, turn: 1 }
    s = engineReducer(s, { type: 'drop', player: 1 })
    expect(s.turn).toBe(2)
    s = engineReducer(s, { type: 'drop', player: 2 })
    expect(s.phase).toMatchObject({ kind: 'done', winner: 0 })
  })
})
