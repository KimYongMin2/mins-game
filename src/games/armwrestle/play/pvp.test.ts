import { describe, expect, it } from 'vitest'
import { type Event, PASS_MS } from '../constants'
import { type MatchAction, type MatchState, createMatch, matchReducer } from './matchState'
import { type ArmMsg, guestActionOf, guestPressOut, hostActionOf, hostSync, phaseChanged } from './pvp'

// 방장·친구 두 기기를 가짜 통신(지연)으로 이어 경기 전체가 똑같이 흘러가는지 본다.

type Inbox = { at: number; msg: ArmMsg }[]

function simulate(event: Event, latencyMs: number, rate: { host: number; guest: number }) {
  const make = (follow: boolean) => createMatch({ now: 0, seed: 1, event, difficulty: 'normal', controllers: ['user', 'remote'], follow })
  let host = make(false)
  let guest = make(true)
  const toHost: Inbox = []
  const toGuest: Inbox = []
  let lastSync = 0
  let sentTaps = 0
  const next = { host: 0, guest: 0 }
  // 연타: 초당 rate번 / 타이밍: 지나갈 때마다 가운데에서 rate만큼 벗어나 누름 (0 = 완벽)
  const act = (s: MatchState, who: 'host' | 'guest', now: number): MatchState => {
    if (s.phase.kind !== 'pull') return s
    if (event === 'mash') {
      if (now < next[who]) return s
      next[who] = now + 1000 / rate[who]
      return matchReducer(s, { type: 'tap' })
    }
    const elapsed = now - s.phase.start
    const pass = Math.floor(elapsed / PASS_MS)
    if (pass <= s.pressed[0] || elapsed % PASS_MS < PASS_MS / 2 + rate[who]) return s
    return matchReducer(s, { type: 'press', at: now })
  }
  const deliver = (inbox: Inbox, s: MatchState, now: number, toAction: (m: ArmMsg) => MatchAction | null) => {
    while (inbox.length && inbox[0].at <= now) {
      const a = toAction(inbox.shift()!.msg)
      if (a) s = matchReducer(s, a)
    }
    return s
  }
  for (let now = 0; now < 120_000; now += 16) {
    const hPrev = host
    host = act(deliver(toHost, matchReducer(host, { type: 'tick', now }), now, hostActionOf), 'host', now)
    if (phaseChanged(hPrev, host) || now - lastSync >= 100) {
      toGuest.push({ at: now + latencyMs, msg: hostSync(host) })
      lastSync = now
    }
    const gPrev = guest
    guest = act(deliver(toGuest, matchReducer(guest, { type: 'tick', now }), now, guestActionOf), 'guest', now)
    const press = guestPressOut(gPrev, guest)
    if (press) toHost.push({ at: now + latencyMs, msg: press })
    if (guest.taps[0] !== sentTaps && now % 96 === 0) {
      sentTaps = guest.taps[0]
      toHost.push({ at: now + latencyMs, msg: { t: 'taps', total: sentTaps } })
    }
    if (host.phase.kind === 'done' && guest.phase.kind === 'done') break
  }
  return { host, guest }
}

describe('친구 대전 두 기기', () => {
  for (const latency of [0, 80, 300]) {
    it(`연타전 지연 ${latency}ms: 더 빨리 누른 친구가 이기고, 두 기기 결과가 같다`, () => {
      const { host, guest } = simulate('mash', latency, { host: 5, guest: 8 })
      expect(host.phase).toMatchObject({ kind: 'done', winner: 1 })
      expect(guest.phase).toMatchObject({ kind: 'done', winner: 0 })
      expect(guest.wins).toEqual([host.wins[1], host.wins[0]])
    })

    it(`타이밍전 지연 ${latency}ms: 가운데에서 누른 쪽이 이기고, 두 기기 결과가 같다`, () => {
      const { host, guest } = simulate('timing', latency, { host: 5, guest: 200 })
      expect(host.phase).toMatchObject({ kind: 'done', winner: 0 })
      expect(guest.phase).toMatchObject({ kind: 'done', winner: 1 })
      expect(guest.wins).toEqual([host.wins[1], host.wins[0]])
      expect(guest.perfects[0]).toBe(0)
    })
  }

  it('친구 화면 위치는 방장과 반대 방향', () => {
    const host = createMatch({ now: 0, seed: 1, event: 'mash', difficulty: 'normal', controllers: ['user', 'remote'] })
    const a = guestActionOf(hostSync({ ...host, pos: 0.4 }))
    expect(a).toMatchObject({ type: 'sync', sync: { pos: -0.4 } })
  })
})
