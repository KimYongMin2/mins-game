import { describe, expect, it } from 'vitest'
import { TURN_MS } from '../constants'
import { checkWord, createEngine, engineReducer, ranksOf, startsOf, type EngineState } from './engine'

const players = (n: number) => Array.from({ length: n }, (_, i) => ({ id: `p${i}`, name: `사람${i}` }))
const started = (n = 3): EngineState => {
  let s = createEngine({ now: 0, seed: 2, players: players(n) })
  s = engineReducer(s, { type: 'tick', now: 5000 })
  return { ...s, chain: [{ word: '기차력', player: null }] }
}

describe('끝말잇기 심판', () => {
  it('두음법칙 인정, 규칙 검사', () => {
    const s = started()
    expect(startsOf(s)).toEqual(['력', '역'])
    expect(checkWord(s, '역사')).toBeNull()
    expect(checkWord(s, '력사')).toBeNull()
    expect(checkWord(s, '사과')).toMatch(/시작/)
    expect(checkWord(s, '역')).toMatch(/두 글자/)
    expect(checkWord(s, '역a')).toMatch(/한글/)
  })

  it('확인 중이면 시간이 안 끝나고, 사전 결과로 넘어가거나 다시 낼 수 있음, 시간이 지나면 탈락', () => {
    let s = started()
    if (s.phase.kind !== 'turn') throw new Error()
    const p0 = s.phase.player
    s = engineReducer(s, { type: 'try', player: p0, word: '역사' })
    expect(s.phase.kind === 'turn' && s.phase.checking).toBe('역사')
    s = engineReducer(s, { type: 'tick', now: s.now + TURN_MS * 2 })
    expect(s.out).toEqual([])
    s = engineReducer(s, { type: 'reject', word: '역사' })
    expect(s.log.at(-1)?.text).toMatch(/사전/)
    s = engineReducer(s, { type: 'try', player: p0, word: '역사' })
    s = engineReducer(s, { type: 'accept', word: '역사' })
    expect(s.chain.at(-1)).toEqual({ word: '역사', player: p0 })
    if (s.phase.kind !== 'turn') throw new Error()
    expect(s.phase.player).not.toBe(p0)
    // 이미 나온 낱말
    expect(checkWord(s, '역사')).toBeTruthy()
    const p1 = s.phase.player
    s = engineReducer(s, { type: 'tick', now: s.now + TURN_MS + 1 })
    expect(s.out).toEqual([p1])
  })

  it('마지막 한 명이 우승', () => {
    let s = started(2)
    let t = s.now
    while (s.phase.kind !== 'done') s = engineReducer(s, { type: 'tick', now: (t += TURN_MS + 1) })
    expect(ranksOf(s).sort()).toEqual([1, 2])
  })
})
