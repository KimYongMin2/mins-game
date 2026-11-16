import { STEP_HZ } from '../../games/volley/constants'
import { type Input, NO_INPUT, type SimState, createSim, step } from '../../games/volley/play/sim'
import type { Referee, RefereeContext } from '../hub'

// 점프 배구 서버 심판 (사용자 요청 2026-11-16 — 타이밍 게임도 서버로, 1초에 많이): 서버가 1초에 60번 물리를 돌리고 매 스텝 상태를 보낸다.
// 두 폰은 키만 보내고, 둘 다 예측(내 키는 바로 반영) → 서버 상태가 오면 되감아 맞춘다 (play/net.ts의 Guest, 방장 = 0번 자리).
// 예전엔 방장 폰이 물리를 돌려서 방장 키는 지연이 없고 친구만 늦었는데, 이제 둘 다 서버까지의 거리만큼 같게.

const STEP_MS = 1000 / STEP_HZ
/** 한 번에 따라잡는 최대 스텝 (서버가 잠깐 멈췄다 돌아와도 폭주하지 않게) */
const MAX_CATCHUP = 10

const isInput = (x: unknown): x is Input => {
  const i = x as Record<string, unknown>
  return !!i && typeof i === 'object' && ['left', 'right', 'jump', 'down', 'hit'].every((k) => typeof i[k] === 'boolean')
}

export function volleyReferee(setup: unknown, ctx: RefereeContext): Referee | null {
  const o = (setup ?? {}) as Record<string, unknown>
  const members = ctx.members()
  const host = members.find((m) => m.role === 'host')
  const guest = members.find((m) => m.role === 'guest')
  if (!host || !guest || (o.server !== 0 && o.server !== 1)) return null
  let sim: SimState = createSim(o.server)
  const t0 = ctx.now()
  const inputs: [Input, Input] = [NO_INPUT, NO_INPUT]
  /** 아주 짧게 눌렀다 뗀 치기도 한 스텝은 꼭 '누름'으로 */
  const tapped: [boolean, boolean] = [false, false]
  let doneAt: number | null = null
  return {
    tickMs: STEP_MS,
    input(from, msg) {
      const m = (msg ?? {}) as Record<string, unknown>
      if (m.t === 'state') return true // 폰이 보낸 상태는 버림
      if (m.t === 'ping') {
        ctx.sendTo(from, { t: 'pong', id: m.id })
        return true
      }
      if (m.t !== 'input') return false
      const side = from === host.id ? 0 : from === guest.id ? 1 : null
      if (side === null || !isInput(m.i)) return true
      if (m.i.hit && !inputs[side].hit) tapped[side] = true
      inputs[side] = { left: m.i.left, right: m.i.right, jump: m.i.jump, down: m.i.down, hit: m.i.hit }
      return true
    },
    tick(now) {
      const target = Math.floor((now - t0) / STEP_MS)
      let n = 0
      let used: [Input, Input] = inputs
      while (sim.tick < target && n < MAX_CATCHUP && sim.phase.kind !== 'done') {
        used = [tapped[0] ? { ...inputs[0], hit: true } : inputs[0], tapped[1] ? { ...inputs[1], hit: true } : inputs[1]]
        tapped[0] = tapped[1] = false
        sim = step(sim, used)
        n++
      }
      // 끝나면 한 번만 더 보냄
      if (n > 0 || (sim.phase.kind === 'done' && doneAt === null)) ctx.broadcast({ t: 'state', s: sim, i: used })
      if (doneAt === null && sim.phase.kind === 'done') doneAt = now
    },
    leave() {},
    finished: () => doneAt !== null && ctx.now() - doneAt > 5000,
  }
}
