// 봇: 공이 떨어질 자리를 물리로 미리 굴려 보고(predictBall) 그 조금 뒤(네트 반대쪽)에 선다.
// 공은 몸 가운데에서 떨어진 만큼 옆으로 튀어서, 네트에서 멀수록 더 뒤에 서야 넘어간다.
// 네트 가까이로 높게 오는 공엔 점프해서 치는 자세(스파이크)로, 상대 코트에 떨어지는 방향을 굴려 보고 고른다.
// 일반은 짐작에 오차가 있고 늦게 반응하며 스파이크를 덜 쓴다.
import { BALL_R, DT, GRAVITY, JUMP_SPEED, MOVE_SPEED, NET_X, PLAYER_CY, PLAYER_HALF, STEP_HZ } from '../constants'
import { type Input, NO_INPUT, type Side, type SimState, hitBall, predictBall, sideBounds, touchesBall, towardNet } from '../play/sim'

export type BotLevel = 'normal' | 'hard'

type Tuning = {
  /** 몇 스텝마다 다시 생각하는지 (반응 속도) */
  thinkEvery: number
  /** 떨어질 자리 짐작 오차 (m) */
  aimError: number
  /** 네트 근처 높은 공에 점프할 확률 */
  jumpChance: number
  /** 점프해서 치는 자세를 잡을 확률 */
  spikeChance: number
  /** 걸어서 못 가는 공에 몸 날릴 확률 */
  diveChance: number
}

const TUNING: Record<BotLevel, Tuning> = {
  normal: { thinkEvery: 16, aimError: 1.5, jumpChance: 0.3, spikeChance: 0.5, diveChance: 0.3 },
  hard: { thinkEvery: 6, aimError: 0.8, jumpChance: 0.8, spikeChance: 0.95, diveChance: 0.9 },
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

/** 스파이크 방향 후보 (상대 쪽 기준 키) */
type Aim = { side: boolean; up: boolean; down: boolean }
const AIMS_HARD: Aim[] = [
  { side: true, up: false, down: true },
  { side: false, up: false, down: true },
  { side: true, up: false, down: false },
  { side: false, up: false, down: false },
  { side: true, up: true, down: false },
]
const AIMS_NORMAL: Aim[] = [
  { side: false, up: false, down: false },
  { side: true, up: true, down: false },
  { side: true, up: false, down: false },
  { side: false, up: true, down: false },
]

export function botInput(s: SimState, side: Side, level: BotLevel, mind: BotMind): { input: Input; mind: BotMind } {
  const t = TUNING[level]
  const me = s.players[side]
  const net = towardNet(side)
  const home = side === 0 ? NET_X * 0.5 : NET_X * 1.5
  if (s.phase.kind !== 'rally' && s.phase.kind !== 'serve') return { input: NO_INPUT, mind }
  const mySide = (x: number) => (side === 0 ? x < NET_X : x > NET_X)
  const [lo, hi] = sideBounds(side)
  // 서 있을 때 공이 몸 네모 위쪽 끝에 닿는 높이
  const reach = PLAYER_CY + PLAYER_HALF
  const land = predictBall(s.ball, reach)

  let next = mind
  // 정해진 간격으로만 다시 생각한다 (일반은 굼뜨게)
  if (s.tick >= mind.until || Number.isNaN(mind.target)) {
    let target = home
    if (land && mySide(land.x)) {
      const err = (noise(s.tick, mind.salt + side * 7 + 1) * 2 - 1) * t.aimError
      // 네트에서 멀수록 더 뒤에 서야(공이 몸 앞쪽에 맞아야) 넘어간다
      const offset = Math.min(1.05, Math.max(0.25, 0.15 + Math.abs(land.x - NET_X) * 0.13))
      target = land.x - net * offset + err
    }
    next = { ...mind, target: Math.min(hi, Math.max(lo, target)), until: s.tick + t.thinkEvery }
  }

  const dx = next.target - me.x
  const dir = Math.abs(dx) < 0.1 ? 0 : Math.sign(dx)
  const input: Input = { left: dir < 0, right: dir > 0, jump: false, down: false, hit: false }
  if (s.phase.kind !== 'rally') return { input, mind: next }

  const r = noise(s.tick, mind.salt + side * 13 + 5)
  const onMySide = mySide(s.ball.x)

  // 점프: 네트 가까이 높게 떨어지는 공이 점프 꼭대기쯤에서 만날 때 (이번 공에 할지는 한 번만 정한다)
  if (me.y === 0 && me.dive === 0 && onMySide && Math.abs(me.x - NET_X) < 4.5) {
    const apexC = PLAYER_CY + (JUMP_SPEED * JUMP_SPEED) / (2 * GRAVITY)
    const upSteps = (JUMP_SPEED / GRAVITY) * STEP_HZ
    const meet = predictBall(s.ball, apexC - 0.6)
    if (meet && Math.abs(meet.x - me.x) < 0.9 && Math.abs(meet.steps - upSteps * 0.8) < 4) {
      const jumpAt = next.jumpAt ?? (r < t.jumpChance ? s.tick : -1)
      next = { ...next, jumpAt }
      if (jumpAt >= 0) input.jump = true
    }
  }
  if (me.y === 0 && !onMySide) next = { ...next, jumpAt: null }

  // 공중: 치는 자세를 잡고, 공이 닿을 때 상대 코트에 떨어지는 방향 키를 누르고 있는다
  if (me.y > 0.2 && me.dive === 0) {
    if (!me.power && Math.hypot(s.ball.x - me.x, s.ball.y - (me.y + PLAYER_CY)) < 3 && noise(s.tick >> 3, mind.salt + side) < t.spikeChance) input.hit = true
    // 다음 스텝에 공이 몸에 닿을 때만 방향을 고른다 (그 순간의 공으로 굴려 봐야 맞다)
    const ball1 = { x: s.ball.x + s.ball.vx * DT, y: s.ball.y + s.ball.vy * DT, vx: s.ball.vx, vy: s.ball.vy - GRAVITY * DT }
    const me1 = { ...me, y: Math.max(0, me.y + (me.vy - GRAVITY * DT) * DT) }
    if ((me.power || input.hit) && touchesBall(me1, ball1)) {
      // 방향마다 굴려 보고, 상대 코트에 떨어지면서 상대가 걸어서 닿기 가장 힘든 쪽 (일반은 그냥 넘어가는 첫 방향)
      const foe = s.players[side === 0 ? 1 : 0]
      const aims = level === 'hard' ? AIMS_HARD : AIMS_NORMAL
      let aim = aims[aims.length - 1]
      let best = -Infinity
      for (const a of aims) {
        const k: Input = { left: a.side, right: false, jump: a.up, down: a.down, hit: true }
        const l = predictBall(hitBall(ball1, me1, side, k, true, s.tick + 1), BALL_R, STEP_HZ * 3)
        if (l === null || mySide(l.x)) continue
        const margin = Math.abs(l.x - foe.x) - PLAYER_HALF - (MOVE_SPEED * l.steps) / STEP_HZ
        if (level === 'normal') {
          aim = a
          break
        }
        if (margin > best) {
          best = margin
          aim = a
        }
      }
      // 옆으로 빠르게: 상대 쪽 키 (앞으로 붙으면서)
      input.left = aim.side && net < 0
      input.right = aim.side && net > 0
      input.jump = aim.up
      input.down = aim.down
    }
  }

  // 몸 날리기: 공이 곧 떨어지는데 걸어서 못 갈 때
  if (me.y === 0 && me.dive === 0 && me.recover === 0 && land && mySide(land.x)) {
    const gap = land.x - me.x
    const walk = (MOVE_SPEED * land.steps) / STEP_HZ
    if (Math.abs(gap) > walk + 0.3 && Math.abs(gap) < 3.5 && land.steps < STEP_HZ * 0.45 && noise(s.tick >> 2, mind.salt + side * 3 + 9) < t.diveChance) {
      input.hit = true
      input.left = gap < 0
      input.right = gap > 0
    }
  }
  return { input, mind: next }
}
