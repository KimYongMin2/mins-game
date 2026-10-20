import { describe, expect, it } from 'vitest'
import { COUNTDOWN_MS, type Event, PASS_MS, ROUND_END_MS, ROUND_MS, TAP_PUSH } from '../constants'
import { type Controller, type MatchState, type Pair, createMatch, matchReducer, summarizeMatch } from './matchState'

const at = (s: MatchState, now: number) => matchReducer(s, { type: 'tick', now })

function pulling(event: Event, controllers: Pair<Controller> = ['user', 'bot']) {
  return at(createMatch({ now: 0, seed: 1, event, difficulty: 'normal', controllers }), COUNTDOWN_MS)
}

describe('연타전', () => {
  it('3·2·1 동안엔 안 밀리고, 당기기가 시작되면 누를 때마다 내 쪽으로', () => {
    let s = createMatch({ now: 0, seed: 1, event: 'mash', difficulty: 'normal', controllers: ['user', 'remote'] })
    expect(matchReducer(s, { type: 'tap' })).toBe(s)
    s = at(s, COUNTDOWN_MS)
    expect(s.phase.kind).toBe('pull')
    s = matchReducer(s, { type: 'tap' })
    expect(s.pos).toBeCloseTo(TAP_PUSH)
    expect(s.taps[0]).toBe(1)
  })

  it('끝까지 넘기면 그 판 승리, 2판 먼저 이기면 경기 승리', () => {
    let s = pulling('mash', ['user', 'remote'])
    const win = (s: MatchState) => {
      while (s.phase.kind === 'pull') s = matchReducer(s, { type: 'tap' })
      return s
    }
    s = win(s)
    expect(s.phase).toMatchObject({ kind: 'roundEnd', winner: 0 })
    expect(s.wins).toEqual([1, 0])
    s = at(s, s.now + ROUND_END_MS)
    expect(s.phase.kind).toBe('countdown')
    expect(s.pos).toBe(0)
    s = win(at(s, s.now + COUNTDOWN_MS))
    s = at(s, s.now + ROUND_END_MS)
    expect(s.phase).toMatchObject({ kind: 'done', winner: 0 })
    expect(summarizeMatch(s)).toMatchObject({ outcome: 'win', wins: [2, 0], mode: 'pvp' })
  })

  it('친구가 보낸 총 횟수만큼 상대 쪽으로 (같은 걸 또 받아도 한 번만)', () => {
    let s = pulling('mash', ['user', 'remote'])
    s = matchReducer(s, { type: 'remoteTaps', total: 3 })
    expect(s.pos).toBeCloseTo(-3 * TAP_PUSH)
    expect(matchReducer(s, { type: 'remoteTaps', total: 3 })).toBe(s)
  })

  it('15초가 끝나면 더 넘긴 쪽, 정확히 가운데면 그 판 다시', () => {
    let s = matchReducer(pulling('mash', ['user', 'remote']), { type: 'tap' })
    s = at(s, COUNTDOWN_MS + ROUND_MS)
    expect(s.phase).toMatchObject({ kind: 'roundEnd', winner: 0 })
    let even = at(pulling('mash', ['user', 'remote']), COUNTDOWN_MS + ROUND_MS)
    expect(even.phase).toMatchObject({ kind: 'roundEnd', winner: null })
    even = at(even, even.now + ROUND_END_MS)
    expect(even.round).toBe(2)
    expect(even.wins).toEqual([0, 0])
  })

  it('봇은 초당 몇 번씩 눌러 손을 넘긴다', () => {
    let s = pulling('mash')
    s = at(s, COUNTDOWN_MS + 3000)
    expect(s.taps[1]).toBeGreaterThan(10)
    expect(s.pos).toBeLessThan(0)
  })
})

describe('타이밍전', () => {
  it('지나갈 때 한 번만 누를 수 있고, 가운데일수록 많이 민다', () => {
    let s = pulling('timing', ['user', 'remote'])
    const start = COUNTDOWN_MS
    s = matchReducer(s, { type: 'press', at: start + PASS_MS / 2 })
    expect(s.lastGrade[0]?.grade).toBe('perfect')
    const after = s.pos
    expect(after).toBeGreaterThan(0.1)
    expect(matchReducer(s, { type: 'press', at: start + PASS_MS / 2 + 10 })).toBe(s)
    // 다음 지나감에 끝 쪽에서 누르면 놓침
    s = matchReducer(s, { type: 'press', at: start + PASS_MS + 20 })
    expect(s.lastGrade[0]?.grade).toBe('miss')
    expect(s.pos).toBe(after)
  })

  it('연타는 타이밍전에서 안 먹힌다', () => {
    const s = pulling('timing', ['user', 'remote'])
    expect(matchReducer(s, { type: 'tap' })).toBe(s)
  })

  it('봇은 지나갈 때마다 한 번 판정한다', () => {
    let s = pulling('timing')
    for (let t = COUNTDOWN_MS; t < COUNTDOWN_MS + PASS_MS * 6; t += 16) s = at(s, t)
    expect(s.pressed[1]).toBeGreaterThanOrEqual(4)
  })
})

/** 봇끼리 끝까지 */
function playOut(event: Event, seed: number): MatchState {
  let s = createMatch({ now: 0, seed, event, difficulty: 'hard', controllers: ['bot', 'bot'] })
  for (let now = 0; now < 200_000 && s.phase.kind !== 'done'; now += 16) s = at(s, now)
  return s
}

describe('경기 전체', () => {
  it('봇끼리 두 종목 모두 누군가 2판을 먼저 이기며 끝난다', () => {
    for (const event of ['mash', 'timing'] as const) {
      for (let seed = 0; seed < 10; seed++) {
        const s = playOut(event, seed)
        expect(s.phase.kind).toBe('done')
        expect(Math.max(...s.wins)).toBe(2)
      }
    }
  })
})
