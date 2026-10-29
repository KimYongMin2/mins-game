// 숫자 잇기 심판. 방장 기기(또는 봇 연습)에서만 돈다. 시간(now)과 시드 난수를 상태에 담은 순수 리듀서.
// 차례: 바닥을 다시 짜서 손패를 내려놓거나(play) 1장 가져오기(draw).
// 시간이 넘으면 짜던 바닥(draft)이 다 맞으면 그대로 내려놓고, 아니면 되돌리고 1장 가져오기.
// 손패를 다 털면 우승. 더미가 다 떨어진 뒤 모두가 한 바퀴 못 내면 남은 점수가 가장 적은 사람이 우승.
import { createRng } from '../../../shared/random'
import { chooseBotPlay } from '../bot/tilesBot'
import { BOT_THINK_MS, DONE_MS, HAND_SIZE, INTRO_MS, TURN_MS } from '../constants'
import { type TileId, handValue, shuffledDeck } from '../rules/tiles'
import { type Table, checkPlay } from '../rules/turn'

/** user = 이 기기, bot = 봇, remote = 방에 들어온 친구 */
export type PlayerKind = 'user' | 'bot' | 'remote'

export type Player = { id: string; name: string; kind: PlayerKind }

export type Phase =
  | { kind: 'intro'; until: number }
  /** until = 이때까지 안 내면 짜던 바닥으로 (틀리면 1장 가져오기) */
  | { kind: 'turn'; until: number }
  | { kind: 'done'; until: number }

export type EngineState = {
  now: number
  seed: number
  players: Player[]
  hands: TileId[][]
  pool: TileId[]
  table: Table
  /** 첫 등록을 했는지 */
  melded: boolean[]
  turn: number
  /** 방에서 나간 친구 (차례에서 뺀다) */
  left: boolean[]
  /** 더미가 빈 뒤 연달아 못 낸 차례 수 (남은 사람 수만큼이면 끝) */
  stuck: number
  /** 마지막 행동 (화면 연출용). seq가 바뀌면 새것 */
  last: { player: number; kind: 'play' | 'draw' | 'pass'; placed: TileId[]; seq: number } | null
  /** 차례인 사람이 짜고 있는 바닥 (시간 초과 때 씀). turnSeq = 그 차례가 시작될 때의 last.seq */
  draft: { player: number; turnSeq: number; table: Table } | null
  botAt: number | null
  seq: number
  phase: Phase
}

export type EngineAction =
  | { type: 'tick'; now: number }
  /** 바닥 전체를 이렇게 바꿔 내려놓음 */
  | { type: 'play'; player: number; table: Table }
  | { type: 'draw'; player: number }
  /** 차례인 사람이 짜고 있는 바닥 (아직 안 냄) */
  | { type: 'draft'; player: number; turnSeq: number; table: Table }
  /** 친구가 나감: 차례에서 뺀다 */
  | { type: 'drop'; player: number }

export function createEngine(opts: { now: number; seed: number; players: Player[] }): EngineState {
  const rng = createRng(opts.seed)
  const deck = shuffledDeck(rng)
  const hands = opts.players.map((_, i) => deck.slice(i * HAND_SIZE, (i + 1) * HAND_SIZE))
  return {
    now: opts.now,
    seed: rng.seed(),
    players: opts.players,
    hands,
    pool: deck.slice(opts.players.length * HAND_SIZE),
    table: [],
    melded: opts.players.map(() => false),
    turn: Math.floor(rng.next() * opts.players.length),
    left: opts.players.map(() => false),
    stuck: 0,
    last: null,
    draft: null,
    botAt: null,
    seq: 0,
    phase: { kind: 'intro', until: opts.now + INTRO_MS },
  }
}

const within = (r: number, [min, max]: readonly [number, number]) => min + r * (max - min)

const staying = (s: EngineState) => s.left.flatMap((l, i) => (l ? [] : [i]))

function startTurn(s: EngineState, turn: number): EngineState {
  return { ...s, turn, draft: null, botAt: null, phase: { kind: 'turn', until: s.now + TURN_MS } }
}

function nextTurn(s: EngineState): EngineState {
  const n = s.players.length
  for (let k = 1; k <= n; k++) {
    const t = (s.turn + k) % n
    if (!s.left[t]) return startTurn(s, t)
  }
  return s
}

const finish = (s: EngineState): EngineState => ({ ...s, botAt: null, phase: { kind: 'done', until: s.now + DONE_MS } })

export function canAct(s: EngineState, player: number): boolean {
  return s.phase.kind === 'turn' && s.turn === player
}

function play(s: EngineState, player: number, table: Table): EngineState {
  if (!canAct(s, player)) return s
  const check = checkPlay({ oldTable: s.table, hand: s.hands[player], newTable: table, melded: s.melded[player] })
  if (!check.ok) return s
  const hand = s.hands[player].filter((id) => !check.placed.includes(id))
  const seq = s.seq + 1
  const next: EngineState = {
    ...s,
    seq,
    table: table.filter((set) => set.length > 0),
    hands: s.hands.map((h, i) => (i === player ? hand : h)),
    melded: s.melded.map((m, i) => m || i === player),
    stuck: 0,
    last: { player, kind: 'play', placed: check.placed, seq },
  }
  return hand.length === 0 ? finish(next) : nextTurn(next)
}

function draw(s: EngineState, player: number): EngineState {
  if (!canAct(s, player)) return s
  const seq = s.seq + 1
  if (s.pool.length === 0) {
    const next: EngineState = { ...s, seq, stuck: s.stuck + 1, last: { player, kind: 'pass', placed: [], seq } }
    return next.stuck >= staying(next).length ? finish(next) : nextTurn(next)
  }
  const [tile, ...pool] = s.pool
  return nextTurn({
    ...s,
    seq,
    pool,
    hands: s.hands.map((h, i) => (i === player ? [...h, tile] : h)),
    stuck: 0,
    last: { player, kind: 'draw', placed: [], seq },
  })
}

/** 차례가 시작될 때의 번호 (짜던 바닥이 이번 차례 것인지 알아보려고) */
export function turnSeqOf(s: { last: EngineState['last'] }): number {
  return s.last?.seq ?? 0
}

function saveDraft(s: EngineState, player: number, turnSeq: number, table: Table): EngineState {
  if (!canAct(s, player) || turnSeq !== turnSeqOf(s)) return s
  return { ...s, draft: { player, turnSeq, table } }
}

/** 시간 초과: 짜던 바닥이 다 맞으면 그대로 내려놓고, 아니면(안 짰거나 틀림) 1장 가져오기 */
function timeUp(s: EngineState, player: number): EngineState {
  if (s.draft && s.draft.player === player) {
    const next = play(s, player, s.draft.table)
    if (next !== s) return next
  }
  return draw(s, player)
}

function drop(s: EngineState, player: number): EngineState {
  if (s.left[player] || s.phase.kind === 'done') return s
  const next = { ...s, left: s.left.map((l, i) => l || i === player) }
  if (staying(next).length <= 1) return finish(next)
  return s.turn === player && s.phase.kind === 'turn' ? nextTurn(next) : next
}

function tick(s: EngineState): EngineState {
  const { phase, now } = s
  switch (phase.kind) {
    case 'intro':
      return now >= phase.until ? startTurn(s, s.turn) : s
    case 'turn': {
      const p = s.turn
      if (s.players[p].kind === 'bot') {
        if (s.botAt === null) {
          const rng = createRng(s.seed)
          return { ...s, botAt: now + within(rng.next(), BOT_THINK_MS), seed: rng.seed() }
        }
        if (now < s.botAt) return s
        const table = chooseBotPlay(s.table, s.hands[p], s.melded[p])
        const next = table ? play(s, p, table) : s
        return next === s ? draw(s, p) : next
      }
      return now >= phase.until ? timeUp(s, p) : s
    }
    case 'done':
      return s
  }
}

export function engineReducer(s: EngineState, action: EngineAction): EngineState {
  switch (action.type) {
    case 'tick':
      return tick({ ...s, now: action.now })
    case 'play':
      return play(s, action.player, action.table)
    case 'draw':
      return draw(s, action.player)
    case 'draft':
      return saveDraft(s, action.player, action.turnSeq, action.table)
    case 'drop':
      return drop(s, action.player)
  }
}

/**
 * 순위: 손패를 다 턴 사람(또는 남은 점수가 가장 적은 사람)부터 남은 점수 적은 순, 같으면 장수 적은 순.
 * 나간 사람은 맨 뒤
 */
export function rankingOf(s: { hands: TileId[][]; left: boolean[] }): number[] {
  const order = s.hands.map((_, i) => i)
  return order.sort(
    (a, b) =>
      Number(s.left[a]) - Number(s.left[b]) ||
      handValue(s.hands[a]) - handValue(s.hands[b]) ||
      s.hands[a].length - s.hands[b].length ||
      a - b,
  )
}
