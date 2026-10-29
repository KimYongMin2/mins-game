import { describe, expect, it } from 'vitest'
import { HAND_SIZE } from '../constants'
import { checkDraft, createDraft, draftReducer } from '../play/draft'
import { type EngineState, type Player, createEngine, engineReducer } from '../play/engine'
import { isValidSet, setValue } from './sets'
import { WILD_IDS, tileId } from './tiles'
import { checkPlay } from './turn'

// 와일드를 옮길 때도 바닥 전체가 맞아야 하는지, 손으로는 못 가져가는지 하나씩 확인한다.

const [W1, W2] = WILD_IDS
const R = 0
const B = 1
const O = 2
const K = 3
const t = (color: number, num: number, copy = 0) => tileId(color, num, copy)

describe('와일드가 든 줄', () => {
  it('빈 곳·끝을 채운 연속, 같은 숫자', () => {
    expect(isValidSet([t(R, 4), W1, t(R, 6)])).toBe(true)
    expect(isValidSet([W1, W2, t(R, 5)])).toBe(true)
    expect(isValidSet([W1, t(R, 12), t(R, 13)])).toBe(true)
    expect(isValidSet([t(R, 12), t(R, 13), W1])).toBe(false)
    expect(isValidSet([t(R, 7), t(B, 7), W1])).toBe(true)
  })

  it('와일드로도 안 되는 줄', () => {
    // 같은 숫자 4색 + 와일드 = 5장 (색이 4개라 최대 4장)
    expect(isValidSet([t(R, 7), t(B, 7), t(O, 7), t(K, 7), W1])).toBe(false)
    // 1~13 다 있는데 와일드를 더 붙이면 14장
    expect(isValidSet([...Array.from({ length: 13 }, (_, i) => t(R, i + 1)), W1])).toBe(false)
    // 와일드 하나로 두 칸을 못 메움
    expect(isValidSet([t(R, 4), W1, t(R, 7)])).toBe(false)
    // 다른 색 섞인 연속
    expect(isValidSet([t(R, 4), W1, t(B, 6)])).toBe(false)
    // 와일드 + 2장 = 3장이지만 숫자도 색도 다름
    expect(isValidSet([t(R, 4), W1, t(B, 9)])).toBe(false)
  })

  it('첫 등록 점수: 와일드는 대신하는 숫자', () => {
    expect(setValue([W1, t(R, 12), t(R, 13)])).toBe(36)
    // 와일드 둘 + 13은 11·12·13(36)도, 13 세 장(39)도 되는데 큰 쪽으로 친다
    expect(setValue([W1, W2, t(R, 13)])).toBe(39)
    expect(setValue([t(K, 9), t(B, 9), W1])).toBe(27)
  })
})

describe('바닥의 와일드 옮기기 (첫 등록 뒤)', () => {
  const run = [t(R, 4), W1, t(R, 6)]

  it('와일드를 빼고 빈자리를 안 채우면 틀린 줄', () => {
    const hand = [t(B, 9), t(K, 9)]
    const newTable = [[t(R, 4), t(R, 6)], [t(B, 9), t(K, 9), W1]]
    expect(checkPlay({ oldTable: [run], hand, newTable, melded: true })).toEqual({ ok: false, problem: 'bad-set' })
  })

  it('빈자리를 내 타일로 채우고 와일드를 새 줄에 쓰면 됨', () => {
    const hand = [t(R, 5), t(B, 9), t(K, 9)]
    const newTable = [[t(R, 4), t(R, 5), t(R, 6)], [t(B, 9), t(K, 9), W1]]
    expect(checkPlay({ oldTable: [run], hand, newTable, melded: true })).toEqual({ ok: true, placed: hand })
  })

  it('와일드를 손으로 가져갈 수 없다', () => {
    const hand = [t(R, 5)]
    const newTable = [[t(R, 4), t(R, 5), t(R, 6)]]
    expect(checkPlay({ oldTable: [run], hand, newTable, melded: true })).toEqual({ ok: false, problem: 'took-tile' })
  })

  it('와일드를 줄 끝으로 옮기기만 해도 다 맞으면 됨 (내 타일 1장은 올려야 함)', () => {
    const hand = [t(R, 5)]
    const newTable = [[t(R, 4), t(R, 5), t(R, 6), W1]]
    expect(checkPlay({ oldTable: [run], hand, newTable, melded: true }).ok).toBe(true)
    expect(checkPlay({ oldTable: [run], hand: [], newTable: [[W1, t(R, 4), t(R, 6)]], melded: true })).toEqual({ ok: false, problem: 'nothing' })
  })

  it('첫 등록 전엔 바닥 와일드를 못 옮긴다', () => {
    const hand = [t(R, 5), t(B, 10), t(O, 10), t(K, 10)]
    const newTable = [[t(R, 4), t(R, 5), t(R, 6)], [t(B, 10), t(O, 10), t(K, 10), W1]]
    expect(checkPlay({ oldTable: [run], hand, newTable, melded: false })).toEqual({ ok: false, problem: 'touched' })
  })

  it('내 손의 와일드는 내 타일로 쳐서 첫 등록에 쓸 수 있다', () => {
    const hand = [t(B, 12), t(K, 12), W2]
    expect(checkPlay({ oldTable: [run], hand, newTable: [run, hand], melded: false })).toEqual({ ok: true, placed: hand })
  })
})

describe('작업판에서 와일드', () => {
  const base = [[t(R, 4), W1, t(R, 6)]]

  it('바닥 와일드는 손패 칸을 눌러도 손으로 안 온다', () => {
    let d = createDraft(base, [t(R, 5)], true)
    d = draftReducer(d, { type: 'toggle', tile: W1 })
    d = draftReducer(d, { type: 'unplace' })
    expect(d.table).toEqual(base)
  })

  it('와일드를 옮겨 틀린 줄이 남으면 못 내고, 채우면 낸다', () => {
    let d = createDraft(base, [t(R, 5), t(B, 9), t(K, 9)], true)
    for (const id of [t(B, 9), t(K, 9), W1]) d = draftReducer(d, { type: 'toggle', tile: id })
    d = draftReducer(d, { type: 'place', set: -1 })
    expect(checkDraft(d)).toEqual({ ok: false, problem: 'bad-set' })
    // 4·6 줄 맨 뒤에 5를 놓으면 4·6·5라 틀림, 가운데(1번 자리)에 끼워야 맞음
    d = draftReducer(d, { type: 'toggle', tile: t(R, 5) })
    expect(checkDraft(draftReducer(d, { type: 'place', set: 0 }))).toEqual({ ok: false, problem: 'bad-set' })
    d = draftReducer(d, { type: 'place', set: 0, at: 1 })
    expect(d.table[0]).toEqual([t(R, 4), t(R, 5), t(R, 6)])
    expect(checkDraft(d).ok).toBe(true)
  })
})

describe('시간 초과 때 와일드를 옮긴 바닥', () => {
  const players: Player[] = [
    { id: 'me', name: '나', kind: 'user' },
    { id: 'b', name: '친구', kind: 'remote' },
  ]
  const run = [t(R, 4), W1, t(R, 6)]
  const hand = [t(R, 5), t(B, 9), t(K, 9)]
  function setup(): EngineState {
    const s = createEngine({ now: 0, seed: 1, players })
    return { ...s, table: [run], melded: [true, true], hands: [hand, s.hands[1]], turn: 0, phase: { kind: 'turn', until: 1000 } }
  }

  it('틀린 줄이 남았으면 되돌리고 1장', () => {
    let s = engineReducer(setup(), { type: 'draft', player: 0, turnSeq: 0, table: [[t(R, 4), t(R, 6)], [t(B, 9), t(K, 9), W1]] })
    s = engineReducer(s, { type: 'tick', now: 1000 })
    expect(s.table).toEqual([run])
    expect(s.hands[0]).toHaveLength(hand.length + 1)
  })

  it('다 맞으면 그대로 내려놓기', () => {
    const table = [[t(R, 4), t(R, 5), t(R, 6)], [t(B, 9), t(K, 9), W1]]
    let s = engineReducer(setup(), { type: 'draft', player: 0, turnSeq: 0, table })
    s = engineReducer(s, { type: 'tick', now: 1000 })
    expect(s.table).toEqual(table)
    expect(s.hands[0]).toEqual([])
    expect(s.phase.kind).toBe('done')
  })

  it('봇끼리 끝까지 가도 바닥은 늘 맞고 와일드는 바닥에 남거나 손에 있다', () => {
    const bots: Player[] = Array.from({ length: 4 }, (_, i) => ({ id: `${i}`, name: '', kind: 'bot' }))
    for (let seed = 1; seed <= 20; seed++) {
      let s = createEngine({ now: 0, seed, players: bots })
      expect(s.hands.every((h) => h.length === HAND_SIZE)).toBe(true)
      let now = 0
      let wildsOnTable = 0
      while (s.phase.kind !== 'done') {
        now += 100
        s = engineReducer(s, { type: 'tick', now })
        expect(s.table.every(isValidSet)).toBe(true)
        // 한 번 바닥에 오른 와일드는 바닥에서 안 없어진다
        const onTable = s.table.flat().filter((id) => WILD_IDS.includes(id)).length
        expect(onTable).toBeGreaterThanOrEqual(wildsOnTable)
        wildsOnTable = onTable
      }
    }
  })
})
