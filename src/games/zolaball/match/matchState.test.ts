import { describe, expect, it } from 'vitest'
import { PITCH_CHOICE_MS } from '../play/pitchSelection'
import { createRng } from '../../../shared/random'
import { INNINGS } from '../rules/game'
import {
  ANNOUNCE_MS,
  type MatchConfig,
  type MatchState,
  createMatch,
  isUserBatting,
  isUserPitching,
  matchReducer,
  summarize,
} from './matchState'

const FRAME = 16

function tickUntil(state: MatchState, done: (s: MatchState) => boolean, limitMs = 20000): MatchState {
  let s = state
  const end = s.now + limitMs
  while (!done(s)) {
    if (s.now > end) throw new Error(`시간 초과: phase=${s.phase.kind}`)
    s = matchReducer(s, { type: 'tick', now: s.now + FRAME })
  }
  return s
}

const atBat = (config: MatchConfig) => createMatch(config, 0, 123)

describe('경기 진행', () => {
  it('시작 안내 후 투구 선택으로 넘어간다', () => {
    const s = tickUntil(atBat({ difficulty: 'normal', userSide: 'away' }), (x) => x.phase.kind === 'choosing')
    expect(s.now).toBeGreaterThanOrEqual(ANNOUNCE_MS)
  })

  it('사용자 투수: 구종과 높이를 고르면 바로 던진다', () => {
    let s = tickUntil(atBat({ difficulty: 'normal', userSide: 'home' }), (x) => x.phase.kind === 'choosing')
    expect(isUserPitching(s)).toBe(true)
    s = matchReducer(s, { type: 'selectKey', key: 3 })
    expect(s.phase.kind).toBe('choosing')
    s = matchReducer(s, { type: 'selectHeight', height: 'low' })
    expect(s.phase.kind).toBe('pitching')
    if (s.phase.kind !== 'pitching') return
    expect(s.phase.pitch).toMatchObject({ type: 'breaking', isBall: false, height: 'low' })
    expect(s.phase.botSwing).not.toBeNull()
  })

  it('사용자 투수: 5초 안에 안 고르면 무작위로 던진다', () => {
    let s = tickUntil(atBat({ difficulty: 'normal', userSide: 'home' }), (x) => x.phase.kind === 'choosing')
    const startedAt = s.now
    s = matchReducer(s, { type: 'selectKey', key: 2 })
    s = tickUntil(s, (x) => x.phase.kind === 'pitching')
    expect(s.now - startedAt).toBeGreaterThanOrEqual(PITCH_CHOICE_MS)
    if (s.phase.kind !== 'pitching') return
    expect(s.phase.pitch).toMatchObject({ type: 'fastball', isBall: true }) // 고른 구종은 유지
  })

  it('사용자 타자: 도착 시점에 스윙하면 홈런', () => {
    let s = tickUntil(atBat({ difficulty: 'normal', userSide: 'away' }), (x) => x.phase.kind === 'pitching')
    expect(isUserBatting(s)).toBe(true)
    if (s.phase.kind !== 'pitching') return
    const { arriveAt } = s.phase.pitch
    s = matchReducer(s, { type: 'swing', at: arriveAt })
    s = tickUntil(s, (x) => x.phase.kind === 'result')
    if (s.phase.kind !== 'result') return
    expect(s.phase.event.plateResult).toBe('homerun')
    expect(s.phase.userDiffMs).toBe(0)
    expect(s.sounds.map((x) => x.name)).toEqual(['pitch', 'hit', 'cheer'])
    expect(s.game.linescore.away[0]).toBe(1)
    // 홈런 타구는 관중석으로 날아가고, 떨어진 뒤에야 다음으로 넘어간다
    expect(s.phase.batted?.kind).toBe('homerun')
    expect(s.phase.batted!.end.x).toBeGreaterThan(120)
    expect(s.phase.until).toBeGreaterThan(s.phase.batted!.startAt + s.phase.batted!.duration)
  })

  it('사용자 타자: 스윙하지 않으면 볼/스트라이크, 미트 소리', () => {
    let s = tickUntil(atBat({ difficulty: 'normal', userSide: 'away' }), (x) => x.phase.kind === 'pitching')
    if (s.phase.kind !== 'pitching') return
    const expected = s.phase.pitch.isBall ? 'ball' : 'calledStrike'
    s = tickUntil(s, (x) => x.phase.kind === 'result')
    if (s.phase.kind !== 'result') return
    expect(s.phase.event.outcome).toBe(expected)
    expect(s.sounds.map((x) => x.name)).toEqual(['pitch', 'mitt'])
    expect(s.phase.batted).toBeNull()
  })

  it('사용자가 타자가 아닐 때 스윙은 무시된다', () => {
    const s = tickUntil(atBat({ difficulty: 'normal', userSide: 'home' }), (x) => x.phase.kind === 'pitching')
    expect(matchReducer(s, { type: 'swing', at: s.now })).toBe(s)
  })
})

describe('경기 전체 시뮬레이션', () => {
  it.each([
    ['normal', 'away'],
    ['normal', 'home'],
    ['hard', 'away'],
    ['hard', 'home'],
  ] as const)('%s / 사용자 %s: 끝까지 진행되고 기록이 맞다', (difficulty, userSide) => {
    const rng = createRng(99)
    let s = createMatch({ difficulty, userSide }, 0, 7)
    let guard = 0
    while (s.phase.kind !== 'final') {
      if (++guard > 200000) throw new Error('경기가 끝나지 않음')
      // 사용자 투수는 바로 무작위로 고르고, 사용자 타자는 가끔 아무 때나 스윙
      if (s.phase.kind === 'choosing' && isUserPitching(s)) {
        s = matchReducer(s, { type: 'selectKey', key: (1 + Math.floor(rng.next() * 4)) as 1 | 2 | 3 | 4 })
        s = matchReducer(s, { type: 'selectHeight', height: rng.next() < 0.5 ? 'high' : 'low' })
      } else if (s.phase.kind === 'pitching' && isUserBatting(s) && !s.phase.swing && rng.next() < 0.02) {
        s = matchReducer(s, { type: 'swing', at: s.now })
      }
      s = matchReducer(s, { type: 'tick', now: s.now + FRAME })
    }

    const sum = summarize(s)
    expect(s.game.final).toBe(true)
    expect(s.game.linescore.away).toHaveLength(INNINGS)
    expect(s.game.linescore.home.length).toBeGreaterThanOrEqual(INNINGS - 1)
    expect(sum.outcome).toBe(sum.userRuns > sum.botRuns ? 'win' : sum.userRuns < sum.botRuns ? 'lose' : 'draw')
    expect(sum.userStats.hits).toBeLessThanOrEqual(sum.userStats.atBats)
    expect(s.sounds.at(-1)?.name).toBe('gameEnd')
  })
})
