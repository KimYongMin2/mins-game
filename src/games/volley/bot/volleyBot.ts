// 봇: 공이 떨어질 자리를 물리로 미리 굴려 보고(predictBall) 그 조금 뒤(네트 반대쪽)에 서서 받아 넘긴다.
// 공이 머리 위 적당한 높이로 오면 점프, 공중에서 손 닿으면 스파이크. 멀리 떨어지면 몸 날리기.
// 일반은 짐작에 오차가 있고 늦게 반응하며 스파이크를 덜 쓴다.
import { BALL_R, GRAVITY, HEAD_Y, JUMP_SPEED, NET_X, SPIKE_REACH, STEP_HZ } from '../constants'
import { type Input, NO_INPUT, type Side, type SimState, type SpikeKind, circlesOf, predictBall, spikeBall, towardNet } from '../play/sim'

export type BotLevel = 'normal' | 'hard'

type Tuning = {
  /** 몇 스텝마다 다시 생각하는지 (반응 속도) */
  thinkEvery: number
  /** 떨어질 자리 짐작 오차 (m) */
  aimError: number
  /** 머리 위로 오는 공에 점프할 확률 */
  jumpChance: number
  /** 공중에서 손 닿을 때 스파이크할 확률 */
  spikeChance: number
  /** 멀리 떨어지는 공에 몸 날릴 확률 */
  diveChance: number
}

const TUNING: Record<BotLevel, Tuning> = {
  normal: { thinkEvery: 9, aimError: 0.9, jumpChance: 0.35, spikeChance: 0.45, diveChance: 0.3 },
  hard: { thinkEvery: 3, aimError: 0.2, jumpChance: 0.75, spikeChance: 0.9, diveChance: 0.8 },
}

/** 판마다(틱마다) 같은 값이 나오는 작은 난수: 봇은 기기 안에서만 돌지만 테스트 재현을 위해 */
function noise(tick: number, salt: number): number {
  let h = (tick * 374761393 + salt * 668265263) >>> 0
  h = Math.imul(h ^ (h >>> 13), 1274126177)
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296
}

/** 봇의 생각 (스텝 사이에 들고 다님). salt = 경기마다 다르게 (같은 경기가 반복되지 않게) */
export type BotMind = { target: number; until: number; jumpAt: number | null; salt: number }

export function createBotMind(salt = Math.floor(Math.random() * 1e9)): BotMind {
  return { target: NaN, until: 0, jumpAt: null, salt }
}

export function botInput(s: SimState, side: Side, level: BotLevel, mind: BotMind): { input: Input; mind: BotMind } {
  const t = TUNING[level]
  const me = s.players[side]
  const net = towardNet(side)
  const home = side === 0 ? NET_X * 0.45 : NET_X * 1.55
  if (s.phase.kind !== 'rally' && s.phase.kind !== 'serve') return { input: NO_INPUT, mind }

  let next = mind
  // 정해진 간격으로만 다시 생각한다 (일반은 굼뜨게)
  if (s.tick >= mind.until || Number.isNaN(mind.target)) {
    const reach = me.y + HEAD_Y + 0.3
    const land = predictBall(s.ball, reach)
    const mySide = (x: number) => (side === 0 ? x < NET_X : x > NET_X)
    let target = home
    if (land && mySide(land.x)) {
      // 서브(머리 위에서 떨어지는 공)는 덜 틀린다
      const err = (noise(s.tick, mind.salt + side * 7 + 1) * 2 - 1) * t.aimError * (s.phase.kind === 'serve' ? 0.1 : 1)
      // 공보다 조금 뒤에 서서 맞으면 네트 쪽으로 튄다
      target = land.x - net * 0.4 + err
    }
    next = { ...mind, target, until: s.tick + t.thinkEvery }
  }

  const dx = next.target - me.x
  // 공이 머리 바로 위로 떨어지는 중이면 멈춰서 받는다 (달리면서 받으면 몸 속도가 더해져 낮게 꽂힘)
  const bracing = me.y === 0 && s.ball.vy < 0 && Math.abs(s.ball.x - me.x) < 1 && s.ball.y - (me.y + HEAD_Y) < 1.6 && s.ball.y > me.y + HEAD_Y
  const dir = bracing || Math.abs(dx) < 0.15 ? 0 : Math.sign(dx)
  const input: Input = { left: dir < 0, right: dir > 0, jump: false, down: false, hit: false }
  if (s.phase.kind !== 'rally') return { input, mind: next }

  const head = circlesOf(me)[1]
  const bx = s.ball.x - head.x
  const by = s.ball.y - head.y
  const onMySide = side === 0 ? s.ball.x < NET_X : s.ball.x > NET_X
  const r = noise(s.tick, mind.salt + side * 13 + 5)

  // 점프: 공이 내 머리 위 2~4.5m에서 내려오고 가까우면 (점프 꼭대기에서 만나게)
  const apex = (JUMP_SPEED * JUMP_SPEED) / (2 * GRAVITY)
  if (me.y === 0 && onMySide && Math.abs(bx) < 1.1 && by > apex * 0.4 && by < apex + 2 && s.ball.vy < 2) {
    // 이번 공에 점프할지는 한 번만 정한다
    const jumpAt = next.jumpAt ?? (r < t.jumpChance ? s.tick : -1)
    next = { ...next, jumpAt }
    if (jumpAt >= 0) input.jump = true
  }
  if (me.y === 0 && s.ball.vy > 0) next = { ...next, jumpAt: null }

  // 스파이크: 공중에서 손 닿으면, 상대 코트에 떨어지는 방향을 미리 굴려 보고 고른다 (센 것부터)
  if (me.y > 0.3 && Math.hypot(bx, by) < SPIKE_REACH * 0.9 && r < t.spikeChance) {
    const order: SpikeKind[] = level === 'hard' ? ['down', 'forward', 'none', 'back', 'up'] : ['none', 'back', 'up', 'forward']
    const kind = order.find((k) => {
      const land = predictBall(spikeBall(s.ball, side, k), BALL_R, STEP_HZ * 3)
      return land !== null && (side === 0 ? land.x > NET_X : land.x < NET_X)
    })
    if (kind) {
      input.hit = true
      input.left = kind === 'forward' ? net < 0 : kind === 'back' ? net > 0 : false
      input.right = kind === 'forward' ? net > 0 : kind === 'back' ? net < 0 : false
      input.down = kind === 'down'
      input.jump = kind === 'up'
    }
  }

  // 몸 날리기: 공이 낮게, 멀리(1.5~3.5m) 떨어지려 하는데 걸어서 못 갈 때
  if (me.y === 0 && onMySide && s.ball.vy < 0 && s.ball.y < 2.2 + BALL_R && Math.abs(s.ball.x - me.x) > 1.5 && Math.abs(s.ball.x - me.x) < 3.5) {
    if (noise(s.tick >> 4, mind.salt + side * 3 + 9) < t.diveChance / 4) {
      input.hit = true
      input.left = s.ball.x < me.x
      input.right = s.ball.x > me.x
    }
  }
  return { input, mind: next }
}
