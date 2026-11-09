import { describe, expect, it } from 'vitest'
import { COUNTDOWN_MS, HP, MOVE_MAX, TURN_MS } from '../constants'
import { type EngineState, type Player, aliveIndexes, createEngine, engineReducer, ranksOf } from './engine'

const bots = (n: number): Player[] => Array.from({ length: n }, (_, i) => ({ id: `b${i}`, name: `봇${i}`, kind: 'bot' as const }))

/** 끝날 때까지 시간만 흘린다 (봇끼리) */
function playOut(s: EngineState, limitMs = 60 * 60_000): EngineState {
  let now = s.now
  while (s.phase.kind !== 'done' && now < limitMs) {
    now += 50
    s = engineReducer(s, { type: 'tick', now })
  }
  return s
}

describe('탱크 대전 진행', () => {
  it('시작 안내 뒤 첫 차례, 사람마다 다른 자리, 체력 가득', () => {
    let s = createEngine({ now: 0, seed: 1, players: bots(3) })
    expect(s.phase.kind).toBe('countdown')
    expect(new Set(s.tanks.map((t) => t.x)).size).toBe(3)
    expect(s.tanks.every((t) => t.hp === HP)).toBe(true)
    s = engineReducer(s, { type: 'tick', now: COUNTDOWN_MS })
    expect(s.phase.kind).toBe('aim')
    expect(s.turnNo).toBe(1)
  })

  it('차례인 사람만 조준, 움직이는 건 MOVE_MAX까지, 시간이 끝나면 겨눈 대로 발사', () => {
    const players: Player[] = [
      { id: 'me', name: '나', kind: 'user' },
      { id: 'f', name: '친구', kind: 'remote' },
    ]
    let s = createEngine({ now: 0, seed: 3, players })
    s = engineReducer(s, { type: 'tick', now: COUNTDOWN_MS })
    const me = s.turn
    const other = 1 - me
    const x0 = s.tanks[me].x
    expect(engineReducer(s, { type: 'aim', player: other, x: 0, angle: 10, power: 10 })).toBe(s)
    s = engineReducer(s, { type: 'aim', player: me, x: x0 + 100, angle: 200, power: 500 })
    expect(Math.abs(s.tanks[me].x - x0)).toBeLessThanOrEqual(MOVE_MAX)
    expect(s.tanks[me].angle).toBe(180)
    expect(s.tanks[me].power).toBe(100)
    s = engineReducer(s, { type: 'tick', now: COUNTDOWN_MS + TURN_MS })
    expect(s.phase.kind).toBe('flight')
  })

  for (const n of [2, 3, 4]) {
    for (const level of ['normal', 'hard'] as const) {
      it(`봇 ${n}명(${level})이 끝까지 하면 한 명이 남고 등수가 매겨진다`, () => {
        for (let seed = 1; seed <= 3; seed++) {
          const s = playOut(createEngine({ now: 0, seed: seed * 101 + n, players: bots(n), level }))
          expect(s.phase.kind).toBe('done')
          expect(aliveIndexes(s).length).toBeLessThanOrEqual(1)
          const ranks = ranksOf(s)
          expect(ranks.filter((r) => r === 1).length).toBeLessThanOrEqual(1)
          expect(Math.max(...ranks)).toBeLessThanOrEqual(n)
        }
      }, 60_000)
    }
  }

  it('어려움 봇이 일반 봇보다 잘 맞힌다 (1:1 여러 판)', () => {
    let hardWins = 0
    for (let seed = 1; seed <= 12; seed++) {
      const players: Player[] = bots(2)
      // 0번은 어려움처럼, 1번은 일반처럼: 레벨을 차례마다 바꿔 끼운다
      let s = createEngine({ now: 0, seed, players, level: 'hard' })
      let now = 0
      while (s.phase.kind !== 'done' && now < 3_600_000) {
        now += 50
        s = engineReducer({ ...s, level: s.turn === 0 ? 'hard' : 'normal' }, { type: 'tick', now })
      }
      if (ranksOf(s)[0] === 1) hardWins++
    }
    expect(hardWins).toBeGreaterThanOrEqual(8)
  }, 60_000)

  it('친구가 나가면 탈락, 그 사람 차례였으면 바로 다음 사람', () => {
    const players: Player[] = [
      { id: 'me', name: '나', kind: 'user' },
      { id: 'f1', name: '친구1', kind: 'remote' },
      { id: 'f2', name: '친구2', kind: 'remote' },
    ]
    let s = createEngine({ now: 0, seed: 5, players })
    s = engineReducer(s, { type: 'tick', now: COUNTDOWN_MS })
    const t = s.turn
    s = engineReducer(s, { type: 'drop', player: t })
    expect(s.tanks[t].alive).toBe(false)
    expect(s.turn).not.toBe(t)
    expect(s.phase.kind).toBe('aim')
    s = engineReducer(s, { type: 'drop', player: s.turn })
    expect(s.phase.kind).toBe('done')
    expect(ranksOf(s)[aliveIndexes(s)[0]]).toBe(1)
  })
})
