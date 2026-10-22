import { describe, expect, it } from 'vitest'
import { INTRO_MS, RESULT_MS, SOLO_MAX_TRIES, TURN_MS } from '../constants'
import { isValidNumber, score } from '../rules/numbers'
import { type MatchAction, type MatchState, createMatch, matchReducer, summarizeMatch } from './matchState'

const run = (s: MatchState, ...actions: MatchAction[]) => actions.reduce(matchReducer, s)
const tick = (now: number): MatchAction => ({ type: 'tick', now })

/** 봇전: 내 숫자를 정하고 시작 안내가 끝난 상태 */
function started(seed: number, first: 0 | 1 = 0) {
  let s = createMatch({ now: 0, seed, mode: 'bot', difficulty: 'hard', length: 3, first })
  s = run(s, { type: 'setSecret', digits: [1, 2, 3] }, tick(INTRO_MS))
  return s
}

describe('경기 진행', () => {
  it('숫자를 정하지 않으면 20초 뒤 무작위로 정해진다', () => {
    const s = run(createMatch({ now: 0, seed: 1, mode: 'bot', difficulty: 'normal', length: 4 }), tick(TURN_MS))
    expect(isValidNumber(s.secrets[0]!, 4)).toBe(true)
    expect(s.phase.kind).toBe('intro')
  })

  it('규칙에 안 맞는 숫자는 못 정한다', () => {
    const s = run(createMatch({ now: 0, seed: 1, mode: 'bot', difficulty: 'normal', length: 3 }), {
      type: 'setSecret',
      digits: [0, 1, 2],
    })
    expect(s.locked[0]).toBe(false)
  })

  it('내가 부르면 바로 판정, 결과를 보여준 뒤 봇 차례', () => {
    let s = started(2, 0)
    expect(s.phase.kind).toBe('guessing')
    s = run(s, { type: 'guess', digits: [4, 5, 6] })
    expect(s.guesses[0][0].score).toEqual(score(s.secrets[1]!, [4, 5, 6]))
    expect(s.phase.kind).toBe('result')
    s = run(s, tick(INTRO_MS + RESULT_MS))
    expect(s.turn).toBe(1)
  })

  it('20초 안에 안 부르면 무작위로 불린다', () => {
    const s = run(started(3, 0), tick(INTRO_MS + TURN_MS))
    expect(s.guesses[0]).toHaveLength(1)
  })

  it('먼저 맞혀도 상대에게 같은 횟수의 기회가 있다', () => {
    // 내가 먼저: 첫 번째에 맞힘 → 봇도 한 번 부른 뒤 끝
    let s = started(4, 0)
    s = run(s, { type: 'guess', digits: s.secrets[1]! }, tick(INTRO_MS + RESULT_MS))
    expect(s.phase.kind).toBe('guessing')
    expect(s.turn).toBe(1)
    for (let t = INTRO_MS + RESULT_MS; s.phase.kind !== 'done'; t += 100) s = run(s, tick(t))
    expect(s.guesses[1]).toHaveLength(1)
    // 봇이 첫 번째에 123을 맞힐 일은 거의 없다
    expect(summarizeMatch(s)).toMatchObject({ outcome: 'win', tries: 1, foeTries: 1 })
  })

  it('봇끼리처럼 끝까지 가면 결과가 나온다', () => {
    for (let seed = 1; seed <= 20; seed++) {
      let s = started(seed, (seed % 2) as 0 | 1)
      for (let t = INTRO_MS; s.phase.kind !== 'done' && t < 2_000_000; t += 100) s = run(s, tick(t))
      expect(s.phase.kind).toBe('done')
      const sum = summarizeMatch(s)
      expect(Math.abs(sum.tries - sum.foeTries)).toBe(0)
    }
  })

  it('혼자 하기: 내 숫자 없이 바로 시작, 맞히면 승리', () => {
    let s = createMatch({ now: 0, seed: 9, mode: 'solo', difficulty: 'normal', length: 4 })
    expect(s.phase.kind).toBe('intro')
    s = run(s, tick(INTRO_MS), { type: 'guess', digits: s.secrets[1]! }, tick(INTRO_MS + RESULT_MS))
    expect(summarizeMatch(s)).toMatchObject({ mode: 'solo', outcome: 'win', tries: 1, foeTries: 0 })
  })

  it(`혼자 하기: ${SOLO_MAX_TRIES}번 안에 못 맞히면 실패`, () => {
    let s = createMatch({ now: 0, seed: 9, mode: 'solo', difficulty: 'normal', length: 3 })
    let t = INTRO_MS
    s = run(s, tick(t))
    const wrong = [1, 2, 3].join('') === s.secrets[1]!.join('') ? [4, 5, 6] : [1, 2, 3]
    while (s.phase.kind !== 'done') {
      s = run(s, { type: 'guess', digits: wrong })
      t += RESULT_MS
      s = run(s, tick(t))
    }
    expect(summarizeMatch(s)).toMatchObject({ outcome: 'lose', tries: SOLO_MAX_TRIES })
  })
})
