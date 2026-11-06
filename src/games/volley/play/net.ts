// 친구 대전 통신. 방장 기기가 진짜 경기(심판)를 돌리고 1초에 STATE_HZ번 상태를 보낸다.
// 친구 기기도 같은 물리를 같이 돌려(예측) 자기 키를 바로 반영한다. 방장 상태가 오면 그 시점으로 되감아
// 그 뒤로 자기가 누른 키를 다시 넣어 돌려서(재현) 지금으로 맞춘다. 그래서 내 선수는 지연 없이 움직이고,
// 공·상대도 끊기지 않는다. 친구 기기는 방장보다 왕복 지연만큼 앞서 돌아서, 친구가 누른 키가 방장에 닿을 때쯤
// 방장도 그 스텝에 와 있다 (공을 치는 판정만 그만큼 늦을 수 있음).
import { STEP_HZ } from '../constants'
import { type Input, NO_INPUT, type Side, type SimState, step } from './sim'

/** 방장이 상태를 보내는 횟수 (1초에). 많을수록 정확하지만 Supabase 무료 메시지를 많이 씀 */
export const STATE_HZ = 20
/** 친구가 키를 안 바꿔도 다시 보내는 간격 (메시지가 빠졌을 때 대비) */
export const INPUT_RESEND_MS = 500
/** 왕복 지연을 재는 간격 */
export const PING_MS = 1000
/** 재기 전 왕복 지연 (ms) */
export const DEFAULT_RTT_MS = 120
/** 친구가 방장보다 최대 몇 스텝 앞서 예측하는지 (왕복 지연이 이보다 길면 여기까지만) */
const MAX_LEAD = STEP_HZ
/** 방장 상태가 늦게 와도 이만큼(스텝)은 계속 예측한다. 그보다 더 안 오면 멈추고 기다린다 (방장이 멈췄을 때 폭주 방지) */
const LATE_SLACK = STEP_HZ / 2
/** 내 시계가 목표에서 이만큼(스텝) 넘게 어긋나면 천천히 맞추지 않고 바로 맞춘다 */
const SNAP_DRIFT = STEP_HZ / 3
/** 이만큼(스텝) 안의 어긋남은 그냥 둔다 (메시지가 도착하는 시각이 흔들리는 정도) */
const DRIFT_DEADZONE = 2

export type VolleyMsg =
  /** 친구 → 방장: 들을 준비 됨 (1초마다) */
  | { t: 'ready' }
  /** 방장 → 친구: 경기 시작 (선공 = 첫 서브) */
  | { t: 'start'; server: Side }
  /** 방장 → 친구: 지금 경기 상태와 그때 두 사람 키 */
  | { t: 'state'; s: SimState; i: [Input, Input] }
  /** 친구 → 방장: 지금 누르는 키 (바뀔 때마다 + 가끔) */
  | { t: 'input'; i: Input }
  | { t: 'ping'; id: number }
  | { t: 'pong'; id: number }

export const sameInput = (a: Input, b: Input) => a.left === b.left && a.right === b.right && a.jump === b.jump && a.down === b.down && a.hit === b.hit

/** 친구(1번 자리) 기기의 예측 상태 */
export type Guest = {
  /** 화면에 그리는 예측 경기 */
  local: SimState
  /** 마지막으로 받은 방장 상태의 스텝 */
  authTick: number
  /** 방장이 마지막으로 누르던 키 (예측할 때 그대로 누르고 있다고 친다) */
  hostInput: Input
  /** 스텝별로 내가 누른 키 (재현용) */
  history: Map<number, Input>
  rttMs: number
  /** 내 시계가 목표(방장 + 왕복 지연)보다 몇 스텝 앞서 있는지 (흔들림을 줄인 값). 스텝을 가끔 건너뛰거나 더 돌려 맞춘다 */
  drift: number
  /** 시계 맞추기용 스텝 세기 */
  count: number
}

export function createGuest(initial: SimState): Guest {
  return { local: initial, authTick: initial.tick, hostInput: NO_INPUT, history: new Map(), rttMs: DEFAULT_RTT_MS, drift: 0, count: 0 }
}

const leadOf = (g: Guest) => Math.min(MAX_LEAD, Math.round((g.rttMs / 1000) * STEP_HZ))

function advance(g: Guest, mine: Input): Guest {
  const local = step(g.local, [g.hostInput, mine])
  const history = new Map(g.history)
  history.set(local.tick, mine)
  return { ...g, local, history }
}

/**
 * 친구 기기에서 한 스텝 예측. 시계가 목표보다 앞서 있으면 4스텝에 한 번 쉬고, 뒤처져 있으면 4스텝에 한 번 더 돈다
 * (화면이 튀지 않게 조금씩 맞춘다)
 */
export function guestStep(g: Guest, mine: Input): Guest {
  // 방장 상태가 너무 오래 안 오면 기다린다
  if (g.local.tick - g.authTick >= leadOf(g) + LATE_SLACK) return g
  const count = g.count + 1
  const fix = count % 4 === 0
  if (fix && g.drift > DRIFT_DEADZONE) return { ...g, count, drift: g.drift - 1 }
  let next = advance({ ...g, count }, mine)
  if (fix && g.drift < -DRIFT_DEADZONE) next = { ...advance(next, mine), drift: next.drift + 1 }
  return next
}

/**
 * 방장 상태를 받음: 그 시점으로 되감고, 내 키를 다시 넣어 지금(내 시계)까지 돌린다.
 * 내 시계는 메시지가 올 때마다 옮기지 않는다 (도착 시각이 흔들려 화면이 튀므로). 목표에서 얼마나 어긋났는지만 재 둔다
 */
export function guestReceive(g: Guest, s: SimState, inputs: [Input, Input]): Guest {
  if (s.tick <= g.authTick) return g
  const ideal = s.tick + leadOf(g)
  const measured = g.local.tick - ideal
  // 많이 어긋났으면(처음, 탭이 멈췄다 돌아옴 등) 바로 목표로
  const snap = Math.abs(measured) > SNAP_DRIFT
  const target = snap ? ideal : Math.max(g.local.tick, s.tick)
  const drift = snap ? 0 : g.drift * 0.8 + measured * 0.2
  const hostInput = inputs[0]
  let local = s
  // 끝난 경기는 스텝이 안 늘어서 거기서 멈춘다
  while (local.tick < target && local.phase.kind !== 'done') {
    const mine = g.history.get(local.tick + 1) ?? inputs[1]
    local = step(local, [hostInput, mine])
  }
  // 오래된 기록은 버린다
  const history = new Map([...g.history].filter(([tick]) => tick > s.tick))
  return { ...g, local, authTick: s.tick, hostInput, history, drift }
}

export function withRtt(g: Guest, sampleMs: number): Guest {
  // 튀는 값에 흔들리지 않게 천천히 따라간다
  return { ...g, rttMs: g.rttMs * 0.7 + Math.min(1000, Math.max(0, sampleMs)) * 0.3 }
}
