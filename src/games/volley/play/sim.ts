// 점프 배구 물리 + 경기 규칙. 고정 스텝(1/60초) 순수 함수: step(상태, 두 사람 입력) → 다음 상태.
// 같은 상태·같은 입력이면 어느 기기에서나 같은 결과라서, 친구 대전에서 친구 기기도 같이 돌려 지연을 숨긴다.
// 왼쪽 = 0번(나/방장), 오른쪽 = 1번. '앞'은 네트 쪽.
import {
  BALL_DRAG,
  BALL_MAX_SPEED,
  BALL_R,
  BODY_BOUNCE,
  FAST_HIT_BOUNCE,
  BUMP_AIM,
  BUMP_PUSH_MAX,
  BUMP_PUSH_MIN,
  ANY_BUMP_UP,
  BUMP_UP,
  FAST_BALL_SPEED,
  CARRY,
  CEILING,
  COURT_W,
  DIVE_HIGH,
  DIVE_REACH,
  DIVE_RECOVER_S,
  DIVE_S,
  DIVE_SPEED,
  DT,
  GRAVITY,
  HIT_BUFFER_S,
  HIT_HIGH,
  HIT_LOW,
  HIT_R,
  JUMP_SPEED,
  MIN_BUMP_SPEED,
  MOVE_SPEED,
  NET_BOUNCE,
  NET_H,
  NET_HALF,
  NET_TOP_NUDGE,
  NET_X,
  POINT_S,
  SERVE_DROP_Y,
  SERVE_WAIT_S,
  SPIKE,
  SPIKE_REACH,
  STEP_HZ,
  WALL_BOUNCE,
  WIN_SCORE,
} from '../constants'

export type Side = 0 | 1

/** jump = ↑(땅에서 점프, 공중에서 치면 위로 강타), down = ↓(공중에서 치면 내리찍기) */
export type Input = { left: boolean; right: boolean; jump: boolean; down: boolean; hit: boolean }

export const NO_INPUT: Input = { left: false, right: false, jump: false, down: false, hit: false }

export type Player = {
  x: number
  /** 발 높이 (0 = 바닥) */
  y: number
  vx: number
  vy: number
  /** 마지막으로 움직인 쪽 (몸 날리기 방향) */
  facing: 1 | -1
  /** 몸 날리기 남은 스텝 / 날린 뒤 못 움직이는 남은 스텝 */
  dive: number
  recover: number
  /** 이번 점프에 스파이크를 썼는지 */
  spiked: boolean
  /** 지난 스텝에 치기를 누르고 있었는지 (누르는 순간만 친다) */
  prevHit: boolean
  /** 공중에서 누른 치기를 기억하는 남은 스텝 (그 사이 공이 손에 닿으면 스파이크) */
  hitBuffer: number
  /** 같은 접촉에 여러 번 튀지 않게 (남은 스텝) */
  touchCool: number
}

export type Ball = { x: number; y: number; vx: number; vy: number }

export type HitKind = 'bump' | 'spike' | 'net' | 'wall'

export type Phase =
  /** t = 남은 스텝. 공은 서브하는 사람 머리 위에 떠 있다 */
  | { kind: 'serve'; t: number }
  | { kind: 'rally' }
  /** 공이 바닥에 닿음. scorer가 1점 */
  | { kind: 'point'; scorer: Side; t: number }
  | { kind: 'done'; winner: Side }

export type SimState = {
  tick: number
  players: [Player, Player]
  ball: Ball
  score: [number, number]
  /** 스파이크 횟수 (결과 화면) */
  spikes: [number, number]
  server: Side
  phase: Phase
  /** 마지막으로 공에 닿은 것 (소리·효과). seq가 바뀌면 새것 */
  lastHit: { kind: HitKind; player: Side | null; seq: number; tick: number } | null
  hitSeq: number
}

const steps = (s: number) => Math.round(s * STEP_HZ)

/** 사람이 서 있을 수 있는 범위 */
export function sideBounds(side: Side): [number, number] {
  return side === 0 ? [HIT_R, NET_X - NET_HALF - HIT_R] : [NET_X + NET_HALF + HIT_R, COURT_W - HIT_R]
}

/** 네트 쪽 방향 */
export const towardNet = (side: Side): 1 | -1 => (side === 0 ? 1 : -1)

function freshPlayer(side: Side): Player {
  return { x: side === 0 ? COURT_W * 0.2 : COURT_W * 0.8, y: 0, vx: 0, vy: 0, facing: towardNet(side), dive: 0, recover: 0, spiked: false, prevHit: false, hitBuffer: 0, touchCool: 0 }
}

function serveBall(server: Side): Ball {
  return { x: server === 0 ? COURT_W * 0.2 : COURT_W * 0.8, y: SERVE_DROP_Y, vx: 0, vy: 0 }
}

export function createSim(server: Side): SimState {
  return {
    tick: 0,
    players: [freshPlayer(0), freshPlayer(1)],
    ball: serveBall(server),
    score: [0, 0],
    spikes: [0, 0],
    server,
    phase: { kind: 'serve', t: steps(SERVE_WAIT_S) },
    lastHit: null,
    hitSeq: 0,
  }
}

export type SpikeKind = keyof typeof SPIKE

/** 스파이크한 공 (방향은 누른 방향키) */
export function spikeBall(ball: Ball, side: Side, kind: SpikeKind): Ball {
  const net = towardNet(side)
  return { x: ball.x, y: ball.y, vx: SPIKE[kind].vx * net, vy: SPIKE[kind].vy }
}

/** 누른 방향키 → 스파이크 종류. 아래 > 위 > 상대 쪽 > 반대쪽 > 없음 */
export function spikeKindOf(input: Input, side: Side): SpikeKind {
  if (input.down) return 'down'
  if (input.jump) return 'up'
  const dir = (input.right ? 1 : 0) - (input.left ? 1 : 0)
  if (dir === 0) return 'none'
  return dir === towardNet(side) ? 'forward' : 'back'
}

/** 선수의 몸통·머리 원 (몸 날리는 중이면 낮게) */
export type Capsule = { ax: number; ay: number; bx: number; by: number; r: number }

/** 선수 피격 판정: 발끝~머리 위 일자 막대. a = 아래 끝, b = 머리 쪽 끝. 몸 날리는 중엔 보는 쪽으로 눕는다 */
export function capsuleOf(p: Player): Capsule {
  if (p.dive > 0) return { ax: p.x, ay: p.y + HIT_R * 0.8, bx: p.x + p.facing * DIVE_REACH, by: p.y + DIVE_HIGH, r: HIT_R }
  return { ax: p.x, ay: p.y + HIT_LOW, bx: p.x, by: p.y + HIT_HIGH, r: HIT_R }
}

/** 머리 쪽 끝 (스파이크 닿는 거리를 여기서 잰다) */
export function headOf(p: Player): { x: number; y: number } {
  const c = capsuleOf(p)
  return { x: c.bx, y: c.by }
}

/** 막대에서 점까지 가장 가까운 점 */
function closestOnCapsule(c: Capsule, x: number, y: number): { x: number; y: number } {
  const dx = c.bx - c.ax
  const dy = c.by - c.ay
  const len2 = dx * dx + dy * dy
  const t = len2 === 0 ? 0 : Math.min(1, Math.max(0, ((x - c.ax) * dx + (y - c.ay) * dy) / len2))
  return { x: c.ax + dx * t, y: c.ay + dy * t }
}

function movePlayer(p: Player, side: Side, input: Input, ball: Ball, canHit: boolean): { p: Player; spike: Ball | null } {
  const dir = (input.right ? 1 : 0) - (input.left ? 1 : 0)
  const pressed = input.hit && !p.prevHit
  let { x, y, vx, vy, facing, dive, recover, spiked, hitBuffer } = p
  let spike: Ball | null = null
  // 날리는 중·회복 중엔 방향이 안 바뀐다
  if (dir !== 0 && dive === 0 && recover === 0) facing = dir as 1 | -1
  const onGround = y <= 0

  if (dive > 0) {
    dive--
    vx = facing * DIVE_SPEED
    if (dive === 0) recover = steps(DIVE_RECOVER_S)
  } else if (recover > 0) {
    recover--
    // 날린 뒤엔 금방 멈춘다
    vx *= 0.6
  } else {
    // 누르는 순간 바로 그 방향 최고 속도, 떼면 바로 멈춤
    vx = dir * MOVE_SPEED
    if (onGround && input.jump) vy = JUMP_SPEED
    if (pressed && onGround && !input.jump) {
      // 땅에서 치기 = 몸 날리기 (점프와 같이 누르면 점프)
      dive = steps(DIVE_S)
      vx = facing * DIVE_SPEED
    } else if (pressed && !onGround) {
      hitBuffer = steps(HIT_BUFFER_S)
    }
    // 공중에서 누른 치기: 기억하는 동안 공이 손에 닿으면 스파이크
    if (hitBuffer > 0 && !onGround && !spiked && canHit) {
      const head = headOf(p)
      if (Math.hypot(ball.x - head.x, ball.y - head.y) <= SPIKE_REACH) {
        spiked = true
        hitBuffer = 0
        spike = spikeBall(ball, side, spikeKindOf(input, side))
      }
    }
  }

  if (hitBuffer > 0) hitBuffer--
  vy -= GRAVITY * DT
  y += vy * DT
  if (y <= 0) {
    y = 0
    vy = 0
    spiked = false
    hitBuffer = 0
  }
  x += vx * DT
  const [lo, hi] = sideBounds(side)
  if (x < lo) {
    x = lo
    vx = 0
  } else if (x > hi) {
    x = hi
    vx = 0
  }
  return {
    p: { ...p, x, y, vx, vy, facing, dive, recover, spiked, prevHit: input.hit, hitBuffer, touchCool: Math.max(0, p.touchCool - 1) },
    spike,
  }
}

/** 공만 굴려 볼 때 쓰는 빈 선수 (멀리 치워 둠) */
const FAR: Player = { x: -100, y: -100, vx: 0, vy: 0, facing: 1, dive: 0, recover: 0, spiked: false, prevHit: false, hitBuffer: 0, touchCool: 0 }
const NO_PLAYERS: [Player, Player] = [FAR, FAR]

type BallStep = { ball: Ball; hit: { kind: HitKind; player: Side | null } | null; touched: Side[] }

/** 공 한 스텝: 중력·저항 → 벽·천장 → 네트 → 선수 몸 */
function moveBall(b: Ball, players: [Player, Player]): BallStep {
  let { x, y, vx, vy } = b
  let hit: BallStep['hit'] = null
  const touched: Side[] = []
  vy -= GRAVITY * DT
  const drag = 1 - BALL_DRAG * DT
  vx *= drag
  vy *= drag
  x += vx * DT
  y += vy * DT

  if (x - BALL_R < 0) {
    x = BALL_R
    vx = Math.abs(vx) * WALL_BOUNCE
    hit = { kind: 'wall', player: null }
  } else if (x + BALL_R > COURT_W) {
    x = COURT_W - BALL_R
    vx = -Math.abs(vx) * WALL_BOUNCE
    hit = { kind: 'wall', player: null }
  }
  if (y + BALL_R > CEILING) {
    y = CEILING - BALL_R
    vy = -Math.abs(vy) * WALL_BOUNCE
    hit = { kind: 'wall', player: null }
  }

  // 네트: 직사각형에서 가장 가까운 점과 비교 (기둥 끝에 맞으면 비스듬히 튄다)
  const cx = Math.min(Math.max(x, NET_X - NET_HALF), NET_X + NET_HALF)
  const cy = Math.min(Math.max(y, 0), NET_H)
  const dx = x - cx
  const dy = y - cy
  const d = Math.hypot(dx, dy)
  if (d < BALL_R) {
    // 공 가운데가 네트 안이면 가까운 옆으로 밀어낸다
    const [nx, ny] = d > 1e-6 ? [dx / d, dy / d] : [x < NET_X ? -1 : 1, 0]
    x = cx + nx * BALL_R
    y = cy + ny * BALL_R
    const vn = vx * nx + vy * ny
    if (vn < 0) {
      vx -= (1 + NET_BOUNCE) * vn * nx
      vy -= (1 + NET_BOUNCE) * vn * ny
    }
    // 꼭대기에 얹히면 가까운 쪽으로 굴러떨어지게
    if (ny > 0.7) vx += (x >= NET_X ? 1 : -1) * NET_TOP_NUDGE
    hit = { kind: 'net', player: null }
  }

  // 선수 몸: 일자 막대(캡슐)와 충돌. 막대에서 가장 가까운 점 쪽으로 튀고, 선수 속도도 조금 더해 준다
  players.forEach((p, side) => {
    if (p.touchCool > 0) return
    {
      const cap = capsuleOf(p)
      const c = closestOnCapsule(cap, x, y)
      const ex = x - c.x
      const ey = y - c.y
      const dist = Math.hypot(ex, ey)
      if (dist >= BALL_R + cap.r) return
      const [nx, ny] = dist > 1e-6 ? [ex / dist, ey / dist] : [0, 1]
      x = c.x + nx * (BALL_R + cap.r)
      y = c.y + ny * (BALL_R + cap.r)
      const rvx = vx - p.vx
      const rvy = vy - p.vy
      const incoming = Math.hypot(rvx, rvy)
      // 빠른 공(스파이크)은 받아 넘기기 도움 없이 물리대로. 옆·아래에 맞으면 힘없이 떨어진다
      const fast = incoming >= FAST_BALL_SPEED
      // 땅에 서 있으면(몸 날리기 포함) 어디에 맞든 공을 위로 띄운다. 빠른 공은 옆으로 가던 힘은 빠지고 위로만
      const grounded = p.y <= 0
      const absorbed = fast && (ny <= 0.3 || grounded)
      const bounce = absorbed ? FAST_HIT_BOUNCE : BODY_BOUNCE
      const vn = rvx * nx + rvy * ny
      if (vn < 0) {
        vx -= (1 + bounce) * vn * nx
        vy -= (1 + bounce) * vn * ny
      }
      vx += p.vx * CARRY
      vy += Math.max(0, p.vy) * CARRY
      // 받으면 늘 어느 정도는 튀어 나가게 (힘없이 떨어지는 공은 빼고)
      const out = vx * nx + vy * ny
      if (!absorbed && out < MIN_BUMP_SPEED) {
        vx += (MIN_BUMP_SPEED - out) * nx
        vy += (MIN_BUMP_SPEED - out) * ny
      }
      // 받아 넘기기: 느린 공이 위·옆에 맞으면 네트 쪽으로 밀고 높이 띄운다 (네트에서 멀수록 세게 밀어 넘어가게).
      // 빠른 스파이크까지 받아 넘겨 주면 스파이크가 점수가 안 나서 랠리가 안 끝났음. 그 밖엔 조금만 뜬다
      if (!fast && (ny > -0.3 || grounded)) {
        const push = Math.min(BUMP_PUSH_MAX, Math.max(BUMP_PUSH_MIN, Math.abs(p.x - NET_X) * BUMP_AIM))
        vx += towardNet(side as Side) * push
        vy = Math.max(vy, BUMP_UP)
      } else if (grounded) {
        vy = Math.max(vy, BUMP_UP)
      } else {
        vy = Math.max(vy, ANY_BUMP_UP)
      }
      hit = { kind: 'bump', player: side as Side }
      touched.push(side as Side)
    }
  })

  const speed = Math.hypot(vx, vy)
  if (speed > BALL_MAX_SPEED) {
    vx *= BALL_MAX_SPEED / speed
    vy *= BALL_MAX_SPEED / speed
  }
  return { ball: { x, y, vx, vy }, hit, touched }
}

/**
 * 공만 따로 미래로 굴려 본다 (봇이 떨어질 자리를 짐작할 때). 선수는 없다고 치고 벽·네트만.
 * 공이 높이 y 아래로 내려가는 첫 지점과 그때까지 걸린 스텝 수. maxSteps 안에 안 내려오면 null
 */
export function predictBall(b: Ball, y: number, maxSteps = STEP_HZ * 4): { x: number; steps: number } | null {
  let ball = b
  for (let i = 1; i <= maxSteps; i++) {
    ball = moveBall(ball, NO_PLAYERS).ball
    if (ball.y <= y && ball.vy < 0) return { x: ball.x, steps: i }
  }
  return null
}

function withHit(s: SimState, kind: HitKind, player: Side | null): SimState {
  const seq = s.hitSeq + 1
  return { ...s, hitSeq: seq, lastHit: { kind, player, seq, tick: s.tick } }
}

/** 이겼는지: 15점 먼저, 14:14부터는 2점 차 */
export function winnerOf(score: readonly [number, number]): Side | null {
  const [a, b] = score
  if (Math.max(a, b) < WIN_SCORE || Math.abs(a - b) < 2) return null
  return a > b ? 0 : 1
}

function startServe(s: SimState, server: Side): SimState {
  return { ...s, server, players: [freshPlayer(0), freshPlayer(1)], ball: serveBall(server), phase: { kind: 'serve', t: steps(SERVE_WAIT_S) } }
}

export function step(s: SimState, inputs: readonly [Input, Input]): SimState {
  if (s.phase.kind === 'done') return s
  const tick = s.tick + 1
  const live = s.phase.kind === 'rally'
  const moved = [0, 1].map((i) => movePlayer(s.players[i], i as Side, inputs[i], s.ball, live)) as [
    ReturnType<typeof movePlayer>,
    ReturnType<typeof movePlayer>,
  ]
  let players: [Player, Player] = [moved[0].p, moved[1].p]
  let next: SimState = { ...s, tick, players }

  switch (s.phase.kind) {
    case 'serve': {
      // 공은 머리 위에 떠 있다가 떨어진다
      if (s.phase.t > 1) return { ...next, phase: { kind: 'serve', t: s.phase.t - 1 } }
      return { ...next, phase: { kind: 'rally' } }
    }
    case 'point': {
      if (s.phase.t > 1) return { ...next, phase: { ...s.phase, t: s.phase.t - 1 } }
      const winner = winnerOf(s.score)
      if (winner !== null) return { ...next, phase: { kind: 'done', winner } }
      return startServe(next, s.phase.scorer)
    }
    case 'rally': {
      // 스파이크가 몸에 맞는 것보다 먼저
      const spike = moved[0].spike ?? moved[1].spike
      let ball = s.ball
      if (spike) {
        const who: Side = moved[0].spike ? 0 : 1
        ball = spike
        players = players.map((p, i) => (i === who ? { ...p, touchCool: 8 } : p)) as [Player, Player]
        const spikes: [number, number] = who === 0 ? [s.spikes[0] + 1, s.spikes[1]] : [s.spikes[0], s.spikes[1] + 1]
        next = withHit({ ...next, players, spikes }, 'spike', who)
      }
      const r = moveBall(ball, players)
      if (r.touched.length > 0) {
        players = players.map((p, i) => (r.touched.includes(i as Side) ? { ...p, touchCool: 6 } : p)) as [Player, Player]
      }
      next = { ...next, players, ball: r.ball }
      if (r.hit) next = withHit(next, r.hit.kind, r.hit.player)
      // 바닥에 닿으면 반대쪽 점수
      if (r.ball.y - BALL_R <= 0) {
        const scorer: Side = r.ball.x < NET_X ? 1 : 0
        const score: [number, number] = scorer === 0 ? [s.score[0] + 1, s.score[1]] : [s.score[0], s.score[1] + 1]
        return { ...next, ball: { ...r.ball, y: BALL_R, vx: 0, vy: 0 }, score, phase: { kind: 'point', scorer, t: steps(POINT_S) } }
      }
      return next
    }
  }
}
