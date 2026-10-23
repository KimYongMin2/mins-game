import { describe, expect, it } from 'vitest'
import { createRng } from '../../../shared/random'
import { chooseMove } from '../bot/omokBot'
import { type MatchState, createMatch, matchReducer, stoneOf, summarizeMatch } from './matchState'
import { type OmokMsg, actionOf, outbox, pickerOf } from './pvp'

// 방장·친구 두 기기를 가짜 통신(지연)으로 이어 경기 전체가 똑같이 흘러가는지 본다.

type Device = { state: MatchState; inbox: { at: number; msg: OmokMsg }[] }

function simulate(seed: number, latencyMs: number, opts: { idle?: boolean } = {}) {
  const rng = createRng(seed)
  const start = { t: 'start', guestPicks: rng.next() < 0.5, blackCard: rng.next() < 0.5 ? 0 : 1 } as const
  const make = (role: 'host' | 'guest'): Device => ({
    state: createMatch({
      now: 0,
      seed: seed + (role === 'host' ? 100 : 200),
      mode: 'pvp',
      difficulty: 'normal',
      picker: pickerOf(start, role),
      blackCard: start.blackCard,
    }),
    inbox: [],
  })
  const devices = [make('host'), make('guest')]
  // 사람 흉내: 잠깐 뒤 카드를 고르고, 내 차례면 잠깐 뒤 둔다 (idle이면 손 놓고 시간 초과)
  const actAt = [0, 0]
  for (let now = 0; now < 50_000_000; now += 16) {
    devices.forEach((d, i) => {
      const before = d.state
      let s = matchReducer(d.state, { type: 'tick', now })
      for (const m of d.inbox.filter((m) => m.at <= now)) {
        const a = actionOf(m.msg)
        if (a) s = matchReducer(s, a)
      }
      d.inbox = d.inbox.filter((m) => m.at > now)
      const canAct = (s.phase.kind === 'pick' && s.picker === 0) || (s.phase.kind === 'playing' && s.turn === 0)
      if (!opts.idle && canAct) {
        if (actAt[i] === 0) actAt[i] = now + 100 + rng.next() * 800
        if (now >= actAt[i]) {
          actAt[i] = 0
          if (s.phase.kind === 'pick') s = matchReducer(s, { type: 'pick', card: rng.next() < 0.5 ? 0 : 1 })
          else s = matchReducer(s, { type: 'place', pos: chooseMove(rng, s.board, stoneOf(s, 0), 'normal') })
        }
      }
      for (const msg of outbox(before, s)) devices[1 - i].inbox.push({ at: now + latencyMs, msg })
      d.state = s
    })
    if (devices.every((d) => d.state.phase.kind === 'done')) break
  }
  return devices.map((d) => d.state)
}

function expectSame(host: MatchState, guest: MatchState) {
  expect(host.phase.kind).toBe('done')
  expect(guest.phase.kind).toBe('done')
  expect(host.moves).toEqual(guest.moves)
  expect(host.board).toEqual(guest.board)
  // 서로 자기가 0이라 뒤집어서 비교
  expect(host.black).toBe(1 - guest.black!)
  const flip = { win: 'lose', lose: 'win', draw: 'draw' } as const
  expect(summarizeMatch(host).outcome).toBe(flip[summarizeMatch(guest).outcome])
}

describe('친구 대전 두 기기', () => {
  for (const latency of [0, 80, 400]) {
    it(`지연 ${latency}ms에도 두 기기의 경기가 똑같다`, () => {
      for (let seed = 1; seed <= 6; seed++) {
        const [host, guest] = simulate(seed, latency)
        expectSame(host, guest)
      }
    })
  }

  it('둘 다 손을 놓으면 카드도, 수도 시간 초과로 정해지고 끝까지 간다', () => {
    const [host, guest] = simulate(3, 120, { idle: true })
    expectSame(host, guest)
  })

  it('카드 고를 쪽: 방장 쪽과 친구 쪽이 반대로 본다', () => {
    const msg = { t: 'start', guestPicks: true, blackCard: 0 } as const
    expect(pickerOf(msg, 'guest')).toBe(0)
    expect(pickerOf(msg, 'host')).toBe(1)
  })
})
