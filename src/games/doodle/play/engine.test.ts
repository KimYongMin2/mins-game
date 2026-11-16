import { describe, expect, it } from 'vitest'
import { createEngine, engineReducer, type EngineState } from './engine'
import { viewFor } from './view'
import { CHOICES_AT_MS, DRAWER_POINTS, GUESS_POINTS } from '../constants'

const players = (n: number) => Array.from({ length: n }, (_, i) => ({ id: `p${i}`, name: `사람${i}` }))
const at = (s: EngineState, now: number) => engineReducer(s, { type: 'tick', now })

function toDraw(s: EngineState): EngineState {
  let t = s.now
  while (s.phase.kind !== 'draw' && s.phase.kind !== 'done') s = at(s, (t += 100))
  return s
}

describe('그림 맞히기 심판', () => {
  it('3명 이하는 두 바퀴, 4명부터 한 바퀴', () => {
    expect(createEngine({ now: 0, seed: 1, players: players(3) }).order.length).toBe(6)
    expect(createEngine({ now: 0, seed: 1, players: players(4) }).order.length).toBe(4)
  })

  it('제시어는 그리는 사람만 보고, 맞히면 순서대로 점수 + 그린 사람 점수', () => {
    let s = toDraw(createEngine({ now: 0, seed: 5, players: players(3) }))
    if (s.phase.kind !== 'draw') throw new Error()
    const { drawer, word } = s.phase
    const others = [0, 1, 2].filter((i) => i !== drawer)
    expect(viewFor(s, `p${drawer}`).word).toBe(word)
    expect(viewFor(s, `p${others[0]}`).word).toBeNull()
    expect(viewFor(s, `p${others[0]}`).wordLength).toBe([...word].length)
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

  it('보기는 마지막 20초에만, 한 번만, 맞히면 절반', () => {
    let s = toDraw(createEngine({ now: 0, seed: 9, players: players(3) }))
    if (s.phase.kind !== 'draw') throw new Error()
    const { drawer, word, choices, start } = s.phase
    const g = [0, 1, 2].find((i) => i !== drawer)!
    expect(viewFor(s, `p${g}`).choices).toBeNull()
    const right = choices.indexOf(word)
    const wrong = choices.findIndex((c) => c !== word)
    expect(engineReducer(s, { type: 'pick', player: g, index: right }).scores[g]).toBe(0)
    s = at(s, start + CHOICES_AT_MS)
    expect(viewFor(s, `p${g}`).choices).toHaveLength(4)
    expect(viewFor(s, `p${drawer}`).choices).toBeNull()
    s = engineReducer(s, { type: 'pick', player: g, index: wrong })
    s = engineReducer(s, { type: 'pick', player: g, index: right })
    expect(s.scores[g]).toBe(0)
    const h = [0, 1, 2].find((i) => i !== drawer && i !== g)!
    s = engineReducer(s, { type: 'pick', player: h, index: right })
    expect(s.scores[h]).toBe(Math.ceil(GUESS_POINTS[0] / 2))
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
})
