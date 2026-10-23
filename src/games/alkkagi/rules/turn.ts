// 한 번 튕긴 뒤의 판정: 한 번 더 하는지, 경기가 끝났는지.
import type { Side, Stone } from './physics'
import { remaining } from './physics'

export type TurnOutcome =
  /** 경기 끝. 둘 다 다 떨어지면 무승부 */
  | { kind: 'over'; winner: Side | 'draw' }
  /** 상대 돌을 떨어뜨리고 튕긴 돌이 판에 남았으면 한 번 더 */
  | { kind: 'again' }
  | { kind: 'next' }

export function judgeShot(before: readonly Stone[], after: readonly Stone[], shooter: Side, index: number): TurnOutcome {
  const foe = (1 - shooter) as Side
  const mine = remaining(after, shooter)
  const theirs = remaining(after, foe)
  if (mine === 0 && theirs === 0) return { kind: 'over', winner: 'draw' }
  if (theirs === 0) return { kind: 'over', winner: shooter }
  if (mine === 0) return { kind: 'over', winner: foe }
  const knocked = remaining(before, foe) - theirs
  return knocked > 0 && after[index].on ? { kind: 'again' } : { kind: 'next' }
}
