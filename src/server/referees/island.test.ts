import { describe, expect, it } from 'vitest'
import type { RefereeContext } from '../hub'
import { islandReferee } from './island'

function fakeCtx(members: { id: string; role: 'host' | 'guest' }[]) {
  let now = 1000
  const all: { to?: string; m: Record<string, unknown> }[] = []
  const ctx: RefereeContext = {
    now: () => now,
    members: () => members.map((m) => ({ ...m, nickname: `닉${m.id}` })),
    broadcast: (m) => all.push({ m: m as Record<string, unknown> }),
    sendTo: (to, m) => all.push({ to, m: m as Record<string, unknown> }),
  }
  return { ctx, all, advance: (ms: number) => (now += ms), get now() { return now } }
}
type SnapMsg = { t: 'snap'; ctl: string; ph: string; n: number; win: unknown; cs: number; c: unknown[] }
const lastSnap = (all: { m: Record<string, unknown> }[]) => [...all].reverse().find((x) => x.m.t === 'snap')?.m as unknown as SnapMsg

describe('동물 섬 대작전 서버 심판', () => {
  it('hello엔 씨앗값·명단, 차례인 사람만 조작, 파인 곳은 번호가 이어짐, 끝까지 감', () => {
    const f = fakeCtx([{ id: 'H', role: 'host' }, { id: 'G', role: 'guest' }])
    const ref = islandReferee({ players: [{ id: 'H', name: '가짜' }, { id: 'G' }] }, f.ctx)!
    expect(ref).not.toBeNull()
    expect(ref.input('G', { t: 'hello' })).toBe(true)
    const init = f.all.find((x) => x.m.t === 'init')!
    expect(init.to).toBe('G')
    expect(JSON.stringify(init.m)).toContain('닉H')
    expect(JSON.stringify(init.m)).not.toContain('가짜')
    expect(ref.input('H', { t: 'rtc-offer' })).toBe(false)

    let carves = 0
    let guard = 0
    let firstTurn = true
    let turns = 0
    while (!ref.finished() && guard++ < 60 * 60 * 6) {
      f.advance(1000 / 60)
      ref.tick(f.now)
      const s = lastSnap(f.all)
      if (!s) continue
      if (s.cs + s.c.length > carves) {
        expect(s.cs).toBeLessThanOrEqual(carves)
        carves = s.cs + s.c.length
      }
      turns = Math.max(turns, s.n)
      if (s.ph === 'aim' && s.ctl) {
        const other = s.ctl === 'H' ? 'G' : 'H'
        if (firstTurn) {
          // 남의 차례에 누른 건 무시
          ref.input(other, { t: 'pick', w: 'gull' })
          ref.tick(f.now)
          expect(JSON.stringify(lastSnap(f.all))).not.toContain('"wp":"gull"')
          firstTurn = false
        }
        // 차례인 사람: 물풍선을 상대 쪽으로 세게
        ref.input(s.ctl, { t: 'aim', a: 35 })
        ref.input(s.ctl, { t: 'press' })
        ref.input(s.ctl, { t: 'release', p: 0.4 + Math.random() * 0.5 })
      }
    }
    expect(turns).toBeGreaterThan(6)
    expect(carves).toBeGreaterThan(0)
  }, 60_000)

  it('사람이 나가도 같은 팀 봇이 이어서 하고, 봇끼리 끝까지 간다', () => {
    const f = fakeCtx([{ id: 'H', role: 'host' }])
    const ref = islandReferee({ players: [{ id: 'H' }, { id: 'bot0' }, { id: 'bot1' }, { id: 'bot2' }] }, f.ctx)!
    ref.leave('H')
    let guard = 0
    while (!ref.finished() && guard++ < 60 * 60 * 30) {
      f.advance(1000 / 60)
      ref.tick(f.now)
    }
    expect(lastSnap(f.all).win).not.toBeNull()
  }, 60_000)

  it('한 팀이 모두 나가면 남은 팀 승리', () => {
    const f = fakeCtx([{ id: 'H', role: 'host' }, { id: 'G', role: 'guest' }])
    const ref = islandReferee({ players: [{ id: 'H' }, { id: 'G' }] }, f.ctx)!
    f.advance(100)
    ref.tick(f.now)
    ref.leave('G')
    expect(lastSnap(f.all).win).toBe(0)
  })

  it('개인전: 사람마다 자기 편(4편), 나간 편은 사라지고 남은 봇끼리 끝까지', () => {
    const f = fakeCtx([{ id: 'H', role: 'host' }])
    const ref = islandReferee({ players: [{ id: 'H' }, { id: 'bot0' }, { id: 'bot1' }, { id: 'bot2' }], teams: null }, f.ctx)!
    ref.input('H', { t: 'hello' })
    const init = f.all.find((x) => x.m.t === 'init')!.m as { sides: number; players: { team: number }[] }
    expect(init.sides).toBe(4)
    expect(init.players.map((p) => p.team)).toEqual([0, 1, 2, 3])
    ref.leave('H')
    let guard = 0
    while (!ref.finished() && guard++ < 60 * 60 * 40) {
      f.advance(1000 / 60)
      ref.tick(f.now)
    }
    const win = lastSnap(f.all).win
    expect(win === 1 || win === 2 || win === 3 || win === 'draw').toBe(true)
  }, 60_000)

  it('팀전: 고른 팀대로 두 편, 한 팀이 비면 번갈아', () => {
    const f = fakeCtx([{ id: 'H', role: 'host' }, { id: 'G', role: 'guest' }])
    const ref = islandReferee({ players: [{ id: 'H' }, { id: 'G' }, { id: 'bot0' }], teams: [0, 0, 1] }, f.ctx)!
    ref.input('H', { t: 'hello' })
    const init = f.all.find((x) => x.m.t === 'init')!.m as { sides: number; players: { team: number }[] }
    expect(init.sides).toBe(2)
    expect(init.players.map((p) => p.team)).toEqual([0, 0, 1])
    const f2 = fakeCtx([{ id: 'H', role: 'host' }, { id: 'G', role: 'guest' }])
    const ref2 = islandReferee({ players: [{ id: 'H' }, { id: 'G' }], teams: [1, 1] }, f2.ctx)!
    ref2.input('H', { t: 'hello' })
    expect((f2.all.find((x) => x.m.t === 'init')!.m as { players: { team: number }[] }).players.map((p) => p.team)).toEqual([0, 1])
  })

  it('봇 자리도 됨, 방에 없는 사람은 안 됨', () => {
    const f = fakeCtx([{ id: 'H', role: 'host' }])
    expect(islandReferee({ players: [{ id: 'H' }, { id: 'X' }] }, f.ctx)).toBeNull()
    expect(islandReferee({ players: [{ id: 'H' }, { id: 'bot0', name: '봇' }] }, f.ctx)).not.toBeNull()
  })
})
