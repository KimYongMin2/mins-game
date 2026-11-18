import { describe, expect, it } from 'vitest'
import { createEngine, engineReducer, type EngineState } from './engine'
import { viewFor } from './view'
import { DRAWER_POINTS, GUESS_POINTS } from '../constants'

const players = (n: number) => Array.from({ length: n }, (_, i) => ({ id: `p${i}`, name: `사람${i}` }))
const at = (s: EngineState, now: number) => engineReducer(s, { type: 'tick', now })

function toDraw(s: EngineState): EngineState {
  let t = s.now
  while (s.phase.kind !== 'draw' && s.phase.kind !== 'done') s = at(s, (t += 100))
  return s
}

describe('그림 맞히기 심판', () => {
  it('몇 명이든 한 사람당 두 번씩 (두 바퀴, 같은 순서)', () => {
    for (const n of [2, 3, 4, 8]) {
      const { order } = createEngine({ now: 0, seed: 1, players: players(n) })
      expect(order).toHaveLength(n * 2)
      expect(order.slice(n)).toEqual(order.slice(0, n))
      for (let i = 0; i < n; i++) expect(order.filter((x) => x === i)).toHaveLength(2)
    }
  })

  it('제시어는 그리는 사람만 보고, 맞히면 순서대로 점수 + 그린 사람 점수', () => {
    let s = toDraw(createEngine({ now: 0, seed: 5, players: players(3) }))
    if (s.phase.kind !== 'draw') throw new Error()
    const { drawer, word } = s.phase
    const others = [0, 1, 2].filter((i) => i !== drawer)
    expect(viewFor(s, `p${drawer}`).word).toBe(word)
    expect(viewFor(s, `p${others[0]}`).word).toBeNull()
    expect(viewFor(s, `p${others[0]}`).wordLength).toBeNull()
    s = engineReducer(s, { type: 'guess', player: others[0], text: '틀린답' })
    expect(s.log.at(-1)).toMatchObject({ kind: 'chat', text: '틀린답' })
    s = engineReducer(s, { type: 'guess', player: others[0], text: ` ${word} ` })
    expect(s.scores[others[0]]).toBe(GUESS_POINTS[0])
    expect(s.scores[drawer]).toBe(DRAWER_POINTS)
    // 정답을 채팅으로 남이 보지 않음
    expect(JSON.stringify(viewFor(s, `p${others[1]}`).log)).not.toContain(word)
    s = engineReducer(s, { type: 'guess', player: others[1], text: word })
    expect(s.scores[others[1]]).toBe(GUESS_POINTS[1])
    // 다 맞히면 바로 정답 보여주기
    expect(s.phase.kind).toBe('reveal')
  })

  it('보기(힌트)는 없음 — 끝까지 채팅으로만 맞힘', () => {
    let s = toDraw(createEngine({ now: 0, seed: 9, players: players(3) }))
    if (s.phase.kind !== 'draw') throw new Error()
    const g = [0, 1, 2].find((i) => i !== (s.phase as { drawer: number }).drawer)!
    s = at(s, s.phase.until - 1)
    expect('choices' in viewFor(s, `p${g}`)).toBe(false)
  })

  it('아무도 안 해도 끝까지 가고, 그리던 사람이 나가면 그 차례 끝', () => {
    let s = createEngine({ now: 0, seed: 3, players: players(4) })
    let t = 0
    let guard = 0
    while (s.phase.kind !== 'done' && guard++ < 10000) s = at(s, (t += 500))
    expect(s.phase.kind).toBe('done')
    let d = toDraw(createEngine({ now: 0, seed: 4, players: players(3) }))
    if (d.phase.kind !== 'draw') throw new Error()
    d = engineReducer(d, { type: 'drop', player: d.phase.drawer })
    expect(d.phase.kind).toBe('reveal')
  })

  it('맞힌 뒤에도 채팅: 모두에게 보이고, 정답이 들어간 글만 못 맞힌 사람에게 숨김', () => {
    let s = toDraw(createEngine({ now: 0, seed: 5, players: players(3) }))
    if (s.phase.kind !== 'draw') throw new Error()
    const { drawer, word } = s.phase
    const [a, b] = [0, 1, 2].filter((i) => i !== drawer)
    expect(viewFor(s, `p${drawer}`).canChat).toBe(false)
    s = engineReducer(s, { type: 'guess', player: a, text: word })
    expect(viewFor(s, `p${a}`).canChat).toBe(true)
    s = engineReducer(s, { type: 'guess', player: a, text: '쉽네 ㅋㅋ' })
    s = engineReducer(s, { type: 'guess', player: a, text: `답은 ${word}` })
    const seenBy = (i: number) => viewFor(s, `p${i}`).log.map((l) => l.text)
    expect(seenBy(b)).toContain('쉽네 ㅋㅋ')
    expect(seenBy(b)).not.toContain(`답은 ${word}`)
    expect(seenBy(drawer)).toContain(`답은 ${word}`)
    expect(seenBy(a)).toContain(`답은 ${word}`)
    // 정답 공개 뒤엔 모두
    s = engineReducer(s, { type: 'tick', now: s.phase.kind === 'draw' ? s.phase.until : s.now })
    expect(seenBy(b)).toContain(`답은 ${word}`)
  })
})
