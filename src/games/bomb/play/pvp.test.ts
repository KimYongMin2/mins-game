import { describe, expect, it } from 'vitest'
import { createRng } from '../../../shared/random'
import { type EngineState, type Player, createEngine, engineReducer, neighborsOf } from './engine'
import type { BombMsg } from './pvp'
import { type ScreenState, createScreen, myIndex, screenReducer, toView, viewChanged } from './view'

// 방장 한 명 + 친구 여럿을 가짜 통신(지연)으로 이어 끝까지 해 본다. 친구들은 폭탄을 받으면 잠깐 뒤 아무에게나 던진다.

function simulate(guests: number, latencyMs: number, seed: number) {
  const rng = createRng(seed)
  const players: Player[] = [{ id: 'host', name: '방장', kind: 'user' }, ...Array.from({ length: guests }, (_, i) => ({ id: `g${i}`, name: `친구${i}`, kind: 'remote' as const }))]
  let engine: EngineState = createEngine({ now: 0, seed, players })
  const screens: ScreenState[] = players.slice(1).map((p) => createScreen(p.id, 0))
  const toGuests: { at: number; msg: BombMsg }[] = []
  const toHost: { at: number; msg: BombMsg }[] = []
  const throwAt: (number | null)[] = screens.map(() => null)
  let last: ReturnType<typeof toView> | null = null
  let lastAt = 0
  for (let now = 0; now < 600_000; now += 16) {
    engine = engineReducer(engine, { type: 'tick', now })
    for (const m of toHost.filter((m) => m.at <= now)) {
      if (m.msg.t !== 'pass') continue
      const { from, to } = m.msg
      engine = engineReducer(engine, { type: 'pass', from: players.findIndex((p) => p.id === from), to: players.findIndex((p) => p.id === to) })
    }
    toHost.splice(0, toHost.length, ...toHost.filter((m) => m.at > now))
    // 방장 본인도 들고 있으면 0.5초 뒤 던짐
    if (engine.phase.kind === 'play' && engine.holder === 0 && !engine.flight && rng.next() < 0.05) {
      const side = neighborsOf(engine.alive, 0)!
      engine = engineReducer(engine, { type: 'pass', from: 0, to: side[Math.floor(rng.next() * 2)] })
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
      const v = next.view
      const me = myIndex(next)
      if (v && v.phase === 'play' && v.holder === me && !next.flight && v.alive[me]) {
        throwAt[gi] ??= now + 200 + rng.next() * 800
        if (now >= throwAt[gi]!) {
          const side = neighborsOf(v.alive, me)!
          toHost.push({ at: now + latencyMs, msg: { t: 'pass', from: players[me].id, to: players[side[Math.floor(rng.next() * 2)]].id } })
          throwAt[gi] = null
        }
      } else throwAt[gi] = null
      screens[gi] = next
    })
    if (engine.phase.kind === 'done' && screens.every((s) => s.view?.phase === 'done')) break
  }
  return { engine, screens }
}

describe('친구 대전 (방장 + 친구 여럿)', () => {
  for (const [guests, latency] of [
    [1, 0],
    [3, 80],
    [5, 250],
  ] as const) {
    it(`${guests + 1}명 · 지연 ${latency}ms: 끝까지 가고 모두 같은 순위를 본다`, () => {
      for (let seed = 1; seed <= 5; seed++) {
        const { engine, screens } = simulate(guests, latency, seed)
        expect(engine.phase.kind).toBe('done')
        expect(engine.out).toHaveLength(guests)
        for (const s of screens) expect(s.view?.ranking).toEqual(toView(engine).ranking)
        // 친구들도 실제로 던졌다
        expect(engine.passes.slice(1).some((n) => n > 0)).toBe(true)
      }
    })
  }
})
