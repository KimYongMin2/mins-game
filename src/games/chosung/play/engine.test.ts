import { describe, expect, it } from 'vitest'
import { chosungOf } from '../../../shared/words/koWords'
import { HINT_MS, POINTS, QUESTIONS } from '../constants'
import { createEngine, engineReducer, type EngineState } from './engine'
import { viewFor } from './view'

const players = (n: number) => Array.from({ length: n }, (_, i) => ({ id: `p${i}`, name: `사람${i}` }))
const toAsk = (s: EngineState) => {
  let t = s.now
  while (s.phase.kind !== 'ask' && s.phase.kind !== 'done') s = engineReducer(s, { type: 'tick', now: (t += 100) })
  return s
}

describe('초성 퀴즈 심판', () => {
  it('정답은 공개 전엔 안 보이고, 맞힌 순서대로 점수, 힌트 뒤엔 절반', () => {
    let s = toAsk(createEngine({ now: 0, seed: 3, players: players(3) }))
    const word = s.questions[s.q].word
    const v = viewFor(s, 'p0')
    expect(v.clue).toBe(chosungOf(word))
    expect(v.answer).toBeNull()
    s = engineReducer(s, { type: 'guess', player: 0, text: '아무말' })
    expect(s.log.at(-1)?.kind).toBe('chat')
    s = engineReducer(s, { type: 'guess', player: 1, text: word })
    expect(s.scores[1]).toBe(POINTS[0])
    expect(viewFor(s, 'p1').answer).toBe(word)
    expect(viewFor(s, 'p2').answer).toBeNull()
    s = engineReducer(s, { type: 'tick', now: (s.phase as { start: number }).start + HINT_MS })
    expect(viewFor(s, 'p2').hint).toBe(true)
    s = engineReducer(s, { type: 'guess', player: 2, text: word })
    expect(s.scores[2]).toBe(Math.ceil(POINTS[1] / 2))
  })

  it('아무도 안 맞혀도 10문제 끝까지', () => {
    let s = createEngine({ now: 0, seed: 1, players: players(1) })
    let t = 0
    while (s.phase.kind !== 'done') s = engineReducer(s, { type: 'tick', now: (t += 500) })
    expect(s.q).toBe(QUESTIONS - 1)
    expect(new Set(s.questions.map((q) => q.word)).size).toBe(QUESTIONS)
  })
})
