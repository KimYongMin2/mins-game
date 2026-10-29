import { describe, expect, it } from 'vitest'
import { createRng } from '../../../shared/random'
import { chooseBotPlay } from '../bot/tilesBot'
import { type EngineState, type Player, createEngine, engineReducer } from './engine'
import type { TilesMsg } from './pvp'
import { type ScreenState, createScreen, myIndex, myTurn, screenReducer, toView, viewChanged } from './view'

// 방장 한 명 + 친구 여럿을 가짜 통신(지연)으로 이어 끝까지 해 본다.
// 친구들은 자기 차례면 잠깐 뒤 봇처럼 낸다(없으면 가져오기). 방장은 손 놓고 시간 초과로만 가져온다.
// lazy면 친구는 짜던 바닥(draft)만 보내고 [내려놓기]를 안 누른다 → 시간 초과 때 그대로 내려놓아져야 한다.

function simulate(guests: number, latencyMs: number, seed: number, lazy = false) {
  const rng = createRng(seed)
  const players: Player[] = [{ id: 'host', name: '방장', kind: 'user' }, ...Array.from({ length: guests }, (_, i) => ({ id: `g${i}`, name: `친구${i}`, kind: 'remote' as const }))]
  let engine: EngineState = createEngine({ now: 0, seed, players })
  const screens: ScreenState[] = players.slice(1).map((p) => createScreen(p.id, 0))
  const toGuests: { at: number; msg: TilesMsg }[] = []
  const toHost: { at: number; msg: TilesMsg }[] = []
  const actAt: (number | null)[] = screens.map(() => null)
  let last: ReturnType<typeof toView> | null = null
  let lastAt = 0
  let plays = 0
  let guestPlays = 0
  let lastSeq = 0
  for (let now = 0; now < 50_000_000; now += 100) {
    engine = engineReducer(engine, { type: 'tick', now })
    for (const m of toHost.filter((m) => m.at <= now)) {
      const i = players.findIndex((p) => p.id === (m.msg as { from?: string }).from)
      if (m.msg.t === 'play') engine = engineReducer(engine, { type: 'play', player: i, table: m.msg.table })
      if (m.msg.t === 'draw') engine = engineReducer(engine, { type: 'draw', player: i })
      if (m.msg.t === 'draft') engine = engineReducer(engine, { type: 'draft', player: i, turnSeq: m.msg.turnSeq, table: m.msg.table })
    }
    toHost.splice(0, toHost.length, ...toHost.filter((m) => m.at > now))
    // 친구가 낸 것 세기 (lazy면 모두 시간 초과로 들어간 것)
    if (engine.last && engine.last.seq !== lastSeq) {
      lastSeq = engine.last.seq
      if (engine.last.kind === 'play' && engine.last.player > 0) guestPlays++
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
      if (myTurn(next)) {
        actAt[gi] ??= now + 200 + rng.next() * 800
        if (now >= actAt[gi]!) {
          actAt[gi] = Infinity // 다음 차례까지 기다림
          const v = next.view!
          const me = myIndex(next)
          const table = chooseBotPlay(v.table, v.hands[me], v.melded[me])
          if (table) plays++
          const turnSeq = v.last?.seq ?? 0
          const msg: TilesMsg = !table ? { t: 'draw', from: id } : lazy ? { t: 'draft', from: id, turnSeq, table } : { t: 'play', from: id, table }
          toHost.push({ at: now + latencyMs, msg })
        }
      } else actAt[gi] = null
      screens[gi] = next
    })
    if (engine.phase.kind === 'done' && screens.every((s) => s.view?.phase === 'done')) break
  }
  return { engine, screens, plays, guestPlays }
}

describe('친구 대전 (방장 + 친구 여럿)', () => {
  for (const [guests, latency] of [
    [1, 0],
    [2, 80],
    [3, 200],
  ] as const) {
    it(`${guests + 1}명 · 지연 ${latency}ms: 끝까지 가고 모두 같은 순위·바닥을 본다`, () => {
      for (let seed = 1; seed <= 3; seed++) {
        const { engine, screens, plays } = simulate(guests, latency, seed)
        expect(engine.phase.kind).toBe('done')
        const final = toView(engine)
        for (const s of screens) {
          expect(s.view?.ranking).toEqual(final.ranking)
          expect(s.view?.table).toEqual(final.table)
        }
        expect(plays).toBeGreaterThan(3)
      }
    }, 120_000)
  }

  it('친구가 짜 놓기만 하고 안 내도, 시간이 끝나면 맞는 바닥은 그대로 내려놓아진다', () => {
    const { engine, plays, guestPlays } = simulate(2, 80, 4, true)
    expect(engine.phase.kind).toBe('done')
    expect(plays).toBeGreaterThan(3)
    expect(guestPlays).toBe(plays)
  }, 120_000)
})
