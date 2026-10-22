import type { Length } from '../constants'
import type { Digits, Score } from '../rules/numbers'
import type { MatchAction, MatchState, Side } from './matchState'

// 친구 대전 메시지. 방장이 숫자 개수와 선공을 정해 보내고, 그다음은 대칭:
// 각 기기는 자기 숫자만 안다. 부른 쪽이 숫자를 보내면(guess) 받은 쪽이 자기 숫자로 판정해 답한다(answer).
// 경기가 끝나면 서로 숫자를 알려준다(reveal). 방장·친구 모두 자기 자신이 0이다.

export type NumbaseballMsg =
  /** 친구 → 방장: 메시지 받을 준비 됨 (방장은 이걸 받고 첫 경기를 시작한다) */
  | { t: 'ready' }
  /** 방장 → 친구: 새 경기. 숫자 개수와 친구가 먼저 하는지 */
  | { t: 'start'; length: Length; guestFirst: boolean }
  /** 내 숫자를 정했음 (숫자는 안 보냄) */
  | { t: 'locked' }
  /** n번째로 부른 숫자 */
  | { t: 'guess'; n: number; digits: number[] }
  /** 상대가 n번째로 부른 숫자의 판정 */
  | { t: 'answer'; n: number; strike: number; ball: number }
  /** 경기가 끝나고 내 숫자 공개 */
  | { t: 'reveal'; digits: number[] }

/** 경기 시작 메시지에서 내 쪽 선공 (나 = 0) */
export function firstOf(msg: Extract<NumbaseballMsg, { t: 'start' }>, role: 'host' | 'guest'): Side {
  return msg.guestFirst === (role === 'guest') ? 0 : 1
}

const scoreOf = (m: { strike: number; ball: number }): Score => ({ strike: m.strike, ball: m.ball })

/** 상태가 prev → next로 바뀌면서 상대에게 보낼 메시지 */
export function outbox(prev: MatchState, next: MatchState): NumbaseballMsg[] {
  const out: NumbaseballMsg[] = []
  if (!prev.locked[0] && next.locked[0]) out.push({ t: 'locked' })
  // 내가 부른 것
  for (let n = prev.guesses[0].length; n < next.guesses[0].length; n++) {
    out.push({ t: 'guess', n, digits: [...next.guesses[0][n].digits] })
  }
  // 상대가 부른 것의 판정 (받자마자 내 기기에서 판정됨)
  for (let n = prev.guesses[1].length; n < next.guesses[1].length; n++) {
    const s = next.guesses[1][n].score
    if (s) out.push({ t: 'answer', n, ...scoreOf(s) })
  }
  if (prev.phase.kind !== 'done' && next.phase.kind === 'done' && next.secrets[0]) {
    out.push({ t: 'reveal', digits: [...next.secrets[0]] })
  }
  return out
}

/** 상대 메시지 → 내 경기에 넣을 액션 */
export function actionOf(msg: NumbaseballMsg): MatchAction | null {
  switch (msg.t) {
    case 'locked':
      return { type: 'remoteLocked' }
    case 'guess':
      return { type: 'remoteGuess', n: msg.n, digits: msg.digits as Digits }
    case 'answer':
      return { type: 'remoteAnswer', n: msg.n, score: scoreOf(msg) }
    case 'reveal':
      return { type: 'remoteReveal', digits: msg.digits }
    default:
      return null
  }
}
