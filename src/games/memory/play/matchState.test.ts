import { describe, expect, it } from 'vitest'
import { CARD_COUNT, type Difficulty, INTRO_MS, MISS_SHOW_MS, PAIRS, PICK_MS } from '../constants'
import {
  type Controller,
  type MatchState,
  type Pair,
  canFlip,
  createMatch,
  matchReducer,
  pairsOf,
  shuffleDeck,
  summarizeMatch,
} from './matchState'

function started(opts: { controllers?: Pair<Controller>; first?: 0 | 1; seed?: number; difficulty?: Difficulty } = {}) {
  const s = createMatch({ now: 0, seed: opts.seed ?? 1, difficulty: opts.difficulty ?? 'normal', deckSeed: 42, ...opts })
  return matchReducer(s, { type: 'tick', now: INTRO_MS })
}

/** 같은 그림인 두 카드 / 다른 그림인 두 카드 */
function pairIn(s: MatchState): [number, number] {
  const a = s.cards.findIndex((c) => c.owner === null)
  return [a, s.cards.findIndex((c, i) => i !== a && c.owner === null && c.face === s.cards[a].face)]
}
function missIn(s: MatchState): [number, number] {
  const a = s.cards.findIndex((c) => c.owner === null)
  return [a, s.cards.findIndex((c) => c.owner === null && c.face !== s.cards[a].face)]
}

const pick = (s: MatchState, index: number) => matchReducer(s, { type: 'pick', index })
const at = (s: MatchState, now: number) => matchReducer(s, { type: 'tick', now })

describe('shuffleDeck', () => {
  it(`${PAIRS}가지 그림이 두 장씩, 같은 시드면 같은 덱`, () => {
    const deck = shuffleDeck(7)
    expect(deck).toHaveLength(CARD_COUNT)
    for (let f = 0; f < PAIRS; f++) expect(deck.filter((x) => x === f)).toHaveLength(2)
    expect(shuffleDeck(7)).toEqual(deck)
    expect(shuffleDeck(8)).not.toEqual(deck)
  })
})

describe('차례', () => {
  it('시작 안내 중엔 못 연다', () => {
    const s = createMatch({ now: 0, seed: 1, difficulty: 'normal', first: 0 })
    expect(canFlip(s, 0)).toBe(false)
    expect(pick(s, 0)).toBe(s)
  })

  it('맞으면 가져가고 한 번 더', () => {
    let s = started({ first: 0 })
    const [a, b] = pairIn(s)
    s = pick(pick(s, a), b)
    expect(s.phase).toMatchObject({ kind: 'showing', match: true })
    expect(pairsOf(s)).toEqual([1, 0])
    s = at(s, s.phase.kind === 'showing' ? s.phase.until : 0)
    expect(s.phase.kind).toBe('picking')
    expect(s.turn).toBe(0)
    expect(s.open).toEqual([])
  })

  it('틀리면 보여준 뒤 덮고 차례가 넘어간다', () => {
    let s = started({ first: 0 })
    const [a, b] = missIn(s)
    s = pick(pick(s, a), b)
    expect(s.phase).toMatchObject({ kind: 'showing', match: false })
    expect(s.turn).toBe(0)
    s = at(s, s.now + MISS_SHOW_MS)
    expect(s.turn).toBe(1)
    expect(s.open).toEqual([])
    expect(pairsOf(s)).toEqual([0, 0])
  })

  it('같은 카드를 두 번, 남의 차례에는 못 연다', () => {
    let s = started({ first: 0 })
    s = pick(s, 3)
    expect(pick(s, 3)).toBe(s)
    const theirs = started({ first: 1, controllers: ['user', 'remote'] })
    expect(pick(theirs, 0)).toBe(theirs)
  })

  it('10초 안에 안 고르면 무작위로 열린다 (내 차례만)', () => {
    let s = started({ first: 0 })
    s = at(s, INTRO_MS + PICK_MS)
    expect(s.open).toHaveLength(1)
    const remote = started({ first: 1, controllers: ['user', 'remote'] })
    expect(at(remote, INTRO_MS + PICK_MS * 3).open).toHaveLength(0)
  })
})

/** 봇끼리 끝까지 */
function playOut(s: MatchState): MatchState {
  let now = s.now
  for (let i = 0; i < 5000 && s.phase.kind !== 'done'; i++) s = at(s, (now += 100))
  return s
}

describe('경기 전체', () => {
  it('끝나면 12쌍이 다 나뉘고, 많이 가진 쪽이 이긴다', () => {
    for (let seed = 0; seed < 20; seed++) {
      const s = playOut(started({ seed, controllers: ['bot', 'bot'] }))
      expect(s.phase.kind).toBe('done')
      const [a, b] = pairsOf(s)
      expect(a + b).toBe(PAIRS)
      if (s.phase.kind === 'done') expect(s.phase.winner).toBe(a === b ? 'draw' : a > b ? 0 : 1)
    }
  })

  it('어려움 봇이 일반 봇보다 기억을 잘한다 (봇끼리 경기에서 더 적게 열고 끝남)', () => {
    let hard = 0
    let normal = 0
    for (let seed = 0; seed < 60; seed++) {
      const h = playOut(started({ seed, controllers: ['bot', 'bot'], difficulty: 'hard' }))
      const n = playOut(started({ seed, controllers: ['bot', 'bot'], difficulty: 'normal' }))
      hard += h.flips.length
      normal += n.flips.length
    }
    // 기억을 잘하면 같은 12쌍을 더 적게 열어서 찾는다
    expect(hard).toBeLessThan(normal * 0.85)
  })

  it('결과 요약은 내 입장에서', () => {
    const s = playOut(started({ seed: 3, controllers: ['bot', 'bot'] }))
    const mine = { ...s, controllers: ['bot', 'user'] as const }
    const sum = summarizeMatch(mine)
    const [a, b] = pairsOf(s)
    expect(sum.pairs).toEqual([b, a])
    expect(sum.mode).toBe('bot')
    expect(sum.tries).toBe(Math.floor(s.flips.filter((f) => f.side === 1).length / 2))
  })
})

describe('친구 카드 받기', () => {
  it('순서가 맞는 카드만, 친구 차례에만 연다', () => {
    let s = started({ first: 1, controllers: ['user', 'remote'] })
    expect(matchReducer(s, { type: 'remoteFlip', n: 1, index: 0 })).toBe(s)
    s = matchReducer(s, { type: 'remoteFlip', n: 0, index: 0 })
    expect(s.open).toEqual([0])
    expect(matchReducer(s, { type: 'remoteFlip', n: 0, index: 1 })).toBe(s)
  })

  it('틀림 보여주기가 끝나기 전에 도착하면 바로 덮고 연다', () => {
    let s = started({ first: 0, controllers: ['user', 'remote'] })
    const [a, b] = missIn(s)
    s = pick(pick(s, a), b)
    s = matchReducer(s, { type: 'remoteFlip', n: 2, index: a })
    expect(s.turn).toBe(1)
    expect(s.open).toEqual([a])
  })

  it('시작 안내 중에 도착해도 연다', () => {
    const s = createMatch({ now: 0, seed: 1, difficulty: 'normal', first: 1, controllers: ['user', 'remote'] })
    expect(matchReducer(s, { type: 'remoteFlip', n: 0, index: 5 }).open).toEqual([5])
  })
})
