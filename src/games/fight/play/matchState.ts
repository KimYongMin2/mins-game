// 한 경기의 진행 상태. 시간(now)과 시드 난수를 상태에 담아 순수 리듀서로 유지한다.
// 턴: 고르기(2초) → 공개(결과 보여주기) → 다음 턴. 생명력 0이 되거나 턴 제한이 끝나면 종료.
//
// 친구 대전: 방장 쪽이 턴 시간을 재고 공개를 정한다. 친구 쪽(follow)은 방장이 보낸
// 'remoteTurn'·'remoteReveal'을 그대로 따라간다. 양쪽 모두 자기 자신이 왼쪽(0)이다.
import { createRng } from '../../../shared/random'
import { CHOOSE_MS, DONE_MS, type Difficulty, INTRO_MS, REVEAL_MS } from '../constants'
import { chooseBotStance } from '../bot/fightBot'
import { FRESH, type Fighter, type Pair, type Stance, type TurnResult, type Winner, canChoose, resolveTurn, winnerOf } from '../rules/turn'

/** 자세를 고르는 주체. remote = 방에 들어온 친구 */
export type Controller = 'user' | 'bot' | 'remote'

export type SoundName = 'charge' | 'guard' | 'block' | 'hit' | 'smash' | 'clash' | 'win' | 'lose' | 'tick'

export type Phase =
  | { kind: 'intro'; until: number }
  /**
   * 고르는 중. picks는 지금까지 고른 것 (상대 것은 화면에 숨긴다).
   * inputUntil까지 내가 고를 수 있고, until에 공개한다 (친구 대전은 친구 입력이 도착할 여유를 둔다)
   */
  | { kind: 'choosing'; index: number; inputUntil: number; until: number; picks: Pair<Stance | null> }
  | { kind: 'reveal'; result: TurnResult; until: number }
  | { kind: 'done'; winner: Exclude<Winner, null>; until: number }

export type MatchState = {
  now: number
  seed: number
  difficulty: Difficulty
  controllers: Pair<Controller>
  /** 친구 대전의 친구 쪽: 턴 시작과 공개를 방장에게서 받는다 */
  follow: boolean
  fighters: Pair<Fighter>
  /** 끝난 턴들 */
  turns: TurnResult[]
  phase: Phase
  sounds: { id: number; name: SoundName }[]
  soundSeq: number
}

export type MatchAction =
  | { type: 'tick'; now: number }
  | { type: 'pick'; side: 0 | 1; stance: Stance }
  /** 방장: 친구가 고른 것이 도착함 */
  | { type: 'remotePick'; side: 0 | 1; turn: number; stance: Stance }
  /** 친구: 방장이 새 턴을 시작함 */
  | { type: 'remoteTurn'; turn: number }
  /** 친구: 방장이 공개함 (내 쪽 기준 순서) */
  | { type: 'remoteReveal'; turn: number; stances: Pair<Stance> }

/** 방장이 친구 입력을 기다려 주는 시간 (통신 지연 여유) */
export const NET_GRACE_MS = 300

/** 고르지 않으면 이 자세 */
export const DEFAULT_STANCE: Stance = 'ready'

function withSounds(state: MatchState, ...names: SoundName[]): MatchState {
  let seq = state.soundSeq
  const added = names.map((name) => ({ id: ++seq, name }))
  return { ...state, sounds: [...state.sounds, ...added].slice(-8), soundSeq: seq }
}

export function createMatch(opts: {
  now: number
  seed: number
  difficulty: Difficulty
  /** 기본은 나 vs 봇 */
  controllers?: Pair<Controller>
  follow?: boolean
}): MatchState {
  return {
    now: opts.now,
    seed: opts.seed,
    difficulty: opts.difficulty,
    controllers: opts.controllers ?? ['user', 'bot'],
    follow: opts.follow ?? false,
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
  const inputUntil = state.now + CHOOSE_MS
  const waitRemote = !state.follow && state.controllers.includes('remote')
  return {
    ...state,
    seed: rng.seed(),
    phase: {
      kind: 'choosing',
      index: state.turns.length,
      inputUntil,
      until: inputUntil + (waitRemote ? NET_GRACE_MS : 0),
      picks,
    },
  }
}

function turnSounds(result: TurnResult): SoundName[] {
  const e = result.events
  if (e.includes('smash-hit')) return ['smash']
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
      // 친구 쪽은 방장의 첫 턴을 기다린다
      return now >= phase.until && !state.follow ? startChoosing(state) : state
    case 'choosing':
      return now >= phase.until && !state.follow ? reveal(state, phase.picks) : state
    case 'reveal': {
      if (now < phase.until) return state
      const winner = winnerOf(state.fighters, state.turns.length)
      if (winner === null) return state.follow ? state : startChoosing(state)
      const userSide = state.controllers.indexOf('user')
      return withSounds({ ...state, phase: { kind: 'done', winner, until: now + DONE_MS } }, winner === userSide ? 'win' : 'lose')
    }
    case 'done':
      return state
  }
}

function pick(state: MatchState, side: 0 | 1, stance: Stance): MatchState {
  const { phase } = state
  if (phase.kind !== 'choosing' || state.controllers[side] !== 'user' || state.now >= phase.inputUntil) return state
  if (!canChoose(state.fighters[side], stance) || phase.picks[side] === stance) return state
  return withSounds({ ...state, phase: { ...phase, picks: withPick(phase.picks, side, stance) } }, 'tick')
}

function withPick(picks: Pair<Stance | null>, side: 0 | 1, stance: Stance): Pair<Stance | null> {
  return side === 0 ? [stance, picks[1]] : [picks[0], stance]
}

function remotePick(state: MatchState, side: 0 | 1, turn: number, stance: Stance): MatchState {
  const { phase } = state
  if (phase.kind !== 'choosing' || phase.index !== turn || state.controllers[side] !== 'remote') return state
  if (!canChoose(state.fighters[side], stance)) return state
  return { ...state, phase: { ...phase, picks: withPick(phase.picks, side, stance) } }
}

/** 지금 이 턴을 받을 수 있는지 (친구 쪽, 아직 경기 중) */
function awaitingTurn(state: MatchState, turn: number): boolean {
  const { kind } = state.phase
  return state.follow && turn === state.turns.length && (kind === 'intro' || kind === 'reveal')
}

function remoteTurn(state: MatchState, turn: number): MatchState {
  if (!awaitingTurn(state, turn) || winnerOf(state.fighters, state.turns.length) !== null) return state
  return startChoosing(state)
}

function remoteReveal(state: MatchState, turn: number, stances: Pair<Stance>): MatchState {
  if (!state.follow || turn !== state.turns.length) return state
  const { kind } = state.phase
  // 턴 시작 메시지를 놓쳤어도 공개는 받는다
  if (kind !== 'choosing' && kind !== 'intro' && kind !== 'reveal') return state
  return reveal(state, stances)
}

export function matchReducer(state: MatchState, action: MatchAction): MatchState {
  switch (action.type) {
    case 'tick':
      return tick({ ...state, now: action.now })
    case 'pick':
      return pick(state, action.side, action.stance)
    case 'remotePick':
      return remotePick(state, action.side, action.turn, action.stance)
    case 'remoteTurn':
      return remoteTurn(state, action.turn)
    case 'remoteReveal':
      return remoteReveal(state, action.turn, action.stances)
  }
}

export type MatchSummary = {
  /** 봇 대전 / 친구 대전 (기록을 따로 센다) */
  mode: 'bot' | 'pvp'
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
    mode: state.controllers.includes('remote') ? 'pvp' : 'bot',
    difficulty: state.difficulty,
    outcome: winner === 'draw' ? 'draw' : winner === me ? 'win' : 'lose',
    turns: state.turns.length,
    life: [state.fighters[me].life, state.fighters[1 - me].life],
    strikes: state.turns.filter((t) => t.events[me] === 'strike').length,
  }
}
