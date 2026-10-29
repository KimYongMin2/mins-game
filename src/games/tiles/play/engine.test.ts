import { describe, expect, it } from 'vitest'
import { chooseBotPlay, setsFromHand } from '../bot/tilesBot'
import { HAND_SIZE, TURN_MS } from '../constants'
import { isValidSet } from '../rules/sets'
import { TILE_COUNT, WILD_IDS, tileId } from '../rules/tiles'
import { type EngineState, type Player, createEngine, engineReducer, rankingOf } from './engine'

const bots = (n: number): Player[] => Array.from({ length: n }, (_, i) => ({ id: `b${i}`, name: `봇${i}`, kind: 'bot' }))

function runToEnd(s: EngineState, step = 100, limit = 2_000_000): EngineState {
  let now = s.now
  while (s.phase.kind !== 'done' && now < limit * step) {
    now += step
    s = engineReducer(s, { type: 'tick', now })
  }
  return s
}

const allTiles = (s: EngineState) => [...s.pool, ...s.table.flat(), ...s.hands.flat()]

describe('심판', () => {
  it('13장씩 나눠 주고 나머지는 더미', () => {
    const s = createEngine({ now: 0, seed: 3, players: bots(4) })
    expect(s.hands.every((h) => h.length === HAND_SIZE)).toBe(true)
    expect(s.pool.length).toBe(TILE_COUNT - 4 * HAND_SIZE)
    expect(new Set(allTiles(s)).size).toBe(TILE_COUNT)
  })

  it.each([2, 3, 4])('봇 %i명이 끝까지: 타일이 새거나 겹치지 않고 바닥은 모두 올바른 줄', (n) => {
    for (let seed = 1; seed <= 15; seed++) {
      const end = runToEnd(createEngine({ now: 0, seed, players: bots(n) }))
      expect(end.phase.kind).toBe('done')
      expect(new Set(allTiles(end)).size).toBe(TILE_COUNT)
      expect(allTiles(end).length).toBe(TILE_COUNT)
      expect(end.table.every(isValidSet)).toBe(true)
    }
  })

  it('사람이 시간 안에 안 하면 1장 가져옴', () => {
    const players: Player[] = [
      { id: 'me', name: '나', kind: 'user' },
      { id: 'b', name: '봇', kind: 'bot' },
    ]
    let s = createEngine({ now: 0, seed: 7, players })
    s = engineReducer(s, { type: 'tick', now: 2000 })
    s = { ...s, turn: 0, phase: { kind: 'turn', until: 2000 + TURN_MS } }
    s = engineReducer(s, { type: 'tick', now: 2000 + TURN_MS })
    expect(s.hands[0].length).toBe(HAND_SIZE + 1)
    expect(s.turn).toBe(1)
  })

  it('잘못 낸 건 무시, 손패를 다 털면 끝', () => {
    const players: Player[] = [
      { id: 'me', name: '나', kind: 'user' },
      { id: 'r', name: '친구', kind: 'remote' },
    ]
    let s = createEngine({ now: 0, seed: 7, players })
    const hand = [tileId(0, 10), tileId(1, 10), tileId(2, 10)]
    s = { ...s, hands: [hand, s.hands[1]], turn: 0, phase: { kind: 'turn', until: 99_999 } }
    expect(engineReducer(s, { type: 'play', player: 0, table: [hand.slice(0, 2)] })).toBe(s)
    expect(engineReducer(s, { type: 'play', player: 1, table: [hand] })).toBe(s)
    const end = engineReducer(s, { type: 'play', player: 0, table: [hand] })
    expect(end.phase.kind).toBe('done')
    expect(rankingOf(end)[0]).toBe(0)
  })

  it('친구가 나가면 차례에서 빠지고, 한 명 남으면 끝', () => {
    const players: Player[] = [
      { id: 'me', name: '나', kind: 'user' },
      { id: 'r', name: '친구', kind: 'remote' },
      { id: 'b', name: '봇', kind: 'bot' },
    ]
    let s = createEngine({ now: 0, seed: 1, players })
    s = { ...s, turn: 1, phase: { kind: 'turn', until: 99_999 } }
    s = engineReducer(s, { type: 'drop', player: 1 })
    expect(s.turn).toBe(2)
    s = engineReducer(s, { type: 'drop', player: 2 })
    expect(s.phase.kind).toBe('done')
    expect(rankingOf(s).slice(-2).sort()).toEqual([1, 2])
  })
})

describe('봇', () => {
  it('첫 등록은 합 30 이상일 때만', () => {
    const small = [tileId(0, 2), tileId(1, 2), tileId(2, 2), tileId(3, 13)]
    expect(chooseBotPlay([], small, false)).toBeNull()
    const big = [tileId(0, 10), tileId(1, 10), tileId(2, 10), tileId(3, 1)]
    expect(chooseBotPlay([], big, false)).toEqual([[tileId(0, 10), tileId(1, 10), tileId(2, 10)]])
  })

  it('첫 등록 뒤엔 바닥 줄 끝에 붙인다', () => {
    const table = [[tileId(0, 4), tileId(0, 5), tileId(0, 6)]]
    expect(chooseBotPlay(table, [tileId(0, 7), tileId(3, 1)], true)).toEqual([[tileId(0, 4), tileId(0, 5), tileId(0, 6), tileId(0, 7)]])
  })

  it('와일드로 빈 곳 채우기', () => {
    const sets = setsFromHand([tileId(2, 3), WILD_IDS[0], tileId(2, 5)])
    expect(sets).toHaveLength(1)
  })
})

describe('봇 바닥 다시 짜기', () => {
  it('연속 줄을 쪼개 끼운다', () => {
    const run = [3, 4, 5, 6, 7, 8].map((n) => tileId(0, n))
    const out = chooseBotPlay([run], [tileId(0, 5, 1)], true)!
    expect(out).toHaveLength(2)
    expect(out.every(isValidSet)).toBe(true)
  })

  it('남는 바닥 타일을 빌려 새 줄', () => {
    const run = [3, 4, 5, 6].map((n) => tileId(0, n))
    const out = chooseBotPlay([run], [tileId(1, 6), tileId(2, 6)], true)!
    expect(out.every(isValidSet)).toBe(true)
    expect(out.flat()).toHaveLength(6)
  })
})

describe('시간 초과', () => {
  const players: Player[] = [
    { id: 'me', name: '나', kind: 'user' },
    { id: 'r', name: '친구', kind: 'remote' },
  ]
  const hand = [tileId(0, 10), tileId(1, 10), tileId(2, 10), tileId(3, 1)]
  function myTurn(): EngineState {
    const s = createEngine({ now: 0, seed: 7, players })
    return { ...s, hands: [hand, s.hands[1]], turn: 0, phase: { kind: 'turn', until: 1000 } }
  }

  it('짜던 바닥이 다 맞으면 그대로 내려놓는다', () => {
    let s = engineReducer(myTurn(), { type: 'draft', player: 0, turnSeq: 0, table: [hand.slice(0, 3)] })
    s = engineReducer(s, { type: 'tick', now: 1000 })
    expect(s.table).toEqual([hand.slice(0, 3)])
    expect(s.hands[0]).toEqual([tileId(3, 1)])
    expect(s.last?.kind).toBe('play')
    expect(s.turn).toBe(1)
  })

  it('틀리면 되돌리고 1장 가져온다', () => {
    let s = engineReducer(myTurn(), { type: 'draft', player: 0, turnSeq: 0, table: [hand.slice(0, 2)] })
    s = engineReducer(s, { type: 'tick', now: 1000 })
    expect(s.table).toEqual([])
    expect(s.hands[0]).toHaveLength(5)
    expect(s.last?.kind).toBe('draw')
  })

  it('지난 차례에 짜던 것·차례 아닌 사람 것은 안 받는다', () => {
    const s = myTurn()
    expect(engineReducer(s, { type: 'draft', player: 0, turnSeq: 5, table: [hand.slice(0, 3)] }).draft).toBeNull()
    expect(engineReducer(s, { type: 'draft', player: 1, turnSeq: 0, table: [hand.slice(0, 3)] }).draft).toBeNull()
  })
})
