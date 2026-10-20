import { describe, expect, it } from 'vitest'
import { createRng } from '../../../shared/random'
import { type EngineState, HANDS, type Player, createEngine, engineReducer } from './engine'
import type { NunchiMsg } from './pvp'
import { type ScreenState, canCall, canPick, createScreen, myIndex, screenReducer, toView, viewChanged } from './view'

// 방장 한 명 + 친구 여럿을 가짜 통신(지연)으로 이어 끝까지 해 본다.
// 친구들은 판마다 아무 때나 한 번 외치고, 결승에 오르면 아무 손이나 고른다.

function simulate(guests: number, latencyMs: number, seed: number) {
  const rng = createRng(seed)
  const players: Player[] = [{ id: 'host', name: '방장', kind: 'user' }, ...Array.from({ length: guests }, (_, i) => ({ id: `g${i}`, name: `친구${i}`, kind: 'remote' as const }))]
  let engine: EngineState = createEngine({ now: 0, seed, players })
  const screens: ScreenState[] = players.slice(1).map((p) => createScreen(p.id, 0))
  const toGuests: { at: number; msg: NunchiMsg }[] = []
  const toHost: { at: number; msg: NunchiMsg }[] = []
  const planAt: (number | null)[] = screens.map(() => null)
  let hostPlan: number | null = null
  let last: ReturnType<typeof toView> | null = null
  let lastAt = 0
  for (let now = 0; now < 900_000; now += 16) {
    engine = engineReducer(engine, { type: 'tick', now })
    for (const m of toHost.filter((m) => m.at <= now)) {
      const i = m.msg.t === 'press' || m.msg.t === 'pick' ? players.findIndex((p) => p.id === (m.msg as { from: string }).from) : -1
      if (m.msg.t === 'press') engine = engineReducer(engine, { type: 'press', player: i })
      if (m.msg.t === 'pick') engine = engineReducer(engine, { type: 'pick', player: i, hand: m.msg.hand })
    }
    toHost.splice(0, toHost.length, ...toHost.filter((m) => m.at > now))
    // 방장 본인도 판마다 한 번
    if (engine.phase.kind === 'call' && engine.alive[0] && !engine.presses.some((p) => p.player === 0)) {
      hostPlan ??= now + rng.next() * 6000
      if (now >= hostPlan) engine = engineReducer(engine, { type: 'press', player: 0 })
    } else hostPlan = null
    if (engine.phase.kind === 'rps' && engine.alive[0] && engine.picks[0] === undefined) {
      engine = engineReducer(engine, { type: 'pick', player: 0, hand: HANDS[Math.floor(rng.next() * 3)] })
    }
    const view = toView(engine)
    if (viewChanged(last, view) || now - lastAt >= 1000) {
      toGuests.push({ at: now + latencyMs, msg: { t: 'view', v: view } })
      last = view
      lastAt = now
    }
    const arrived = toGuests.filter((m) => m.at <= now)
    toGuests.splice(0, toGuests.length, ...toGuests.filter((m) => m.at > now))
    screens.forEach((s, gi) => {
      let next = screenReducer(s, { type: 'tick', now })
      for (const m of arrived) if (m.msg.t === 'view') next = screenReducer(next, { type: 'view', view: m.msg.v })
      const id = players[gi + 1].id
      if (canCall(next)) {
        planAt[gi] ??= now + rng.next() * 6000
        if (now >= planAt[gi]!) {
          toHost.push({ at: now + latencyMs, msg: { t: 'press', from: id } })
          planAt[gi] = Infinity // 결과가 올 때까지 다시 안 누름
        }
      } else planAt[gi] = null
      if (canPick(next) && !next.myHand) {
        const hand = HANDS[Math.floor(rng.next() * 3)]
        toHost.push({ at: now + latencyMs, msg: { t: 'pick', from: id, hand } })
        next = screenReducer(next, { type: 'myHand', hand })
      }
      screens[gi] = next
    })
    if (engine.phase.kind === 'done' && screens.every((s) => s.view?.phase === 'done')) break
  }
  return { engine, screens }
}

describe('친구 대전 (방장 + 친구 여럿)', () => {
  for (const [guests, latency] of [
    [2, 0],
    [3, 80],
    [5, 200],
  ] as const) {
    it(`${guests + 1}명 · 지연 ${latency}ms: 끝까지 가고 모두 같은 등수를 본다`, () => {
      for (let seed = 1; seed <= 5; seed++) {
        const { engine, screens } = simulate(guests, latency, seed)
        expect(engine.phase.kind).toBe('done')
        const ranks = toView(engine).ranks
        expect(ranks.filter((r) => r === 1)).toHaveLength(1)
        for (const s of screens) {
          expect(s.view?.ranks).toEqual(ranks)
          expect(myIndex(s)).toBeGreaterThan(0)
        }
      }
    })
  }
})
