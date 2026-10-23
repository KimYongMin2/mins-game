import { describe, expect, it } from 'vitest'
import { PICK_MS, REVEAL_MS, SIZE, TURN_MS } from '../constants'
import { BLACK, CENTER, WHITE } from '../rules/renju'
import { type MatchAction, type MatchState, createMatch, matchReducer, stoneOf, summarizeMatch } from './matchState'

const run = (s: MatchState, ...actions: MatchAction[]) => actions.reduce(matchReducer, s)
const tick = (now: number): MatchAction => ({ type: 'tick', now })

/** 봇전: 카드를 골라 공개가 끝난 상태. 나를 흑/백으로 */
function started(seed: number, me: 'black' | 'white') {
  const s = createMatch({ now: 0, seed, mode: 'bot', difficulty: 'hard' })
  const card = me === 'black' ? s.blackCard : ((1 - s.blackCard) as 0 | 1)
  return run(s, { type: 'pick', card }, tick(REVEAL_MS))
}

describe('경기 진행', () => {
  it('흑 카드를 고르면 내가 흑이고 먼저 둔다', () => {
    const s = started(1, 'black')
    expect(stoneOf(s, 0)).toBe(BLACK)
    expect(s.turn).toBe(0)
    expect(s.phase.kind).toBe('playing')
  })

  it('백 카드면 봇이 먼저 둔다', () => {
    let s = started(2, 'white')
    expect(stoneOf(s, 0)).toBe(WHITE)
    expect(s.turn).toBe(1)
    s = run(s, tick(REVEAL_MS + 2000))
    expect(s.moves).toEqual([CENTER])
    expect(s.turn).toBe(0)
  })

  it('카드를 안 고르면 10초 뒤 무작위', () => {
    const s = run(createMatch({ now: 0, seed: 3, mode: 'bot', difficulty: 'normal' }), tick(PICK_MS))
    expect(s.picked).not.toBeNull()
    expect(s.phase.kind).toBe('reveal')
  })

  it('고르기만 하면 안 둬지고, 착수해야 둬진다', () => {
    let s = started(4, 'black')
    s = run(s, { type: 'select', pos: CENTER })
    expect(s.selected).toBe(CENTER)
    expect(s.moves).toEqual([])
    s = run(s, { type: 'place', pos: CENTER })
    expect(s.moves).toEqual([CENTER])
    expect(s.selected).toBeNull()
    expect(s.turn).toBe(1)
  })

  it('시간이 넘으면 골라 둔 자리에 둔다', () => {
    const pos = CENTER + 1
    const s = run(started(5, 'black'), { type: 'select', pos }, tick(REVEAL_MS + TURN_MS))
    expect(s.moves).toEqual([pos])
  })

  it('골라 둔 자리 없이 시간이 넘으면 알아서 둔다', () => {
    const s = run(started(6, 'black'), tick(REVEAL_MS + TURN_MS))
    expect(s.moves).toHaveLength(1)
  })

  it('흑은 금수 자리를 고를 수도, 둘 수도 없다', () => {
    let s = started(7, 'black')
    // 흑 (5,7)(6,7)(7,5)(7,6)을 두게 하고 봇 수는 멀리 둔다고 치기 위해 판을 직접 만든다
    const board = s.board.slice()
    for (const [x, y] of [
      [5, 7],
      [6, 7],
      [7, 5],
      [7, 6],
    ])
      board[y * SIZE + x] = BLACK
    s = { ...s, board }
    const p = 7 * SIZE + 7
    expect(run(s, { type: 'select', pos: p }).selected).toBeNull()
    expect(run(s, { type: 'place', pos: p }).moves).toEqual([])
  })

  it('다섯을 이으면 끝', () => {
    let s = started(8, 'black')
    const board = s.board.slice()
    for (const x of [3, 4, 5, 6]) board[x] = BLACK
    s = run({ ...s, board }, { type: 'place', pos: 7 })
    expect(s.phase).toMatchObject({ kind: 'done', winner: 0, line: [3, 4, 5, 6, 7] })
    expect(summarizeMatch(s)).toMatchObject({ outcome: 'win', stone: 'black', moves: 1 })
  })

  it('손을 놓아도 봇과 끝까지 간다', () => {
    let s = started(9, 'white')
    for (let t = REVEAL_MS; s.phase.kind !== 'done' && t < 50_000_000; t += 500) s = run(s, tick(t))
    expect(s.phase.kind).toBe('done')
  })
})
