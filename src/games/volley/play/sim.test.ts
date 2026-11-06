import { describe, expect, it } from 'vitest'
import { BALL_R, BUMP_UP, CEILING, COURT_W, GRAVITY, JUMP_SPEED, NET_X, PLAYER_CY, SPIKE_SIDE_FAST, SPIKE_SIDE_SLOW, STEP_HZ, WIN_SCORE } from '../constants'
import { type Input, NO_INPUT, type SimState, createSim, sideBounds, step, winnerOf } from './sim'

const idle: [Input, Input] = [NO_INPUT, NO_INPUT]
const run = (s: SimState, n: number, inputs: readonly [Input, Input] = idle) => {
  for (let i = 0; i < n; i++) s = step(s, inputs)
  return s
}
/** 서브 대기를 건너뛰고 공을 마음대로 놓은 랠리 상태 */
function rally(ball: SimState['ball'], patch: Partial<SimState> = {}): SimState {
  const s = createSim(0)
  return { ...s, ball, phase: { kind: 'rally' }, ...patch }
}
const inp = (p: Partial<Input>): Input => ({ ...NO_INPUT, ...p })
/** 0번 선수를 바꾼 랠리 */
const withMe = (ball: SimState['ball'], me: Partial<SimState['players'][0]>) => {
  const base = createSim(0)
  return rally(ball, { players: [{ ...base.players[0], ...me }, base.players[1]] })
}
/** 공이 몸에 맞을 때까지 */
function untilHit(s: SimState, inputs: readonly [Input, Input] = idle, max = 60) {
  const seq = s.hitSeq
  for (let i = 0; i < max && (s.hitSeq === seq || s.lastHit?.kind === 'wall' || s.lastHit?.kind === 'net'); i++) s = step(s, inputs)
  return s
}

describe('선수', () => {
  it('점프 높이는 물리대로 (v²/2g, 약 4.7m)', () => {
    let s = createSim(0)
    s = step(s, [inp({ jump: true }), NO_INPUT])
    let top = 0
    for (let i = 0; i < STEP_HZ * 2; i++) {
      s = step(s, idle)
      top = Math.max(top, s.players[0].y)
    }
    expect(top).toBeCloseTo((JUMP_SPEED * JUMP_SPEED) / (2 * GRAVITY), 0)
    expect(s.players[0].y).toBe(0)
  })

  it('네트에 붙지 못한다', () => {
    const s = run({ ...createSim(0), phase: { kind: 'point', scorer: 0, t: 9999 } }, STEP_HZ * 3, [inp({ right: true }), inp({ left: true })])
    expect(s.players[0].x).toBe(sideBounds(0)[1])
    expect(s.players[1].x).toBe(sideBounds(1)[0])
    expect(sideBounds(0)[1]).toBeLessThan(NET_X - 1)
  })

  it('땅에서 방향키 + 치기 = 몸 날리기 (약 3m), 끝나면 잠깐 누워 있음', () => {
    let s: SimState = { ...createSim(0), phase: { kind: 'point', scorer: 0, t: 9999 } }
    const x0 = s.players[0].x
    s = step(s, [inp({ hit: true, right: true }), NO_INPUT])
    expect(s.players[0].dive).toBe(1)
    for (let i = 0; i < 60 && s.players[0].dive; i++) s = step(s, idle)
    expect(s.players[0].recover).toBeGreaterThan(0)
    expect(s.players[0].x - x0).toBeGreaterThan(2)
    expect(s.players[0].x - x0).toBeLessThan(4)
  })

  it('땅에서 방향키 없이 치기는 아무것도 안 함', () => {
    const s = step(createSim(0), [inp({ hit: true }), NO_INPUT])
    expect(s.players[0].dive).toBe(0)
    expect(s.players[0].power).toBe(false)
  })

  it('공중에서 치기를 누르면 땅에 닿을 때까지 치는 자세', () => {
    let s = step(createSim(0), [inp({ jump: true }), NO_INPUT])
    s = run(s, 5)
    s = step(s, [inp({ hit: true }), NO_INPUT])
    expect(s.players[0].power).toBe(true)
    s = run(s, STEP_HZ * 2)
    expect(s.players[0].y).toBe(0)
    expect(s.players[0].power).toBe(false)
  })
})

describe('공', () => {
  it('떨어지면 바닥에 닿은 쪽 상대가 1점', () => {
    let s = withMe({ x: 4, y: 3, vx: 0, vy: 0 }, { x: 6.5 })
    s = run(s, STEP_HZ)
    expect(s.score).toEqual([0, 1])
    expect(s.phase.kind).toBe('point')
  })

  it('벽에 맞으면 속도 그대로 튕겨 나온다', () => {
    let s = rally({ x: 1, y: 7, vx: -10, vy: 0 })
    s = run(s, 10)
    expect(s.ball.vx).toBeCloseTo(10)
    expect(s.lastHit?.kind).toBe('wall')
  })

  it('천장에 닿으면 아래로 툭 떨어진다', () => {
    let s = rally({ x: 4, y: 8, vx: 2, vy: 30 })
    s = run(s, 10)
    expect(s.ball.vy).toBeLessThan(0)
    expect(s.ball.y).toBeLessThanOrEqual(CEILING - BALL_R)
  })

  it('네트 옆면에 맞으면 되돌아온다', () => {
    let s = rally({ x: NET_X - 2, y: 1.5, vx: 12, vy: 3 })
    s = run(s, 15)
    expect(s.ball.vx).toBeLessThan(0)
    expect(s.ball.x).toBeLessThan(NET_X)
  })

  it('네트 꼭대기에 떨어지면 위로 튄다', () => {
    let s = rally({ x: NET_X - 0.3, y: 5, vx: 0.5, vy: 0 })
    for (let i = 0; i < 40 && s.lastHit?.kind !== 'net'; i++) s = step(s, idle)
    expect(s.lastHit?.kind).toBe('net')
    s = step(s, idle)
    expect(s.ball.vy).toBeGreaterThan(0)
  })

  it('네트 위로는 넘어간다', () => {
    let s = rally({ x: NET_X - 2, y: 5.5, vx: 8, vy: 2 })
    s = run(s, 40)
    expect(s.ball.x).toBeGreaterThan(NET_X)
  })
})

describe('몸에 맞으면', () => {
  it('몸 가운데에 떨어진 공은 거의 수직으로 위로 튄다', () => {
    let s = withMe({ x: 3.02, y: 6, vx: 0, vy: 0 }, { x: 3 })
    s = untilHit(s)
    expect(s.lastHit?.kind).toBe('bump')
    expect(s.ball.vy).toBeGreaterThanOrEqual(BUMP_UP)
    expect(Math.abs(s.ball.vx)).toBeLessThan(1.5)
  })

  it('몸 앞쪽(네트 쪽)에 맞을수록 네트 쪽으로 멀리 간다', () => {
    const near = untilHit(withMe({ x: 3.3, y: 6, vx: 0, vy: 0 }, { x: 3 }))
    const far = untilHit(withMe({ x: 4, y: 6, vx: 0, vy: 0 }, { x: 3 }))
    expect(near.ball.vx).toBeGreaterThan(0)
    expect(far.ball.vx).toBeGreaterThan(near.ball.vx * 2)
    // 뒤쪽에 맞으면 뒤로
    const back = untilHit(withMe({ x: 2.2, y: 6, vx: 0, vy: 0 }, { x: 3 }))
    expect(back.ball.vx).toBeLessThan(0)
  })

  it('빠르게 떨어진 공은 그만큼 빠르게 위로 튄다 (속도를 잃지 않음)', () => {
    let s = withMe({ x: 3.1, y: 4, vx: 0, vy: -25 }, { x: 3 })
    s = untilHit(s)
    expect(s.ball.vy).toBeGreaterThan(24)
  })

  it('겹쳐 있는 동안엔 한 번만 튄다', () => {
    let s = withMe({ x: 3.1, y: 2.5, vx: 0, vy: -3 }, { x: 3 })
    s = untilHit(s)
    const seq = s.hitSeq
    s = run(s, 3)
    expect(s.hitSeq).toBe(seq)
  })
})

describe('스파이크', () => {
  // 오른쪽 선수(1번)로도 해 본다: 상대 쪽이 왼쪽(-x)
  function spikeWith(side: 0 | 1, input: Partial<Input>) {
    const base = createSim(0)
    const x = side === 0 ? NET_X - 3 : NET_X + 3
    const me = { ...base.players[side], x, y: 3, vy: 0, power: true, prevHit: true }
    const players = side === 0 ? [me, base.players[1]] : [base.players[0], me]
    const s = rally({ x: x + 0.1, y: me.y + PLAYER_CY + 1.3, vx: 0, vy: -5 }, { players: players as SimState['players'] })
    const inputs: [Input, Input] = side === 0 ? [inp({ hit: true, ...input }), NO_INPUT] : [NO_INPUT, inp({ hit: true, ...input })]
    const after = untilHit(s, inputs)
    expect(after.lastHit?.kind).toBe('spike')
    expect(after.spikes[side]).toBe(1)
    // 상대 쪽 기준으로 돌려서 비교
    return { vx: after.ball.vx * (side === 0 ? 1 : -1), vy: after.ball.vy }
  }

  for (const side of [0, 1] as const) {
    it(`${side === 0 ? '왼쪽' : '오른쪽'} 선수: ←→ 빠르게 · 없음 보통, ↑ 위로 · ↓ 아래로 · 없음 수평 (늘 상대 쪽)`, () => {
      const none = spikeWith(side, {})
      const toward = spikeWith(side, side === 0 ? { right: true } : { left: true })
      const away = spikeWith(side, side === 0 ? { left: true } : { right: true })
      const up = spikeWith(side, { jump: true })
      const down = spikeWith(side, { down: true })
      expect(none.vx).toBeCloseTo(SPIKE_SIDE_SLOW)
      expect(toward.vx).toBeCloseTo(SPIKE_SIDE_FAST)
      expect(away.vx).toBeCloseTo(SPIKE_SIDE_FAST)
      expect(none.vy).toBeCloseTo(0)
      expect(up.vy).toBeGreaterThanOrEqual(BUMP_UP * 2)
      expect(down.vy).toBeLessThanOrEqual(-BUMP_UP * 2)
    })
  }

  it('네트 가까이서 내리찍으면 상대 코트에 꽂힌다', () => {
    const base = createSim(0)
    // 점프 꼭대기에서 몸 앞쪽 높이 닿은 공 (낮으면 네트에 걸린다)
    const me = { ...base.players[0], x: NET_X - 1.2, y: 4.5, vy: 0, power: true, prevHit: true }
    let s = rally({ x: me.x + 1, y: me.y + PLAYER_CY + 1.3, vx: 0, vy: -3 }, { players: [me, base.players[1]] })
    s = untilHit(s, [inp({ hit: true, down: true, right: true }), NO_INPUT])
    expect(s.lastHit?.kind).toBe('spike')
    s = run(s, STEP_HZ * 2)
    expect(s.score).toEqual([1, 0])
  })

  it('치는 자세가 아니면 공중에서도 그냥 튄다', () => {
    let s = withMe({ x: 3.1, y: 7, vx: 0, vy: 0 }, { x: 3, y: 2, vy: 0 })
    s = untilHit(s, [inp({ down: true }), NO_INPUT])
    expect(s.lastHit?.kind).toBe('bump')
  })
})

describe('경기', () => {
  it('15점 먼저 (듀스 없음)', () => {
    expect(winnerOf([WIN_SCORE, 14])).toBe(0)
    expect(winnerOf([14, WIN_SCORE])).toBe(1)
    expect(winnerOf([14, 14])).toBeNull()
  })

  it('점수를 낸 쪽이 다음 서브, 공은 그 사람 쪽 하늘 꼭대기에서', () => {
    let s = withMe({ x: 4, y: 2, vx: 0, vy: -5 }, { x: 6.5 })
    for (let i = 0; i < STEP_HZ * 4 && s.phase.kind !== 'serve'; i++) s = step(s, idle)
    expect(s.server).toBe(1)
    expect(s.ball.x).toBeGreaterThan(NET_X)
    expect(s.ball.y).toBeGreaterThan(9)
  })

  it('가만히 있으면 서브한 공이 서브한 사람 몸에 맞고 네트 쪽으로 튄다', () => {
    let s = createSim(0)
    for (let i = 0; i < STEP_HZ * 2 && s.lastHit?.kind !== 'bump'; i++) s = step(s, idle)
    expect(s.lastHit?.kind).toBe('bump')
    expect(s.ball.vx).toBeGreaterThan(0)
  })

  it('공은 늘 코트 안·천장 아래에 있다 (무작위 입력으로 오래)', () => {
    let s = createSim(0)
    let seed = 1
    const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647
    const randomInput = (): Input => ({ left: rnd() < 0.3, right: rnd() < 0.3, jump: rnd() < 0.1, down: rnd() < 0.1, hit: rnd() < 0.1 })
    for (let i = 0; i < STEP_HZ * 600 && s.phase.kind !== 'done'; i++) {
      s = step(s, [randomInput(), randomInput()])
      expect(s.ball.x).toBeGreaterThanOrEqual(BALL_R - 1e-9)
      expect(s.ball.x).toBeLessThanOrEqual(COURT_W - BALL_R + 1e-9)
      expect(s.ball.y).toBeLessThanOrEqual(CEILING - BALL_R + 1e-9)
      expect(Number.isFinite(s.ball.y)).toBe(true)
    }
    expect(s.score[0] + s.score[1]).toBeGreaterThan(5)
  })
})
