import { describe, expect, it } from 'vitest'
import { BALL_R, COURT_W, JUMP_SPEED, GRAVITY, NET_H, NET_X, STEP_HZ, WIN_SCORE } from '../constants'
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

describe('선수', () => {
  it('점프 높이는 물리대로 (v²/2g)', () => {
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

  it('네트를 넘어가지 못한다', () => {
    // 점수 보여주는 중(공 멈춤)에도 선수는 움직인다
    const s = run({ ...createSim(0), phase: { kind: 'point', scorer: 0, t: 9999 } }, STEP_HZ * 3, [inp({ right: true }), inp({ left: true })])
    expect(s.players[0].x).toBe(sideBounds(0)[1])
    expect(s.players[1].x).toBe(sideBounds(1)[0])
  })

  it('땅에서 치기 = 몸 날리기, 끝나면 잠깐 못 움직임', () => {
    let s = createSim(0)
    const x0 = s.players[0].x
    s = step(s, [inp({ hit: true }), NO_INPUT])
    expect(s.players[0].dive).toBeGreaterThan(0)
    s = run(s, 30, [inp({ left: true }), NO_INPUT])
    expect(s.players[0].x).toBeGreaterThan(x0 + 2)
    expect(s.players[0].recover).toBeGreaterThan(0)
  })
})

describe('공', () => {
  it('떨어지면 바닥에 닿은 쪽 상대가 1점', () => {
    let s = rally({ x: 3, y: 3, vx: 0, vy: 0 }, { players: [{ ...createSim(0).players[0], x: 6 }, createSim(0).players[1]] })
    s = run(s, STEP_HZ)
    expect(s.score).toEqual([0, 1])
    expect(s.phase.kind).toBe('point')
  })

  it('벽에 맞으면 튕겨 나온다', () => {
    let s = rally({ x: 1, y: 6, vx: -10, vy: 0 })
    s = run(s, 10)
    expect(s.ball.vx).toBeGreaterThan(0)
    expect(s.lastHit?.kind).toBe('wall')
  })

  it('네트 옆면에 맞으면 되돌아온다', () => {
    let s = rally({ x: NET_X - 2, y: 1.2, vx: 12, vy: 3 })
    s = run(s, 15)
    expect(s.ball.vx).toBeLessThan(0)
    expect(s.ball.x).toBeLessThan(NET_X)
  })

  it('네트 위로는 넘어간다', () => {
    let s = rally({ x: NET_X - 2, y: NET_H + 2, vx: 8, vy: 2 })
    s = run(s, 40)
    expect(s.ball.x).toBeGreaterThan(NET_X)
  })

  it('머리에 떨어진 공은 위로 튀어 오른다', () => {
    const me = createSim(0).players[0]
    let s = rally({ x: me.x + 0.1, y: 4, vx: 0, vy: 0 })
    let maxUp = -Infinity
    for (let i = 0; i < 60; i++) {
      s = step(s, idle)
      maxUp = Math.max(maxUp, s.ball.vy)
      if (s.lastHit?.kind === 'bump') break
    }
    expect(s.lastHit?.kind).toBe('bump')
    expect(s.ball.vy).toBeGreaterThan(4)
  })
})

describe('스파이크', () => {
  it('공중에서 공 근처에서 치면 상대 쪽으로 세게 내리꽂는다', () => {
    const base = createSim(0)
    const me = { ...base.players[0], x: NET_X - 1.5, y: 1.5, vy: 0 }
    const head = { x: me.x + 0.3, y: me.y + 1.6 + 0.6 }
    let s = rally({ ...head, vx: 0, vy: 0 }, { players: [me, base.players[1]] })
    s = step(s, [inp({ hit: true, right: true }), NO_INPUT])
    expect(s.lastHit?.kind).toBe('spike')
    expect(s.ball.vx).toBeGreaterThan(10)
    expect(s.ball.vy).toBeLessThan(0)
    // 상대 코트에 떨어져 내 점수
    s = run(s, STEP_HZ * 2)
    expect(s.score).toEqual([1, 0])
  })

  it('누르고 있기만 하면 다시 안 친다 (누르는 순간만)', () => {
    const base = createSim(0)
    const me = { ...base.players[0], x: 4, y: 1.5, prevHit: true }
    const s = step(rally({ x: 4.3, y: 3.7, vx: 0, vy: 0 }, { players: [me, base.players[1]] }), [inp({ hit: true }), NO_INPUT])
    expect(s.lastHit?.kind).not.toBe('spike')
  })
})

describe('경기', () => {
  it('15점 먼저, 14:14부터는 2점 차', () => {
    expect(winnerOf([WIN_SCORE, 10])).toBe(0)
    expect(winnerOf([WIN_SCORE, 14])).toBeNull()
    expect(winnerOf([16, 14])).toBe(0)
    expect(winnerOf([17, 18])).toBeNull()
    expect(winnerOf([17, 19])).toBe(1)
  })

  it('점수를 낸 쪽이 다음 서브, 공은 그 사람 머리 위에서', () => {
    let s = rally({ x: 3, y: 2, vx: 0, vy: -5 }, { players: [{ ...createSim(0).players[0], x: 6 }, createSim(0).players[1]] })
    s = run(s, STEP_HZ * 3)
    expect(s.server).toBe(1)
    expect(s.ball.x).toBeGreaterThan(NET_X)
  })

  it('가만히 있으면 서브한 공이 서브한 사람 몸에 맞고 튄다 (공이 머리 위에서 떨어짐)', () => {
    let s = createSim(0)
    let bumped = false
    for (let i = 0; i < STEP_HZ * 2; i++) {
      s = step(s, idle)
      if (s.lastHit?.kind === 'bump') bumped = true
    }
    expect(bumped).toBe(true)
  })

  it('공은 늘 코트 안·천장 아래에 있다 (무작위 입력으로 오래)', () => {
    let s = createSim(0)
    let seed = 1
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647)
    const randomInput = (): Input => ({ left: rnd() < 0.3, right: rnd() < 0.3, jump: rnd() < 0.1, hit: rnd() < 0.1 })
    for (let i = 0; i < STEP_HZ * 600 && s.phase.kind !== 'done'; i++) {
      s = step(s, [randomInput(), randomInput()])
      expect(s.ball.x).toBeGreaterThanOrEqual(BALL_R - 1e-9)
      expect(s.ball.x).toBeLessThanOrEqual(COURT_W - BALL_R + 1e-9)
      expect(Number.isFinite(s.ball.y)).toBe(true)
    }
    expect(s.score[0] + s.score[1]).toBeGreaterThan(5)
  })
})
