import { describe, expect, it } from 'vitest'
import { createRng } from '../../../shared/random'
import { type EngineState, type Player, createEngine, engineReducer } from './engine'
import type { RouletteMsg } from './pvp'
import { type ScreenState, createScreen, isMyTurn, myIndex, screenReducer, toView, viewChanged } from './view'

// 방장 한 명 + 친구 여럿을 가짜 통신(지연)으로 이어 끝까지 해 본다.
// 차례가 오면 아무나 골라 조금 뒤 쏜다 (가끔은 손 놓고 시간 초과).

function simulate(guests: number, latencyMs: number, seed: number) {
  const rng = createRng(seed)
  const players: Player[] = [{ id: 'host', name: '방장', kind: 'user' }, ...Array.from({ length: guests }, (_, i) => ({ id: `g${i}`, name: `친구${i}`, kind: 'remote' as const }))]
  let engine: EngineState = createEngine({ now: 0, seed, players })
  const screens: ScreenState[] = players.slice(1).map((p) => createScreen(p.id, 0))
  const toGuests: { at: number; msg: RouletteMsg }[] = []
  const toHost: { at: number; msg: RouletteMsg }[] = []
  const planAt: (number | null)[] = players.map(() => null)
  let last: ReturnType<typeof toView> | null = null
  let lastAt = 0
  let leaked = false
  const pick = (alive: boolean[]) => {
    const live = alive.flatMap((a, i) => (a ? [i] : []))
    return live[Math.floor(rng.next() * live.length)]
  }
  for (let now = 0; now < 3_000_000; now += 16) {
    engine = engineReducer(engine, { type: 'tick', now })
    for (const m of toHost.filter((m) => m.at <= now)) {
      const msg = m.msg
      if (msg.t !== 'aim' && msg.t !== 'pull') continue
      const player = players.findIndex((p) => p.id === msg.from)
      engine = engineReducer(engine, msg.t === 'aim' ? { type: 'aim', player, target: msg.target } : { type: 'pull', player, target: msg.target })
    }
    toHost.splice(0, toHost.length, ...toHost.filter((m) => m.at > now))
    // 방장 본인
    if (engine.phase.kind === 'aim' && engine.turn === 0) {
      planAt[0] ??= now + rng.next() * 3000
      if (now >= planAt[0]) engine = engineReducer(engine, { type: 'pull', player: 0, target: pick(engine.alive) })
    } else planAt[0] = null
    const view = toView(engine)
    if ('chamber' in view) leaked = true
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
      if (isMyTurn(next)) {
        planAt[gi + 1] ??= rng.next() < 0.05 ? Infinity : now + rng.next() * 4000
        if (now >= planAt[gi + 1]!) {
          const target = pick(next.view!.alive)
          toHost.push({ at: now + latencyMs, msg: { t: 'aim', from: players[gi + 1].id, target } })
          toHost.push({ at: now + latencyMs, msg: { t: 'pull', from: players[gi + 1].id, target } })
          planAt[gi + 1] = Infinity
        }
      } else planAt[gi + 1] = null
      screens[gi] = next
    })
    if (engine.phase.kind === 'done' && screens.every((s) => s.view?.phase === 'done')) break
  }
  return { engine, screens, leaked }
}

describe('친구 대전 (방장 + 친구 여럿)', () => {
  for (const [guests, latency] of [
    [1, 0],
    [3, 80],
    [5, 250],
    [7, 80],
  ] as const) {
    it(`${guests + 1}명 · 지연 ${latency}ms: 끝까지 가고 모두 같은 등수를 본다`, () => {
      for (let seed = 1; seed <= 5; seed++) {
        const { engine, screens, leaked } = simulate(guests, latency, seed)
        expect(engine.phase.kind).toBe('done')
        expect(leaked).toBe(false)
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
