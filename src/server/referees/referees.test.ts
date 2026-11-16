import { describe, expect, it } from 'vitest'
import type { RefereeContext } from '../hub'
import { rouletteReferee } from './roulette'

function fakeCtx(members: { id: string; role: 'host' | 'guest' }[]) {
  let now = 1000
  const all: unknown[] = []
  const ctx: RefereeContext = {
    now: () => now,
    members: () => members.map((m) => ({ ...m, nickname: m.id })),
    broadcast: (m) => all.push(m),
    sendTo: () => {},
  }
  return { ctx, all, advance: (ms: number) => (now += ms), get now() { return now } }
}

describe('러시안룰렛 서버 심판', () => {
  it('끝까지 가고, 화면엔 총알 칸이 안 나가고, 남의 차례엔 못 쏨', () => {
    const f = fakeCtx([{ id: 'H', role: 'host' }, { id: 'G', role: 'guest' }])
    const ref = rouletteReferee({ players: [{ id: 'H', name: '가짜이름' }, { id: 'G' }, { id: 'bot0', name: '봇' }], teams: null }, f.ctx)!
    expect(ref).not.toBeNull()
    let guard = 0
    while (!ref.finished() && guard++ < 20000) {
      f.advance(50)
      ref.tick(f.now)
      const v = (f.all.at(-1) as { v: { phase: string; turn: number; alive: boolean[]; players: { id: string }[] } }).v
      if (v.phase === 'aim') {
        const turnId = v.players[v.turn].id
        const other = turnId === 'H' ? 'G' : 'H'
        const target = v.alive.findIndex((a, i) => a && i !== v.turn)
        // 차례가 아닌 사람이 당겨도 아무 일 없음
        const before = JSON.stringify(f.all.at(-1))
        expect(ref.input(other, { t: 'pull', target })).toBe(true)
        if (turnId !== 'bot0') expect(JSON.stringify(f.all.at(-1))).toBe(before)
        if (turnId !== 'bot0') ref.input(turnId, { t: 'pull', target })
      }
    }
    expect(ref.finished()).toBe(true)
    expect(JSON.stringify(f.all)).not.toContain('chamber')
    // 사람 이름은 서버가 아는 닉네임
    expect(JSON.stringify(f.all[0])).not.toContain('가짜이름')
  })

  it('방에 없는 사람을 넣으면 시작 안 함, 모르는 메시지는 그대로 전달', () => {
    const f = fakeCtx([{ id: 'H', role: 'host' }])
    expect(rouletteReferee({ players: [{ id: 'H' }, { id: 'X' }] }, f.ctx)).toBeNull()
    const ref = rouletteReferee({ players: [{ id: 'H' }, { id: 'bot0' }] }, f.ctx)!
    expect(ref.input('H', { t: 'rtc-offer' })).toBe(false)
  })
})
