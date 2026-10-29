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
/** 친구가 최대 몇 스텝까지 앞서 예측하는지 (너무 느린 통신에서 폭주 방지) */
const MAX_LEAD = STEP_HZ / 2

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

export const sameInput = (a: Input, b: Input) => a.left === b.left && a.right === b.right && a.jump === b.jump && a.hit === b.hit

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
}

export function createGuest(initial: SimState): Guest {
  return { local: initial, authTick: initial.tick, hostInput: NO_INPUT, history: new Map(), rttMs: DEFAULT_RTT_MS }
}

/** 친구 기기에서 한 스텝 예측 */
export function guestStep(g: Guest, mine: Input): Guest {
  // 방장보다 너무 앞서면 기다린다
  if (g.local.tick - g.authTick >= MAX_LEAD) return g
  const local = step(g.local, [g.hostInput, mine])
  const history = new Map(g.history)
  history.set(local.tick, mine)
  return { ...g, local, history }
}

/** 방장 상태를 받음: 그 시점으로 되감고, 왕복 지연만큼 앞까지 내 키로 다시 돌린다 */
export function guestReceive(g: Guest, s: SimState, inputs: [Input, Input]): Guest {
  if (s.tick <= g.authTick) return g
  const lead = Math.min(MAX_LEAD, Math.round((g.rttMs / 1000) * STEP_HZ))
  const target = s.tick + lead
  const hostInput = inputs[0]
  let local = s
  // 끝난 경기는 스텝이 안 늘어서 거기서 멈춘다
  while (local.tick < target && local.phase.kind !== 'done') {
    const mine = g.history.get(local.tick + 1) ?? inputs[1]
    local = step(local, [hostInput, mine])
  }
  // 오래된 기록은 버린다
  const history = new Map([...g.history].filter(([tick]) => tick > s.tick))
  return { ...g, local, authTick: s.tick, hostInput, history }
}

export function withRtt(g: Guest, sampleMs: number): Guest {
  // 튀는 값에 흔들리지 않게 천천히 따라간다
  return { ...g, rttMs: g.rttMs * 0.7 + Math.min(1000, Math.max(0, sampleMs)) * 0.3 }
}
