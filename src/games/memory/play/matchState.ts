// 한 경기의 진행 상태. 시간(now)과 시드 난수를 상태에 담아 순수 리듀서로 유지한다.
// 차례: 한 장 열기 → 한 장 더 열기 → 맞으면 가져가고 한 번 더 / 틀리면 보여준 뒤 덮고 차례 넘김.
//
// 친구 대전: 방장·친구 모두 자기 자신이 왼쪽(0)이다. 차례인 쪽이 연 카드를 보내고(flips),
// 받는 쪽은 'remoteFlip'으로 그대로 연다. 덱은 둘이 같은 시드(deckSeed)로 만든다.
import { type Rng, createRng, pickOne } from '../../../shared/random'
import { chooseBotCard } from '../bot/memoryBot'
import {
  BOT_MEMORY,
  BOT_THINK_MS,
  CARD_COUNT,
  DONE_MS,
  type Difficulty,
  INTRO_MS,
  MATCH_SHOW_MS,
  MISS_SHOW_MS,
  PAIRS,
  PICK_MS,
} from '../constants'

/** 카드를 여는 주체. remote = 방에 들어온 친구 */
export type Controller = 'user' | 'bot' | 'remote'

export type Side = 0 | 1
export type Pair<T> = readonly [T, T]

export type Card = {
  /** 그림 번호 0~11 */
  face: number
  /** 가져간 사람. 아직이면 null */
  owner: Side | null
}

export type SoundName = 'flip' | 'match' | 'miss' | 'win' | 'lose'

export type Phase =
  | { kind: 'intro'; until: number }
  /** 차례인 사람이 고르는 중. until에 시간 초과, botAt에 봇이 연다 */
  | { kind: 'picking'; until: number; botAt: number }
  /** 두 장을 보여주는 중 */
  | { kind: 'showing'; until: number; match: boolean }
  | { kind: 'done'; winner: Side | 'draw'; until: number }

export type Flip = { side: Side; index: number }

export type MatchState = {
  now: number
  seed: number
  difficulty: Difficulty
  controllers: Pair<Controller>
  cards: Card[]
  turn: Side
  /** 이번 차례에 연 카드 (0~2장) */
  open: number[]
  /** 지금까지 연 카드 전부 (친구에게 보낼 것을 고르고, 받은 것의 순서를 맞춘다) */
  flips: Flip[]
  /** 봇이 기억하는 그림 (봇이 없으면 쓰지 않음) */
  memory: (number | null)[]
  phase: Phase
  sounds: { id: number; name: SoundName }[]
  soundSeq: number
}

export type MatchAction =
  | { type: 'tick'; now: number }
  /** 내가 카드를 누름 */
  | { type: 'pick'; index: number }
  /** 친구가 n번째로 연 카드 */
  | { type: 'remoteFlip'; n: number; index: number }

/** 시드로 덱을 섞는다. 친구 대전은 둘이 같은 시드를 써서 같은 덱이 된다 */
export function shuffleDeck(seed: number): number[] {
  const rng = createRng(seed)
  const faces = Array.from({ length: CARD_COUNT }, (_, i) => i % PAIRS)
  for (let i = faces.length - 1; i > 0; i--) {
    const j = Math.floor(rng.next() * (i + 1))
    ;[faces[i], faces[j]] = [faces[j], faces[i]]
  }
  return faces
}

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
  /** 친구 대전: 방장이 정해서 보낸 덱 시드와 선공. 봇전은 seed로 정한다 */
  deckSeed?: number
  first?: Side
}): MatchState {
  const rng = createRng(opts.seed)
  const deckSeed = opts.deckSeed ?? Math.floor(rng.next() * 2 ** 32)
  const first = opts.first ?? (rng.next() < 0.5 ? 0 : 1)
  return {
    now: opts.now,
    seed: rng.seed(),
    difficulty: opts.difficulty,
    controllers: opts.controllers ?? ['user', 'bot'],
    cards: shuffleDeck(deckSeed).map((face) => ({ face, owner: null })),
    turn: first,
    open: [],
    flips: [],
    memory: Array.from({ length: CARD_COUNT }, () => null),
    phase: { kind: 'intro', until: opts.now + INTRO_MS },
    sounds: [],
    soundSeq: 0,
  }
}

/** 지금 열 수 있는 카드인지 */
export function canFlip(state: MatchState, index: number): boolean {
  const card = state.cards[index]
  return state.phase.kind === 'picking' && card !== undefined && card.owner === null && !state.open.includes(index)
}

export function pairsOf(state: MatchState): Pair<number> {
  const count = (side: Side) => state.cards.filter((c) => c.owner === side).length / 2
  return [count(0), count(1)]
}

function picking(state: MatchState): MatchState {
  return { ...state, phase: { kind: 'picking', until: state.now + PICK_MS, botAt: state.now + BOT_THINK_MS } }
}

const hasBot = (state: MatchState) => state.controllers.includes('bot')

function flip(state: MatchState, index: number): MatchState {
  if (!canFlip(state, index)) return state
  const rng = createRng(state.seed)
  const side = state.turn
  const card = state.cards[index]
  let memory = state.memory
  if (hasBot(state) && rng.next() < BOT_MEMORY[state.difficulty].remember) {
    memory = memory.map((f, i) => (i === index ? card.face : f))
  }
  const open = [...state.open, index]
  const next: MatchState = { ...state, seed: rng.seed(), memory, open, flips: [...state.flips, { side, index }] }
  if (open.length < 2) return withSounds(picking(next), 'flip')

  const [a, b] = open
  const match = state.cards[a].face === state.cards[b].face
  const cards = match ? state.cards.map((c, i) => (i === a || i === b ? { ...c, owner: side } : c)) : state.cards
  return withSounds(
    { ...next, cards, phase: { kind: 'showing', until: state.now + (match ? MATCH_SHOW_MS : MISS_SHOW_MS), match } },
    'flip',
    match ? 'match' : 'miss',
  )
}

/** 봇 기억에서 카드를 확률로 잊는다 (차례가 바뀔 때) */
function forget(rng: Rng, state: MatchState): (number | null)[] {
  if (!hasBot(state)) return state.memory
  const p = BOT_MEMORY[state.difficulty].forget
  return state.memory.map((f) => (f !== null && rng.next() < p ? null : f))
}

function endShowing(state: MatchState): MatchState {
  if (state.phase.kind !== 'showing') return state
  if (state.phase.match) {
    if (state.cards.every((c) => c.owner !== null)) return finish({ ...state, open: [] })
    return picking({ ...state, open: [] })
  }
  const rng = createRng(state.seed)
  const memory = forget(rng, state)
  return picking({ ...state, seed: rng.seed(), memory, open: [], turn: (1 - state.turn) as Side })
}

function finish(state: MatchState): MatchState {
  const [mine, theirs] = pairsOf(state)
  const winner: Side | 'draw' = mine === theirs ? 'draw' : mine > theirs ? 0 : 1
  const userSide = state.controllers.indexOf('user')
  return withSounds({ ...state, phase: { kind: 'done', winner, until: state.now + DONE_MS } }, winner === userSide ? 'win' : 'lose')
}

/** 보여주기·시작 안내가 남아 있으면 바로 끝낸다 (친구 카드가 조금 일찍 도착했을 때) */
function settle(state: MatchState): MatchState {
  if (state.phase.kind === 'intro') return picking(state)
  if (state.phase.kind === 'showing') return endShowing(state)
  return state
}

function tick(state: MatchState): MatchState {
  const { phase, now } = state
  switch (phase.kind) {
    case 'intro':
      return now >= phase.until ? picking(state) : state
    case 'showing':
      return now >= phase.until ? endShowing(state) : state
    case 'picking': {
      const who = state.controllers[state.turn]
      if (who === 'bot' && now >= phase.botAt) return botFlip(state)
      // 시간 초과는 차례인 사람 기기만 처리한다 (친구 차례면 친구가 보낸다)
      if (who === 'user' && now >= phase.until) return randomFlip(state)
      return state
    }
    case 'done':
      return state
  }
}

function closedCards(state: MatchState): number[] {
  return state.cards.flatMap((c, i) => (c.owner === null && !state.open.includes(i) ? [i] : []))
}

function randomFlip(state: MatchState): MatchState {
  const rng = createRng(state.seed)
  const index = pickOne(rng, closedCards(state))
  return flip({ ...state, seed: rng.seed() }, index)
}

function botFlip(state: MatchState): MatchState {
  const rng = createRng(state.seed)
  const first = state.open[0]
  const index = chooseBotCard(rng, {
    memory: state.memory,
    available: state.cards.map((c, i) => c.owner === null && !state.open.includes(i)),
    first: first === undefined ? null : { index: first, face: state.cards[first].face },
  })
  return flip({ ...state, seed: rng.seed() }, index)
}

export function matchReducer(state: MatchState, action: MatchAction): MatchState {
  switch (action.type) {
    case 'tick':
      return tick({ ...state, now: action.now })
    case 'pick':
      return state.controllers[state.turn] === 'user' ? flip(state, action.index) : state
    case 'remoteFlip': {
      if (action.n !== state.flips.length) return state
      const settled = settle(state)
      return settled.controllers[settled.turn] === 'remote' ? flip(settled, action.index) : state
    }
  }
}

export type MatchSummary = {
  /** 봇 대전 / 친구 대전 (기록을 따로 센다) */
  mode: 'bot' | 'pvp'
  difficulty: Difficulty
  /** 내 입장에서 */
  outcome: 'win' | 'lose' | 'draw'
  /** 가져간 쌍 (나, 상대) */
  pairs: Pair<number>
  /** 내가 두 장을 연 횟수 */
  tries: number
}

export function summarizeMatch(state: MatchState): MatchSummary {
  if (state.phase.kind !== 'done') throw new Error('경기가 아직 안 끝났어요')
  const me = state.controllers.indexOf('user') as Side
  const { winner } = state.phase
  const [p0, p1] = pairsOf(state)
  return {
    mode: state.controllers.includes('remote') ? 'pvp' : 'bot',
    difficulty: state.difficulty,
    outcome: winner === 'draw' ? 'draw' : winner === me ? 'win' : 'lose',
    pairs: me === 0 ? [p0, p1] : [p1, p0],
    tries: Math.floor(state.flips.filter((f) => f.side === me).length / 2),
  }
}
