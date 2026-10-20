import { MAX_LIFE, MAX_STACKS, MAX_TURNS, SMASH_COST } from '../constants'

// 한 턴의 판정. 둘이 동시에 고른 자세로 생명력·준비 스택이 바뀐다.

export type Stance = 'ready' | 'guard' | 'attack' | 'smash'

export const STANCES: readonly Stance[] = ['ready', 'guard', 'attack', 'smash']

export const STANCE_LABEL: Record<Stance, string> = { ready: '준비', guard: '방어', attack: '타격', smash: '강타' }

/** 자세마다 쓰는 스택 */
export const STANCE_COST: Record<Stance, number> = { ready: 0, guard: 0, attack: 1, smash: SMASH_COST }

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
  /** 방어했는데 강타에 뚫림 (생명력 −1) */
  | 'pierced'
  /** 타격 명중 */
  | 'strike'
  /** 타격이 막힘 */
  | 'blocked'
  /** 타격했는데 상대 강타에 밀려 맞음 (생명력 −1) */
  | 'overpowered'
  /** 강타 명중 (방어도 뚫고, 타격도 이긴다) */
  | 'smash-hit'
  /** 같은 공격끼리 부딪힘 (둘 다 스택만 소모) */
  | 'clash'

/** 생명력이 깎이는 일 */
const HURT_EVENTS: readonly TurnEvent[] = ['hurt', 'pierced', 'overpowered']

export function isHurt(event: TurnEvent): boolean {
  return HURT_EVENTS.includes(event)
}

export function canChoose(fighter: Fighter, stance: Stance): boolean {
  return fighter.stacks >= STANCE_COST[stance]
}

/** 고를 수 없는 자세(스택이 모자란 공격)는 준비로 바꾼다 */
export function sanitize(fighter: Fighter, stance: Stance): Stance {
  return canChoose(fighter, stance) ? stance : 'ready'
}

function eventOf(mine: Stance, theirs: Stance, me: Fighter): TurnEvent {
  if (mine === 'smash') return theirs === 'smash' ? 'clash' : 'smash-hit'
  if (mine === 'attack') {
    if (theirs === 'smash') return 'overpowered'
    if (theirs === 'attack') return 'clash'
    return theirs === 'guard' ? 'blocked' : 'strike'
  }
  if (mine === 'guard') {
    if (theirs === 'smash') return 'pierced'
    return theirs === 'attack' ? 'block' : 'guard'
  }
  if (theirs === 'attack' || theirs === 'smash') return 'hurt'
  return me.stacks >= MAX_STACKS ? 'charge-full' : 'charge'
}

function apply(f: Fighter, stance: Stance, event: TurnEvent): Fighter {
  const gained = event === 'charge' ? 1 : 0
  return {
    life: Math.max(0, f.life - (isHurt(event) ? 1 : 0)),
    stacks: f.stacks - STANCE_COST[stance] + gained,
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
  return {
    stances,
    events,
    fighters: [apply(fighters[0], stances[0], events[0]), apply(fighters[1], stances[1], events[1])],
  }
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
