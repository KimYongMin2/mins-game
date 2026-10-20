import type { PitchCall } from '../play/pitch'
import type { PitchOutcome, Side } from '../rules/game'
import { type MatchAction, type MatchState, isUserBatting } from './matchState'

// 친구 대전 메시지. 투수 쪽이 던진 공을, 타자 쪽이 그 공의 판정을 보낸다.
// 방장·친구 구분은 경기 시작(선공·후공 정하기)과 다시 하기에만 쓴다.

export type BaseballMsg =
  /** 친구 → 방장: 메시지 받을 준비 됨 */
  | { t: 'ready' }
  /** 방장 → 친구: 새 경기. 친구가 선공(away)인지 후공(home)인지 */
  | { t: 'start'; guestSide: Side }
  /** 투수 → 타자: n번째 공 */
  | { t: 'pitch'; n: number; call: PitchCall; windupMs: number }
  /** 타자 → 투수: n번째 공의 판정 */
  | { t: 'outcome'; n: number; outcome: PitchOutcome; contact: boolean }

/** 상태가 prev → next로 바뀌면서 친구에게 보낼 메시지 */
export function outbox(prev: MatchState, next: MatchState): BaseballMsg[] {
  if (next.config.opponent !== 'remote') return []
  const out: BaseballMsg[] = []
  // 내가 투수로 공을 던짐
  if (next.pitchCount > prev.pitchCount && next.phase.kind === 'pitching' && !isUserBatting(next)) {
    const { type, isBall, height, releaseAt } = next.phase.pitch
    out.push({ t: 'pitch', n: next.pitchCount - 1, call: { type, isBall, height }, windupMs: Math.max(0, releaseAt - next.now) })
  }
  // 내가 타자로 판정을 냄 (판정 직후 공수가 바뀔 수 있어 prev로 누가 타자였는지 본다)
  if (prev.phase.kind === 'pitching' && next.phase.kind === 'result' && isUserBatting(prev)) {
    out.push({ t: 'outcome', n: next.pitchCount - 1, outcome: next.phase.outcome, contact: next.phase.contact })
  }
  return out
}

/** 친구 메시지 → 내 경기에 넣을 액션 */
export function actionOf(msg: BaseballMsg): MatchAction | null {
  if (msg.t === 'pitch') return { type: 'remotePitch', n: msg.n, call: msg.call, windupMs: msg.windupMs }
  if (msg.t === 'outcome') return { type: 'remoteOutcome', n: msg.n, outcome: msg.outcome, contact: msg.contact }
  return null
}
