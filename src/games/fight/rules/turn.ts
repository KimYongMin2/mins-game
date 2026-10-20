import { MAX_LIFE, MAX_STACKS, MAX_TURNS } from '../constants'

// 한 턴의 판정. 둘이 동시에 고른 자세로 생명력·준비 스택이 바뀐다.

export type Stance = 'ready' | 'guard' | 'attack'

export const STANCES: readonly Stance[] = ['ready', 'guard', 'attack']

export const STANCE_LABEL: Record<Stance, string> = { ready: '준비', guard: '방어', attack: '타격' }

export type Fighter = { life: number; stacks: number }

export const FRESH: Fighter = { life: MAX_LIFE, stacks: 0 }

/** 두 선수. 0 = 왼쪽(나), 1 = 오른쪽(상대) */
export type Pair<T> = readonly [T, T]

/** 그 턴에 선수에게 일어난 일 */
export type TurnEvent =
  /** 준비해서 스택 +1 */
  | 'charge'
  /** 준비했지만 스택이 이미 꽉 참 */
  | 'charge-full'
  /** 준비하다 맞음 (생명력 −1, 스택 안 쌓임) */
  | 'hurt'
  /** 상대 타격을 막음 */
  | 'block'
  /** 방어했지만 상대가 안 침 */
  | 'guard'
  /** 타격 명중 */
  | 'strike'
  /** 타격이 막힘 */
  | 'blocked'
  /** 타격끼리 부딪힘 (둘 다 스택만 소모) */
  | 'clash'

export function canChoose(fighter: Fighter, stance: Stance): boolean {
  return stance !== 'attack' || fighter.stacks > 0
}

/** 고를 수 없는 자세(스택 없이 타격)는 준비로 바꾼다 */
export function sanitize(fighter: Fighter, stance: Stance): Stance {
  return canChoose(fighter, stance) ? stance : 'ready'
}

function eventOf(mine: Stance, theirs: Stance, me: Fighter): TurnEvent {
  if (mine === 'attack') {
    if (theirs === 'attack') return 'clash'
    return theirs === 'guard' ? 'blocked' : 'strike'
  }
  if (mine === 'guard') return theirs === 'attack' ? 'block' : 'guard'
  if (theirs === 'attack') return 'hurt'
  return me.stacks >= MAX_STACKS ? 'charge-full' : 'charge'
}

function apply(f: Fighter, event: TurnEvent): Fighter {
  switch (event) {
    case 'charge':
      return { ...f, stacks: f.stacks + 1 }
    case 'hurt':
      return { ...f, life: Math.max(0, f.life - 1) }
    case 'strike':
    case 'blocked':
    case 'clash':
      return { ...f, stacks: f.stacks - 1 }
    default:
      return f
  }
}

export type TurnResult = {
  stances: Pair<Stance>
  events: Pair<TurnEvent>
  fighters: Pair<Fighter>
}

export function resolveTurn(fighters: Pair<Fighter>, chosen: Pair<Stance>): TurnResult {
  const stances = [sanitize(fighters[0], chosen[0]), sanitize(fighters[1], chosen[1])] as const
  const events = [eventOf(stances[0], stances[1], fighters[0]), eventOf(stances[1], stances[0], fighters[1])] as const
  return { stances, events, fighters: [apply(fighters[0], events[0]), apply(fighters[1], events[1])] }
}

/** 0·1 = 그 선수 승리, 'draw' = 무승부, null = 계속 */
export type Winner = 0 | 1 | 'draw' | null

/** turnsPlayed: 지금까지 끝난 턴 수 */
export function winnerOf(fighters: Pair<Fighter>, turnsPlayed: number): Winner {
  const [a, b] = fighters
  if (a.life <= 0 && b.life <= 0) return 'draw'
  if (b.life <= 0) return 0
  if (a.life <= 0) return 1
  if (turnsPlayed < MAX_TURNS) return null
  if (a.life === b.life) return 'draw'
  return a.life > b.life ? 0 : 1
}
