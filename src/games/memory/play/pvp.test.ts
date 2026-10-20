import { describe, expect, it } from 'vitest'
import { createRng } from '../../../shared/random'
import { PICK_MS } from '../constants'
import { type MatchState, canFlip, createMatch, matchReducer, pairsOf } from './matchState'
import { type MemoryMsg, actionOf, firstOf, outbox } from './pvp'

// 방장·친구 두 기기를 가짜 통신(지연)으로 이어 경기 전체가 똑같이 흘러가는지 본다.

type Device = { state: MatchState; inbox: { at: number; msg: MemoryMsg }[] }

function simulate(seed: number, latencyMs: number, opts: { idle?: boolean; untilMs?: number } = {}) {
  const rng = createRng(seed)
  const start = { t: 'start', deckSeed: seed * 7 + 1, guestFirst: rng.next() < 0.5 } as const
  const make = (role: 'host' | 'guest'): Device => ({
    state: createMatch({ now: 0, seed: seed + (role === 'host' ? 100 : 200), difficulty: 'normal', controllers: ['user', 'remote'], deckSeed: start.deckSeed, first: firstOf(start, role) }),
    inbox: [],
  })
  const devices = [make('host'), make('guest')]
  // 사람 흉내: 내 차례가 되면 잠깐 뒤 아무 카드나 연다 (idle이면 손 놓고 시간 초과)
  const nextPickAt = [0, 0]
  for (let now = 0; now < (opts.untilMs ?? 600_000); now += 16) {
    devices.forEach((d, i) => {
      const before = d.state
      let s = matchReducer(d.state, { type: 'tick', now })
      for (const m of d.inbox.filter((m) => m.at <= now)) {
        const a = actionOf(m.msg)
        if (a) s = matchReducer(s, a)
      }
      d.inbox = d.inbox.filter((m) => m.at > now)
      if (!opts.idle && s.turn === 0 && s.phase.kind === 'picking') {
        if (nextPickAt[i] === 0) nextPickAt[i] = now + 200 + rng.next() * 600
        if (now >= nextPickAt[i]) {
          const closed = s.cards.flatMap((_, k) => (canFlip(s, k) ? [k] : []))
          s = matchReducer(s, { type: 'pick', index: closed[Math.floor(rng.next() * closed.length)] })
          nextPickAt[i] = 0
        }
      }
      for (const msg of outbox(before, s)) devices[1 - i].inbox.push({ at: now + latencyMs, msg })
      d.state = s
    })
    if (devices.every((d) => d.state.phase.kind === 'done')) break
  }
  return devices.map((d) => d.state)
}

describe('친구 대전 두 기기', () => {
  for (const latency of [0, 80, 400]) {
    it(`지연 ${latency}ms에도 두 기기의 경기가 똑같다`, () => {
      for (let seed = 1; seed <= 15; seed++) {
        const [host, guest] = simulate(seed, latency)
        expect(host.phase.kind).toBe('done')
        expect(guest.phase.kind).toBe('done')
        // 같은 카드를 같은 사람이 가져감 (서로 자기가 0이라 뒤집어서 비교)
        expect(host.cards.map((c) => c.owner)).toEqual(guest.cards.map((c) => (c.owner === null ? null : 1 - c.owner)))
        expect(pairsOf(host)).toEqual([...pairsOf(guest)].reverse())
        expect(host.flips.length).toBe(guest.flips.length)
      }
    })
  }

  it('둘 다 손을 놓으면 각자 자기 차례에 시간 초과로 열리고, 연 순서가 똑같다', () => {
    const [host, guest] = simulate(3, 120, { idle: true, untilMs: PICK_MS * 30 })
    // 시간 초과만으로 아무 카드나 열면 끝까지 오래 걸리므로 중간까지만 본다
    expect(host.flips.length).toBeGreaterThan(20)
    const n = Math.min(host.flips.length, guest.flips.length)
    expect(host.flips.slice(0, n).map((f) => [f.index, 1 - f.side])).toEqual(guest.flips.slice(0, n).map((f) => [f.index, f.side]))
  })

  it('선공: 방장 쪽과 친구 쪽이 반대로 본다', () => {
    const msg = { t: 'start', deckSeed: 1, guestFirst: true } as const
    expect(firstOf(msg, 'guest')).toBe(0)
    expect(firstOf(msg, 'host')).toBe(1)
  })
})
