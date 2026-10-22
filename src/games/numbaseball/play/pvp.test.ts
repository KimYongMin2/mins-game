import { describe, expect, it } from 'vitest'
import { createRng } from '../../../shared/random'
import { chooseBotGuess } from '../bot/guessBot'
import type { Length } from '../constants'
import { randomNumber } from '../rules/numbers'
import { type MatchState, createMatch, matchReducer, summarizeMatch } from './matchState'
import { type NumbaseballMsg, actionOf, firstOf, outbox } from './pvp'

// 방장·친구 두 기기를 가짜 통신(지연)으로 이어 경기 전체가 똑같이 흘러가는지 본다.

type Device = { state: MatchState; inbox: { at: number; msg: NumbaseballMsg }[] }

function simulate(seed: number, latencyMs: number, length: Length, opts: { idle?: boolean } = {}) {
  const rng = createRng(seed)
  const start = { t: 'start', length, guestFirst: rng.next() < 0.5 } as const
  const make = (role: 'host' | 'guest'): Device => ({
    state: createMatch({ now: 0, seed: seed + (role === 'host' ? 100 : 200), mode: 'pvp', difficulty: 'normal', length, first: firstOf(start, role) }),
    inbox: [],
  })
  const devices = [make('host'), make('guest')]
  // 사람 흉내: 잠깐 뒤 숫자를 정하고, 내 차례면 잠깐 뒤 단서에 맞는 숫자를 부른다 (idle이면 손 놓고 시간 초과)
  const actAt = [0, 0]
  for (let now = 0; now < 2_000_000; now += 16) {
    devices.forEach((d, i) => {
      const before = d.state
      let s = matchReducer(d.state, { type: 'tick', now })
      for (const m of d.inbox.filter((m) => m.at <= now)) {
        const a = actionOf(m.msg)
        if (a) s = matchReducer(s, a)
      }
      d.inbox = d.inbox.filter((m) => m.at > now)
      const canAct = (s.phase.kind === 'setup' && !s.locked[0]) || (s.phase.kind === 'guessing' && s.turn === 0)
      if (!opts.idle && canAct) {
        if (actAt[i] === 0) actAt[i] = now + 200 + rng.next() * 1500
        if (now >= actAt[i]) {
          actAt[i] = 0
          if (s.phase.kind === 'setup') s = matchReducer(s, { type: 'setSecret', digits: randomNumber(rng, length) })
          else {
            const clues = s.guesses[0].map((g) => ({ digits: g.digits, score: g.score! }))
            s = matchReducer(s, { type: 'guess', digits: chooseBotGuess(rng, length, clues, 'normal') })
          }
        }
      }
      for (const msg of outbox(before, s)) devices[1 - i].inbox.push({ at: now + latencyMs, msg })
      d.state = s
    })
    // 끝나고 숫자 공개까지 도착하면 그만
    if (devices.every((d) => d.state.phase.kind === 'done' && d.state.secrets[1])) break
  }
  return devices.map((d) => d.state)
}

describe('친구 대전 두 기기', () => {
  for (const latency of [0, 80, 400]) {
    for (const length of [3, 4] as const) {
      it(`지연 ${latency}ms · ${length}자리에도 두 기기의 경기가 똑같다`, () => {
        for (let seed = 1; seed <= 8; seed++) {
          const [host, guest] = simulate(seed, latency, length)
          expect(host.phase.kind).toBe('done')
          expect(guest.phase.kind).toBe('done')
          // 서로 자기가 0이라 뒤집어서 비교
          expect(host.guesses[0]).toEqual(guest.guesses[1])
          expect(host.guesses[1]).toEqual(guest.guesses[0])
          expect(host.secrets).toEqual([...guest.secrets].reverse())
          const [a, b] = [summarizeMatch(host), summarizeMatch(guest)]
          const flip = { win: 'lose', lose: 'win', draw: 'draw' } as const
          expect(a.outcome).toBe(flip[b.outcome])
          expect(a.tries).toBe(b.foeTries)
        }
      })
    }
  }

  it('둘 다 손을 놓으면 숫자도, 부르기도 시간 초과로 무작위가 되고 끝까지 간다', () => {
    const [host, guest] = simulate(3, 120, 3, { idle: true })
    expect(host.phase.kind).toBe('done')
    expect(host.guesses[0]).toEqual(guest.guesses[1])
    expect(host.guesses[0].length).toBeGreaterThan(0)
  })

  it('선공: 방장 쪽과 친구 쪽이 반대로 본다', () => {
    const msg = { t: 'start', length: 3, guestFirst: true } as const
    expect(firstOf(msg, 'guest')).toBe(0)
    expect(firstOf(msg, 'host')).toBe(1)
  })
})
