// 한 번 튕긴 뒤의 판정: 경기가 끝났는지. 안 끝났으면 무조건 번갈아 (떨어뜨려도 한 번 더 없음)
import type { Side, Stone } from './physics'
import { remaining } from './physics'

export type TurnOutcome =
  /** 경기 끝. 둘 다 다 떨어지면 무승부 */
  | { kind: 'over'; winner: Side | 'draw' }
  | { kind: 'next' }

export function judgeShot(after: readonly Stone[], shooter: Side): TurnOutcome {
  const foe = (1 - shooter) as Side
  const mine = remaining(after, shooter)
  const theirs = remaining(after, foe)
  if (mine === 0 && theirs === 0) return { kind: 'over', winner: 'draw' }
  if (theirs === 0) return { kind: 'over', winner: shooter }
  if (mine === 0) return { kind: 'over', winner: foe }
  return { kind: 'next' }
}
