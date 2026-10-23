import { describe, expect, it } from 'vitest'
import { createRng } from '../../../shared/random'
import { type EngineState, type Player, createEngine, engineReducer } from './engine'
import type { SurvivalMsg } from './pvp'
import { type ScreenState, canPlan, createScreen, myIndex, screenReducer, toView, viewChanged } from './view'

// 방장 한 명 + 친구 여럿을 가짜 통신(지연)으로 이어 끝까지 해 본다.
// 친구들은 라운드마다 아무 때나 자리·방향을 고르고 확정한다 (가끔은 안 하고 시간 초과).

function simulate(guests: number, latencyMs: number, seed: number) {
  const rng = createRng(seed)
  const players: Player[] = [{ id: 'host', name: '방장', kind: 'user' }, ...Array.from({ length: guests }, (_, i) => ({ id: `g${i}`, name: `친구${i}`, kind: 'remote' as const }))]
  let engine: EngineState = createEngine({ now: 0, seed, players })
  const screens: ScreenState[] = players.slice(1).map((p) => createScreen(p.id, 0))
  const toGuests: { at: number; msg: SurvivalMsg }[] = []
  const toHost: { at: number; msg: SurvivalMsg }[] = []
  const planAt: (number | null)[] = screens.map(() => null)
  let last: ReturnType<typeof toView> | null = null
  let lastAt = 0
  let peeked = false
  for (let now = 0; now < 3_000_000; now += 16) {
    engine = engineReducer(engine, { type: 'tick', now })
    for (const m of toHost.filter((m) => m.at <= now)) {
      if (m.msg.t !== 'plan' || m.msg.round !== engine.round) continue
      const from = m.msg.from
      engine = engineReducer(engine, { type: 'plan', player: players.findIndex((p) => p.id === from), plan: m.msg.plan })
    }
    toHost.splice(0, toHost.length, ...toHost.filter((m) => m.at > now))
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
      if (next.view?.phase === 'plan' && next.view.reveal) peeked = true
      if (canPlan(next)) {
        planAt[gi] ??= rng.next() < 0.1 ? Infinity : now + rng.next() * 8000
        if (now >= planAt[gi]!) {
          next = screenReducer(next, { type: 'place', pos: { x: (rng.next() - 0.5) * 60, y: (rng.next() - 0.5) * 60 } })
          next = screenReducer(next, { type: 'aim', angle: rng.next() * Math.PI * 2 })
          next = screenReducer(next, { type: 'lock' })
          toHost.push({ at: now + latencyMs, msg: { t: 'plan', from: players[gi + 1].id, round: next.view!.round, plan: next.draft } })
        }
      } else planAt[gi] = null
      screens[gi] = next
    })
    if (engine.phase.kind === 'done' && screens.every((s) => s.view?.phase === 'done')) break
  }
  return { engine, screens, peeked }
}

describe('친구 대전 (방장 + 친구 여럿)', () => {
  for (const [guests, latency] of [
    [1, 0],
    [3, 80],
    [5, 250],
  ] as const) {
    it(`${guests + 1}명 · 지연 ${latency}ms: 끝까지 가고 모두 같은 등수를 본다`, () => {
      for (let seed = 1; seed <= 5; seed++) {
        const { engine, screens, peeked } = simulate(guests, latency, seed)
        expect(engine.phase.kind).toBe('done')
        expect(peeked).toBe(false)
        const ranks = toView(engine).ranks
        expect(ranks.filter((r) => r === 1)).toHaveLength(1)
        for (const s of screens) {
          expect(s.view?.ranks).toEqual(ranks)
          expect(myIndex(s)).toBeGreaterThan(0)
        }
      }
    })
  }

  it('고르는 동안 보내는 화면에는 다른 사람 자리가 없다', () => {
    let s = createEngine({ now: 0, seed: 1, players: [{ id: 'a', name: 'a', kind: 'user' }, { id: 'b', name: 'b', kind: 'remote' }] })
    s = engineReducer(s, { type: 'tick', now: 5000 })
    s = engineReducer(s, { type: 'plan', player: 0, plan: { pos: { x: 1, y: 2 }, angle: 0, locked: true } })
    const v = toView(s)
    expect(v.phase).toBe('plan')
    expect(JSON.stringify(v)).not.toContain('"x"')
    expect(v.locked).toEqual([0])
  })
})
