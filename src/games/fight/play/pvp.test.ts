import { describe, expect, it } from 'vitest'
import { CHOOSE_MS } from '../constants'
import type { Stance } from '../rules/turn'
import { NET_GRACE_MS, type MatchState, createMatch, matchReducer, summarizeMatch } from './matchState'
import { type FightMsg, guestActionOf, guestPickMsg, hostActionOf, hostOutbox } from './pvp'

const STEP = 10

/**
 * 방장·친구 경기를 가짜 통신(지연 latency ms)으로 이어 끝까지 돌린다.
 * plan은 턴 번호를 받아 그 턴에 고를 자세와 고르는 시점(턴 시작 후 ms)을 정한다.
 */
function simulate(opts: {
  latency: number
  host: (turn: number, s: MatchState) => { stance: Stance; at: number } | null
  guest: (turn: number, s: MatchState) => { stance: Stance; at: number } | null
}) {
  let host = createMatch({ now: 0, seed: 1, difficulty: 'normal', controllers: ['user', 'remote'] })
  let guest = createMatch({ now: 0, seed: 2, difficulty: 'normal', controllers: ['user', 'remote'], follow: true })
  const wire: { at: number; to: 'host' | 'guest'; msg: FightMsg }[] = []
  const turnStart = { host: new Map<number, number>(), guest: new Map<number, number>() }
  const picked = { host: new Set<number>(), guest: new Set<number>() }
  let t = 0
  while ((host.phase.kind !== 'done' || guest.phase.kind !== 'done') && t < 300_000) {
    t += STEP
    for (const m of wire.filter((w) => w.at <= t)) {
      wire.splice(wire.indexOf(m), 1)
      if (m.to === 'guest') {
        const a = guestActionOf(m.msg)
        if (a) guest = matchReducer(guest, a)
      } else {
        const a = hostActionOf(m.msg)
        if (a) host = matchReducer(host, a)
      }
    }
    for (const who of ['host', 'guest'] as const) {
      const s = who === 'host' ? host : guest
      if (s.phase.kind !== 'choosing') continue
      const turn = s.phase.index
      if (!turnStart[who].has(turn)) turnStart[who].set(turn, t)
      const plan = (who === 'host' ? opts.host : opts.guest)(turn, s)
      if (!plan || picked[who].has(turn) || t - turnStart[who].get(turn)! < plan.at) continue
      picked[who].add(turn)
      if (who === 'host') host = matchReducer(host, { type: 'pick', side: 0, stance: plan.stance })
      else {
        guest = matchReducer(guest, { type: 'pick', side: 0, stance: plan.stance })
        const msg = guestPickMsg(guest, plan.stance)
        if (msg) wire.push({ at: t + opts.latency, to: 'host', msg })
      }
    }
    const prev = host
    host = matchReducer(host, { type: 'tick', now: t })
    for (const msg of hostOutbox(prev, host)) wire.push({ at: t + opts.latency, to: 'guest', msg })
    guest = matchReducer(guest, { type: 'tick', now: t })
  }
  return { host, guest }
}

/** 스택 있으면 치고 없으면 모으기 */
const aggressive = (_: number, s: MatchState) => ({ stance: (s.fighters[0].stacks > 0 ? 'attack' : 'ready') as Stance, at: 300 })

describe('친구 대전', () => {
  it('양쪽 경기가 똑같이 진행되고 결과가 반대로 나온다', () => {
    const { host, guest } = simulate({
      latency: 80,
      host: aggressive,
      guest: (turn) => ({ stance: turn % 3 === 1 ? 'guard' : 'ready', at: 500 }),
    })
    expect(guest.turns.length).toBe(host.turns.length)
    expect(guest.fighters).toEqual([host.fighters[1], host.fighters[0]])
    guest.turns.forEach((t, i) => expect(t.stances).toEqual([host.turns[i].stances[1], host.turns[i].stances[0]]))
    const h = summarizeMatch(host)
    const g = summarizeMatch(guest)
    expect(h.mode).toBe('pvp')
    expect(h.outcome).toBe('win')
    expect(g.outcome).toBe('lose')
  })

  it('친구가 시간 끝 무렵에 골라도 통신 여유 안이면 들어간다', () => {
    const { host } = simulate({
      latency: 150,
      host: () => ({ stance: 'guard', at: 0 }),
      guest: (_, s) => ({ stance: s.fighters[0].stacks > 0 ? 'attack' : 'guard', at: CHOOSE_MS - 100 }),
    })
    // 친구가 고른 방어가 매 턴 들어가서, 준비(기본값)로 처리된 턴이 없다
    expect(host.turns.every((t) => t.stances[1] === 'guard')).toBe(true)
  })

  it('여유보다 늦게 도착한 선택은 무시되고 준비로 처리', () => {
    const { host } = simulate({
      latency: NET_GRACE_MS + 200,
      host: aggressive,
      guest: () => ({ stance: 'guard', at: CHOOSE_MS - 50 }),
    })
    expect(host.turns[0].stances[1]).toBe('ready')
    expect(summarizeMatch(host).outcome).toBe('win')
  })

  it('시간이 끝나면 친구 화면에서도 더 못 고른다', () => {
    let guest = createMatch({ now: 0, seed: 2, difficulty: 'normal', controllers: ['user', 'remote'], follow: true })
    guest = matchReducer(guest, { type: 'remoteTurn', turn: 0 })
    guest = matchReducer(guest, { type: 'tick', now: CHOOSE_MS })
    expect(matchReducer(guest, { type: 'pick', side: 0, stance: 'guard' })).toBe(guest)
  })
})
