// 한 경기의 진행 상태. 시간(now)과 시드 난수를 상태에 담아 순수 리듀서로 유지한다.
// 턴: 고르기(2초) → 공개(결과 보여주기) → 다음 턴. 생명력 0이 되거나 턴 제한이 끝나면 종료.
import { createRng } from '../../../shared/random'
import { CHOOSE_MS, DONE_MS, type Difficulty, INTRO_MS, REVEAL_MS } from '../constants'
import { chooseBotStance } from '../bot/fightBot'
import { FRESH, type Fighter, type Pair, type Stance, type TurnResult, type Winner, canChoose, resolveTurn, winnerOf } from '../rules/turn'

/** 자세를 고르는 주체. 나중에 친구 대전은 'remote'를 추가한다 */
export type Controller = 'user' | 'bot'

export type SoundName = 'charge' | 'guard' | 'block' | 'hit' | 'clash' | 'win' | 'lose' | 'tick'

export type Phase =
  | { kind: 'intro'; until: number }
  /** 고르는 중. picks는 지금까지 고른 것 (상대 것은 화면에 숨긴다) */
  | { kind: 'choosing'; until: number; picks: Pair<Stance | null> }
  | { kind: 'reveal'; result: TurnResult; until: number }
  | { kind: 'done'; winner: Exclude<Winner, null>; until: number }

export type MatchState = {
  now: number
  seed: number
  difficulty: Difficulty
  controllers: Pair<Controller>
  fighters: Pair<Fighter>
  /** 끝난 턴들 */
  turns: TurnResult[]
  phase: Phase
  sounds: { id: number; name: SoundName }[]
  soundSeq: number
}

export type MatchAction = { type: 'tick'; now: number } | { type: 'pick'; side: 0 | 1; stance: Stance }

/** 고르지 않으면 이 자세 */
export const DEFAULT_STANCE: Stance = 'ready'

function withSounds(state: MatchState, ...names: SoundName[]): MatchState {
  let seq = state.soundSeq
  const added = names.map((name) => ({ id: ++seq, name }))
  return { ...state, sounds: [...state.sounds, ...added].slice(-8), soundSeq: seq }
}

export function createMatch(opts: { now: number; seed: number; difficulty: Difficulty }): MatchState {
  return {
    now: opts.now,
    seed: opts.seed,
    difficulty: opts.difficulty,
    controllers: ['user', 'bot'],
    fighters: [FRESH, FRESH],
    turns: [],
    phase: { kind: 'intro', until: opts.now + INTRO_MS },
    sounds: [],
    soundSeq: 0,
  }
}

/** 새 턴: 봇은 이때 몰래 고른다 */
function startChoosing(state: MatchState): MatchState {
  const rng = createRng(state.seed)
  const picks: [Stance | null, Stance | null] = [null, null]
  state.controllers.forEach((c, i) => {
    if (c !== 'bot') return
    const side = i as 0 | 1
    const other = (1 - side) as 0 | 1
    picks[side] = chooseBotStance({
      rng,
      difficulty: state.difficulty,
      self: state.fighters[side],
      foe: state.fighters[other],
      foeHistory: state.turns.map((t) => t.stances[other]),
    })
  })
  return { ...state, seed: rng.seed(), phase: { kind: 'choosing', until: state.now + CHOOSE_MS, picks } }
}

function turnSounds(result: TurnResult): SoundName[] {
  const e = result.events
  if (e.includes('strike')) return ['hit']
  if (e.includes('clash')) return ['clash']
  if (e.includes('block')) return ['block']
  if (e.includes('charge')) return ['charge']
  return ['guard']
}

function reveal(state: MatchState, picks: Pair<Stance | null>): MatchState {
  const chosen = [picks[0] ?? DEFAULT_STANCE, picks[1] ?? DEFAULT_STANCE] as const
  const result = resolveTurn(state.fighters, chosen)
  return withSounds(
    {
      ...state,
      fighters: result.fighters,
      turns: [...state.turns, result],
      phase: { kind: 'reveal', result, until: state.now + REVEAL_MS },
    },
    ...turnSounds(result),
  )
}

function tick(state: MatchState): MatchState {
  const { phase, now } = state
  switch (phase.kind) {
    case 'intro':
      return now >= phase.until ? startChoosing(state) : state
    case 'choosing':
      return now >= phase.until ? reveal(state, phase.picks) : state
    case 'reveal': {
      if (now < phase.until) return state
      const winner = winnerOf(state.fighters, state.turns.length)
      if (winner === null) return startChoosing(state)
      const userSide = state.controllers.indexOf('user')
      return withSounds({ ...state, phase: { kind: 'done', winner, until: now + DONE_MS } }, winner === userSide ? 'win' : 'lose')
    }
    case 'done':
      return state
  }
}

function pick(state: MatchState, side: 0 | 1, stance: Stance): MatchState {
  const { phase } = state
  if (phase.kind !== 'choosing' || state.controllers[side] !== 'user') return state
  if (!canChoose(state.fighters[side], stance) || phase.picks[side] === stance) return state
  const picks = side === 0 ? ([stance, phase.picks[1]] as const) : ([phase.picks[0], stance] as const)
  return withSounds({ ...state, phase: { ...phase, picks } }, 'tick')
}

export function matchReducer(state: MatchState, action: MatchAction): MatchState {
  switch (action.type) {
    case 'tick':
      return tick({ ...state, now: action.now })
    case 'pick':
      return pick(state, action.side, action.stance)
  }
}

export type MatchSummary = {
  difficulty: Difficulty
  /** 내 입장에서 */
  outcome: 'win' | 'lose' | 'draw'
  turns: number
  /** 남은 생명력 (나, 상대) */
  life: Pair<number>
  /** 내가 넣은 타격 수 */
  strikes: number
}

export function summarizeMatch(state: MatchState): MatchSummary {
  if (state.phase.kind !== 'done') throw new Error('경기가 아직 안 끝났어요')
  const me = state.controllers.indexOf('user') as 0 | 1
  const { winner } = state.phase
  return {
    difficulty: state.difficulty,
    outcome: winner === 'draw' ? 'draw' : winner === me ? 'win' : 'lose',
    turns: state.turns.length,
    life: [state.fighters[me].life, state.fighters[1 - me].life],
    strikes: state.turns.filter((t) => t.events[me] === 'strike').length,
  }
}
