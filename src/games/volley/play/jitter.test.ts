import { expect, it } from 'vitest'

// 통신이 들쭉날쭉할 때(TCP라 늦은 메시지 뒤로 줄줄이 밀림) 친구 화면이 멈추거나 공이 튀지 않는지
import { botInput, createBotMind } from '../bot/volleyBot'
import { STEP_HZ } from '../constants'
import { type Guest, STATE_HZ, createGuest, guestReceive, guestStep, withRtt } from './net'
import { type Input, NO_INPUT, type SimState, createSim, step } from './sim'

function run(base: number, jitter: number) {
  const ms = 1000 / STEP_HZ
  let host: SimState = createSim(0)
  let guest: Guest = createGuest(createSim(0))
  for (let i = 0; i < 10; i++) guest = withRtt(guest, base * 2 + jitter)
  let hm = createBotMind(1), gm = createBotMind(2)
  const q: { at: number; s: SimState; i: [Input, Input] }[] = []
  let lastAt = 0
  let seed = 7
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647)
  let stalls = 0, frames = 0, jumps = 0, bigJump = 0
  for (let k = 0; k < STEP_HZ * 60; k++) {
    const now = k * ms
    const h = botInput(host, 0, 'normal', hm); hm = h.mind
    host = step(host, [h.input, NO_INPUT])
    if (host.tick % (STEP_HZ / STATE_HZ) === 0) {
      // TCP: 순서 유지, 늦으면 뒤 메시지도 같이 밀림
      lastAt = Math.max(lastAt, now + base + (rnd() < 0.2 ? rnd() * jitter : rnd() * jitter * 0.2))
      q.push({ at: lastAt, s: host, i: [h.input, NO_INPUT] })
    }
    while (q.length && q[0].at <= now) {
      const m = q.shift()!
      const before = guest.local
      guest = guestReceive(guest, m.s, m.i)
      if (before.phase.kind === 'rally' && guest.local.phase.kind === 'rally') {
        const d = Math.hypot(before.ball.x - guest.local.ball.x, before.ball.y - guest.local.ball.y)
        if (d > 0.3) jumps++
        bigJump = Math.max(bigJump, d)
      }
    }
    const g = botInput(guest.local, 1, 'normal', gm); gm = g.mind
    const t0 = guest.local.tick
    guest = guestStep(guest, g.input)
    frames++
    if (guest.local.tick === t0) stalls++
  }
  return { stalls: stalls / frames, jumps }

}
it('흔들리는 통신에서도 친구 화면이 거의 안 멈추고 공이 덜 튄다', () => {
  for (const [b, j] of [[40, 100], [80, 150], [150, 200], [250, 300]]) {
    const r = run(b, j)
    expect(r.stalls).toBeLessThan(0.03)
    expect(r.jumps).toBeLessThan(80)
  }
})
