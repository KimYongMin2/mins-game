import { describe, expect, it } from 'vitest'
import { createRng } from '../../../shared/random'
import { movesFor } from '../rules/moves'
import { type EngineState, type Player, createEngine, engineReducer } from './engine'
import type { YutMsg } from './pvp'
import { type ScreenState, createScreen, myIndex, myMove, myThrow, screenReducer, toView, viewChanged } from './view'

// 방장 한 명 + 친구 여럿을 가짜 통신(지연)으로 이어 끝까지 해 본다.
// 친구들은 자기 차례면 잠깐 뒤 던지고, 할 수 있는 움직임 중 아무거나 고른다. 방장은 손 놓고 시간 초과로만 둔다.

function simulate(guests: number, latencyMs: number, seed: number, pieceCount: number) {
  const rng = createRng(seed)
  const players: Player[] = [{ id: 'host', name: '방장', kind: 'user' }, ...Array.from({ length: guests }, (_, i) => ({ id: `g${i}`, name: `친구${i}`, kind: 'remote' as const }))]
  let engine: EngineState = createEngine({ now: 0, seed, players, pieceCount })
  const screens: ScreenState[] = players.slice(1).map((p) => createScreen(p.id, 0))
  const toGuests: { at: number; msg: YutMsg }[] = []
  const toHost: { at: number; msg: YutMsg }[] = []
  const actAt: (number | null)[] = screens.map(() => null)
  let last: ReturnType<typeof toView> | null = null
  let lastAt = 0
  let sent = 0
  for (let now = 0; now < 20_000_000; now += 50) {
    engine = engineReducer(engine, { type: 'tick', now })
    for (const m of toHost.filter((m) => m.at <= now)) {
      const i = players.findIndex((p) => p.id === (m.msg as { from?: string }).from)
      if (m.msg.t === 'throw') engine = engineReducer(engine, { type: 'throw', player: i })
      if (m.msg.t === 'move') engine = engineReducer(engine, { type: 'move', player: i, throwIdx: m.msg.throwIdx, from: m.msg.piece })
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
      const id = players[gi + 1].id
      const canAct = myThrow(next) || myMove(next)
      if (canAct) {
        actAt[gi] ??= now + 100 + rng.next() * 400
        if (now >= actAt[gi]!) {
          actAt[gi] = Infinity // 다음 화면이 올 때까지 기다림
          if (myThrow(next)) toHost.push({ at: now + latencyMs, msg: { t: 'throw', from: id } })
          else {
            const moves = movesFor(next.view!.pieces, myIndex(next), next.view!.pending)
            const m = moves[Math.floor(rng.next() * moves.length)]
            toHost.push({ at: now + latencyMs, msg: { t: 'move', from: id, throwIdx: m.throwIdx, piece: m.from } })
          }
          sent++
        }
      } else actAt[gi] = null
      // 새 화면이 오면 다시 행동할 수 있게
      if (next.view !== s.view && actAt[gi] === Infinity) actAt[gi] = null
      screens[gi] = next
    })
    if (engine.phase.kind === 'done' && screens.every((s) => s.view?.phase === 'done')) break
  }
  return { engine, screens, sent }
}

describe('친구 대전 (방장 + 친구 여럿)', () => {
  for (const [guests, latency, pieces] of [
    [1, 0, 2],
    [2, 80, 3],
    [3, 200, 2],
  ] as const) {
    it(`${guests + 1}명 · 지연 ${latency}ms · 말 ${pieces}개: 끝까지 가고 모두 같은 판을 본다`, () => {
      for (let seed = 1; seed <= 3; seed++) {
        const { engine, screens, sent } = simulate(guests, latency, seed, pieces)
        expect(engine.phase.kind).toBe('done')
        const final = toView(engine)
        for (const s of screens) {
          expect(s.view?.winner).toBe(final.winner)
          expect(s.view?.pieces).toEqual(final.pieces)
        }
        expect(sent).toBeGreaterThan(5)
      }
    }, 60_000)
  }
})
