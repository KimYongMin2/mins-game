// 점프 배구 물리 + 경기 규칙. 고정 스텝(1/60초) 순수 함수: step(상태, 두 사람 입력) → 다음 상태.
// 같은 상태·같은 입력이면 어느 기기에서나 같은 결과라서, 친구 대전에서 친구 기기도 같이 돌려 지연을 숨긴다.
// 왼쪽 = 0번(나/방장), 오른쪽 = 1번. '앞'은 네트 쪽.
// 손맛은 고전 2D 네트 배구 게임처럼: 공은 몸 어디에 맞든 위로 튀고(옆으로는 몸 가운데에서 떨어진 만큼),
// 공중에서 치기를 누르면 땅에 닿을 때까지 치는 자세라 그동안 닿는 공은 강타, 벽·네트는 속도를 잃지 않는다.
import {
  BALL_MAX_SPEED,
  BALL_R,
  BUMP_SIDE_PER_PX,
  BUMP_UP,
  CEILING,
  CEILING_DROP,
  COURT_W,
  DIVE_HOP,
  DIVE_RECOVER_S,
  DIVE_SPEED,
  DT,
  GRAVITY,
  JUMP_SPEED,
  MOVE_SPEED,
  NET_TOP_BAND,
  NET_TOP_CY,
  NET_X,
  NET_ZONE,
  PLAYER_CY,
  PLAYER_HALF,
  POINT_S,
  PX_LEN,
  SERVE_BALL_X,
  SERVE_PLAYER_X,
  SERVE_WAIT_S,
  SPIKE_SIDE_FAST,
  SPIKE_SIDE_SLOW,
  SPIKE_UP_MUL,
  STEP_HZ,
  V_UNIT,
  WIN_SCORE,
} from '../constants'

export type Side = 0 | 1

/** jump = ↑(땅에서 점프, 스파이크면 위로), down = ↓(스파이크면 아래로) */
export type Input = { left: boolean; right: boolean; jump: boolean; down: boolean; hit: boolean }

export const NO_INPUT: Input = { left: false, right: false, jump: false, down: false, hit: false }

export type Player = {
  x: number
  /** 발 높이 (0 = 바닥) */
  y: number
  vx: number
  vy: number
  /** 마지막으로 움직인 쪽 (몸 날리기 방향, 그림) */
  facing: 1 | -1
  /** 몸 날리는 중이면 1 (땅에 닿으면 끝) */
  dive: number
  /** 몸 날린 뒤 누워 있는 남은 스텝 */
  recover: number
  /** 공중에서 치기를 눌러 치는 자세 (땅에 닿을 때까지) */
  power: boolean
  /** 지난 스텝에 치기를 누르고 있었는지 (누르는 순간만 친다) */
  prevHit: boolean
  /** 지금 공과 겹쳐 있는지 (겹친 동안 한 번만 튄다) */
  touching: boolean
}

export type Ball = { x: number; y: number; vx: number; vy: number }

export type HitKind = 'bump' | 'spike' | 'net' | 'wall'

export type Phase =
  /** t = 남은 스텝. 공은 서브하는 사람 앞 하늘에 떠 있다 */
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

/** 사람이 서 있을 수 있는 범위 (네트 앞 PLAYER_HALF 만큼은 못 들어감) */
export function sideBounds(side: Side): [number, number] {
  return side === 0 ? [PLAYER_HALF, NET_X - PLAYER_HALF] : [NET_X + PLAYER_HALF, COURT_W - PLAYER_HALF]
}

/** 네트 쪽 방향 */
export const towardNet = (side: Side): 1 | -1 => (side === 0 ? 1 : -1)

function freshPlayer(side: Side): Player {
  return {
    x: side === 0 ? SERVE_PLAYER_X : COURT_W - SERVE_PLAYER_X,
    y: 0,
    vx: 0,
    vy: 0,
    facing: towardNet(side),
    dive: 0,
    recover: 0,
    power: false,
    prevHit: false,
    touching: false,
  }
}

function serveBall(server: Side): Ball {
  return { x: server === 0 ? SERVE_BALL_X : COURT_W - SERVE_BALL_X, y: CEILING - BALL_R, vx: 0, vy: 0 }
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

/** 선수 판정 네모의 가운데 */
export function centerOf(p: Player): { x: number; y: number } {
  return { x: p.x, y: p.y + PLAYER_CY }
}

/** 공 가운데가 선수 네모 안인지 */
export function touchesBall(p: Player, b: Ball): boolean {
  const c = centerOf(p)
  return Math.abs(b.x - c.x) <= PLAYER_HALF && Math.abs(b.y - c.y) <= PLAYER_HALF
}

/** 틱마다 같은 값이 나오는 -1·0·1 (공이 몸 한가운데에 맞았을 때 옆으로 살짝) */
function wobble(tick: number): number {
  const h = Math.imul(tick ^ 0x5bd1e995, 0x27d4eb2d) >>> 0
  return (h % 3) - 1
}

/**
 * 공이 선수 몸에 맞은 뒤 속도. power(치는 자세)면 강타.
 * 강타 방향: ←→ 아무거나 = 빠르게(늘 상대 쪽), ↑ 위로 · ↓ 아래로 · 없음 수평
 */
export function hitBall(b: Ball, p: Player, side: Side, input: Input, power: boolean, tick: number): Ball {
  const dxPx = Math.abs(b.x - p.x) / PX_LEN
  let vx = Math.floor(dxPx * BUMP_SIDE_PER_PX) * V_UNIT * (b.x < p.x ? -1 : 1)
  if (vx === 0) vx = wobble(tick) * V_UNIT
  let vy = Math.max(Math.abs(b.vy), BUMP_UP)
  if (power) {
    const sideways = input.left || input.right
    vx = (sideways ? SPIKE_SIDE_FAST : SPIKE_SIDE_SLOW) * towardNet(side)
    const ydir = input.down ? -1 : input.jump ? 1 : 0
    vy = vy * ydir * SPIKE_UP_MUL
  }
  return { ...b, vx, vy }
}

function movePlayer(p: Player, side: Side, input: Input): Player {
  const dir = (input.right ? 1 : 0) - (input.left ? 1 : 0)
  const pressed = input.hit && !p.prevHit
  let { x, y, vx, vy, facing, dive, recover, power } = p
  const onGround = y <= 0

  if (dive > 0) {
    vx = facing * DIVE_SPEED
  } else if (recover > 0) {
    recover--
    vx = 0
  } else {
    if (dir !== 0) facing = dir as 1 | -1
    // 누르는 순간 바로 그 방향 속도, 떼면 바로 멈춤 (공중에서도)
    vx = dir * MOVE_SPEED
    if (onGround) {
      if (input.jump) vy = JUMP_SPEED
      else if (pressed && dir !== 0) {
        // 땅에서 방향키 + 치기 = 몸 날리기
        dive = 1
        vx = dir * DIVE_SPEED
        vy = DIVE_HOP
      }
    } else if (pressed) {
      // 공중에서 치기 = 땅에 닿을 때까지 치는 자세
      power = true
    }
  }

  vy -= GRAVITY * DT
  y += vy * DT
  if (y <= 0) {
    y = 0
    vy = 0
    power = false
    if (dive > 0) {
      dive = 0
      recover = steps(DIVE_RECOVER_S)
    }
  }
  x += vx * DT
  const [lo, hi] = sideBounds(side)
  if (x < lo) x = lo
  else if (x > hi) x = hi
  return { ...p, x, y, vx, vy, facing, dive, recover, power, prevHit: input.hit }
}

type WorldStep = { ball: Ball; hit: HitKind | null }

/** 공 한 스텝 (선수 빼고): 벽·천장·네트에 부딪히는지 보고 → 움직이고 → 중력 */
function moveBall(b: Ball): WorldStep {
  let { x, y, vx, vy } = b
  let hit: HitKind | null = null

  // 벽: 속도 그대로 되튄다
  const fx = x + vx * DT
  if ((fx < BALL_R && vx < 0) || (fx > COURT_W - BALL_R && vx > 0)) {
    vx = -vx
    hit = 'wall'
  }
  // 천장: 아래로 툭
  if (y + vy * DT > CEILING - BALL_R && vy > 0) {
    vy = -CEILING_DROP
    hit = 'wall'
  }
  // 네트: 꼭대기 띠면 위로 튀고, 그 아래면 옆으로 되돌아온다
  if (Math.abs(x - NET_X) < NET_ZONE && y < NET_TOP_CY) {
    if (y >= NET_TOP_CY - NET_TOP_BAND) {
      if (vy < 0) vy = -vy
    } else {
      vx = x < NET_X ? -Math.abs(vx) : Math.abs(vx)
    }
    hit = 'net'
  }

  x = Math.min(COURT_W - BALL_R, Math.max(BALL_R, x + vx * DT))
  y = Math.min(CEILING - BALL_R, y + vy * DT)
  vy -= GRAVITY * DT

  const speed = Math.hypot(vx, vy)
  if (speed > BALL_MAX_SPEED) {
    vx *= BALL_MAX_SPEED / speed
    vy *= BALL_MAX_SPEED / speed
  }
  return { ball: { x, y, vx, vy }, hit }
}

/**
 * 공만 따로 미래로 굴려 본다 (봇이 떨어질 자리를 짐작할 때). 선수는 없다고 치고 벽·네트만.
 * 공이 높이 y 아래로 내려가는 첫 지점과 그때까지 걸린 스텝 수. maxSteps 안에 안 내려오면 null
 */
export function predictBall(b: Ball, y: number, maxSteps = STEP_HZ * 4): { x: number; steps: number } | null {
  let ball = b
  for (let i = 1; i <= maxSteps; i++) {
    ball = moveBall(ball).ball
    if (ball.y <= y && ball.vy < 0) return { x: ball.x, steps: i }
  }
  return null
}

function withHit(s: SimState, kind: HitKind, player: Side | null): SimState {
  const seq = s.hitSeq + 1
  return { ...s, hitSeq: seq, lastHit: { kind, player, seq, tick: s.tick } }
}

/** 이겼는지: 15점 먼저 (듀스 없음) */
export function winnerOf(score: readonly [number, number]): Side | null {
  const [a, b] = score
  if (a >= WIN_SCORE) return 0
  if (b >= WIN_SCORE) return 1
  return null
}

function startServe(s: SimState, server: Side): SimState {
  return { ...s, server, players: [freshPlayer(0), freshPlayer(1)], ball: serveBall(server), phase: { kind: 'serve', t: steps(SERVE_WAIT_S) } }
}

export function step(s: SimState, inputs: readonly [Input, Input]): SimState {
  if (s.phase.kind === 'done') return s
  const tick = s.tick + 1
  let players: [Player, Player] = [movePlayer(s.players[0], 0, inputs[0]), movePlayer(s.players[1], 1, inputs[1])]
  let next: SimState = { ...s, tick, players }

  switch (s.phase.kind) {
    case 'serve': {
      // 공은 하늘에 떠 있다가 떨어진다
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
      const w = moveBall(s.ball)
      let ball = w.ball
      if (w.hit) next = withHit(next, w.hit, null)
      // 몸에 맞기: 겹치기 시작할 때 한 번만
      let spikes = s.spikes
      players = players.map((p, i) => {
        const side = i as Side
        const touching = touchesBall(p, ball)
        if (touching && !p.touching) {
          ball = hitBall(ball, p, side, inputs[side], p.power, tick)
          if (p.power) spikes = side === 0 ? [spikes[0] + 1, spikes[1]] : [spikes[0], spikes[1] + 1]
          next = withHit(next, p.power ? 'spike' : 'bump', side)
        }
        return touching === p.touching ? p : { ...p, touching }
      }) as [Player, Player]
      next = { ...next, players, ball, spikes }
      // 바닥에 닿으면 반대쪽 점수
      if (ball.y - BALL_R <= 0) {
        const scorer: Side = ball.x < NET_X ? 1 : 0
        const score: [number, number] = scorer === 0 ? [s.score[0] + 1, s.score[1]] : [s.score[0], s.score[1] + 1]
        return { ...next, ball: { ...ball, y: BALL_R, vx: 0, vy: 0 }, score, phase: { kind: 'point', scorer, t: steps(POINT_S) } }
      }
      return next
    }
  }
}
