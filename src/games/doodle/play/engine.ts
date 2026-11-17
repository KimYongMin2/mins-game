// 그림 맞히기 심판. 우리 게임 서버(src/server/referees/doodle.ts)에서만 돈다 — 제시어는 서버와 그리는 사람만 안다.
// 시간(now)과 시드 난수를 상태에 담은 순수 리듀서.
// 흐름: 시작 안내 → (차례마다) 그릴 사람이 제시어 2개 중 고름 → 60초 그리기(처음 40초 채팅, 마지막 20초엔 못 맞힌 사람에게 보기 4개)
// → 정답 보여주기 → 다음 사람. 모두 그리면 총점 1등이 우승.
import { type Rng, createRng } from '../../../shared/random'
import {
  CHAT_MAX,
  DRAWS_EACH,
  CHOICE_RATE,
  CHOICES_AT_MS,
  CHOOSE_MS,
  DONE_MS,
  DRAW_MS,
  DRAWER_POINTS,
  GUESS_POINTS,
  INTRO_MS,
  LOG_KEEP,
  REVEAL_MS,
} from '../constants'
import { normalizeGuess } from '../../../shared/words/koWords'
import { DOODLE_GROUPS as WORD_GROUPS, DOODLE_WORDS as WORDS, doodleGroupOf as groupOf } from '../words'
import type { Look } from '../../../shared/art3d/animalKinds'

export type Player = { id: string; name: string; avatar?: Look }

export type Guess = { player: number; points: number; viaChoice: boolean }

/** 채팅 줄: chat = 틀린 답(모두에게 보임) · correct = 누가 맞힘 · system = 안내 */
/** secret = 그 차례(turnNo) 정답이 들어간 글 — 그리는 동안엔 그린 사람·맞힌 사람에게만 보임 (정답이 새지 않게) */
export type LogEntry = { seq: number; kind: 'chat' | 'correct' | 'system'; player: number | null; text: string; secret?: number }

export type Phase =
  | { kind: 'intro'; until: number }
  | { kind: 'choose'; drawer: number; options: [string, string]; until: number }
  | { kind: 'draw'; drawer: number; word: string; start: number; until: number; choices: string[]; guessed: Guess[]; choiceTried: number[] }
  | { kind: 'reveal'; drawer: number; word: string; until: number; guessed: Guess[] }
  | { kind: 'done'; until: number }

export type EngineState = {
  now: number
  seed: number
  players: Player[]
  /** 나간 사람 */
  left: boolean[]
  scores: number[]
  /** 그리는 순서 (사람 번호, 한 사람당 두 번 — 두 바퀴) */
  order: number[]
  /** 지금 몇 번째 차례 (order의 번호) */
  turnNo: number
  phase: Phase
  log: LogEntry[]
  logSeq: number
  /** 이번 경기에 나온 제시어 (다시 안 나오게) */
  used: string[]
}

export type EngineAction =
  | { type: 'tick'; now: number }
  /** 그릴 사람이 제시어 고름 (0 또는 1) */
  | { type: 'choose'; player: number; index: number }
  /** 채팅으로 맞히기 */
  | { type: 'guess'; player: number; text: string }
  /** 보기 고르기 (한 번만) */
  | { type: 'pick'; player: number; index: number }
  /** 나감 */
  | { type: 'drop'; player: number }

function shuffle<T>(rng: Rng, xs: readonly T[]): T[] {
  const a = [...xs]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng.next() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

function addLog(s: EngineState, kind: LogEntry['kind'], player: number | null, text: string, secret?: number): EngineState {
  const seq = s.logSeq + 1
  return { ...s, logSeq: seq, log: [...s.log, { seq, kind, player, text, ...(secret === undefined ? {} : { secret }) }].slice(-LOG_KEEP) }
}

export const activePlayers = (s: EngineState) => s.players.flatMap((_, i) => (s.left[i] ? [] : [i]))

export function createEngine(opts: { now: number; seed: number; players: Player[] }): EngineState {
  const rng = createRng(opts.seed)
  const base = shuffle(rng, opts.players.map((_, i) => i))
  // 한 사람당 두 번씩 그림 (사용자 요청 2026-11-17 — 처음엔 3명 이하일 때만 두 바퀴)
  const order = Array.from({ length: DRAWS_EACH }, () => base).flat()
  return {
    now: opts.now,
    seed: rng.seed(),
    players: opts.players,
    left: opts.players.map(() => false),
    scores: opts.players.map(() => 0),
    order,
    turnNo: -1,
    phase: { kind: 'intro', until: opts.now + INTRO_MS },
    log: [],
    logSeq: 0,
    used: [],
  }
}

/** 다음 차례로 (나간 사람 차례는 건너뜀). 더 없거나 남은 사람이 둘보다 적으면 끝 */
function nextTurn(s: EngineState): EngineState {
  if (activePlayers(s).length < 2) return finish(s)
  let turnNo = s.turnNo + 1
  while (turnNo < s.order.length && s.left[s.order[turnNo]]) turnNo++
  if (turnNo >= s.order.length) return finish(s)
  const rng = createRng(s.seed)
  const fresh = WORDS.filter((w) => !s.used.includes(w))
  const pool = shuffle(rng, fresh.length >= 2 ? fresh : WORDS)
  // 두 개는 서로 다른 갈래에서 (고르는 재미)
  const a = pool[0]
  const b = pool.find((w) => groupOf(w) !== groupOf(a)) ?? pool[1]
  const drawer = s.order[turnNo]
  return { ...s, seed: rng.seed(), turnNo, phase: { kind: 'choose', drawer, options: [a, b], until: s.now + CHOOSE_MS } }
}

/** 보기 4개: 정답 + 같은 갈래에서 3개 (모자라면 아무거나) */
function choicesFor(rng: Rng, word: string): string[] {
  const group = groupOf(word)
  const same = shuffle(rng, (group ? WORD_GROUPS[group] : WORDS).filter((w) => w !== word))
  const others = shuffle(rng, WORDS.filter((w) => w !== word && !same.includes(w)))
  return shuffle(rng, [word, ...[...same, ...others].slice(0, 3)])
}

function startDraw(s: EngineState, index: number): EngineState {
  if (s.phase.kind !== 'choose') return s
  const { drawer, options } = s.phase
  const word = options[index === 1 ? 1 : 0]
  const rng = createRng(s.seed)
  const choices = choicesFor(rng, word)
  return addLog(
    { ...s, seed: rng.seed(), used: [...s.used, word], phase: { kind: 'draw', drawer, word, start: s.now, until: s.now + DRAW_MS, choices, guessed: [], choiceTried: [] } },
    'system',
    drawer,
    `${s.players[drawer].name}님이 그려요`,
  )
}

function reveal(s: EngineState): EngineState {
  if (s.phase.kind !== 'draw') return s
  const { drawer, word, guessed } = s.phase
  return addLog({ ...s, phase: { kind: 'reveal', drawer, word, until: s.now + REVEAL_MS, guessed } }, 'system', null, `정답은 '${word}'`)
}

function finish(s: EngineState): EngineState {
  return { ...s, phase: { kind: 'done', until: s.now + DONE_MS } }
}

/** 보기가 보이는지 (마지막 20초) */
export const choicesOpen = (s: EngineState) => s.phase.kind === 'draw' && s.now >= s.phase.start + CHOICES_AT_MS

/** 맞힘: 순서대로 점수, 보기로 맞히면 절반. 그린 사람은 1명당 점수. 모두 맞히면 바로 정답 보여주기 */
function correct(s: EngineState, player: number, viaChoice: boolean): EngineState {
  const phase = s.phase
  if (phase.kind !== 'draw') return s
  const base = GUESS_POINTS[phase.guessed.length] ?? 1
  const points = viaChoice ? Math.ceil(base * CHOICE_RATE) : base
  const guessed = [...phase.guessed, { player, points, viaChoice }]
  const scores = s.scores.map((v, i) => (i === player ? v + points : i === phase.drawer ? v + DRAWER_POINTS : v))
  let next = addLog({ ...s, scores, phase: { ...phase, guessed } }, 'correct', player, `${s.players[player].name}님 정답!${viaChoice ? ' (보기)' : ''}`)
  const waiting = activePlayers(next).filter((i) => i !== phase.drawer && !guessed.some((g) => g.player === i))
  if (waiting.length === 0) next = reveal(next)
  return next
}

/** 맞힐 수 있는 사람인지 (그리는 중, 그린 사람 아님, 아직 못 맞힘, 안 나감) */
export function canGuess(s: EngineState, player: number): boolean {
  return s.phase.kind === 'draw' && player !== s.phase.drawer && !s.left[player] && !s.phase.guessed.some((g) => g.player === player)
}

/**
 * 채팅을 칠 수 있는지 (사용자 요청 2026-11-17 — 정답을 맞힌 뒤에도 채팅).
 * 고르는 중·그리는 중인 그린 사람만 못 침 (제시어를 아니까). 맞힌 사람 글도 모두에게 보이고, 정답이 들어간 글만 못 맞힌 사람에게 숨김
 */
export function canChat(s: EngineState, player: number): boolean {
  if (s.left[player]) return false
  const p = s.phase
  return !((p.kind === 'choose' || p.kind === 'draw') && p.drawer === player)
}

function guess(s: EngineState, player: number, text: string): EngineState {
  if (!canChat(s, player)) return s
  // eslint-disable-next-line no-control-regex -- 보이지 않는 제어 문자 지우기
  const clean = [...text.replace(/[\u0000-\u001f\u007f]/g, '').trim()].slice(0, CHAT_MAX).join('')
  if (!clean) return s
  if (canGuess(s, player) && s.phase.kind === 'draw') {
    if (normalizeGuess(clean) === normalizeGuess(s.phase.word)) return correct(s, player, false)
    return addLog(s, 'chat', player, clean)
  }
  // 이미 맞힌 사람의 채팅은 모두에게, 정답이 들어간 글만 못 맞힌 사람에겐 안 보임
  const leaks = s.phase.kind === 'draw' && normalizeGuess(clean).includes(normalizeGuess(s.phase.word))
  return addLog(s, 'chat', player, clean, leaks ? s.turnNo : undefined)
}

function pick(s: EngineState, player: number, index: number): EngineState {
  if (!canGuess(s, player) || s.phase.kind !== 'draw' || !choicesOpen(s) || s.phase.choiceTried.includes(player)) return s
  const chosen = s.phase.choices[index]
  if (chosen === undefined) return s
  if (chosen === s.phase.word) return correct(s, player, true)
  return { ...s, phase: { ...s.phase, choiceTried: [...s.phase.choiceTried, player] } }
}

function drop(s: EngineState, player: number): EngineState {
  if (s.left[player] || s.phase.kind === 'done') return s
  let next = addLog({ ...s, left: s.left.map((l, i) => l || i === player) }, 'system', null, `${s.players[player].name}님이 나갔어요`)
  if (activePlayers(next).length < 2) return finish(next)
  const p = next.phase
  // 그리던(고르던) 사람이 나가면 이번 차례는 끝
  if ((p.kind === 'choose' || p.kind === 'draw') && p.drawer === player) return p.kind === 'draw' ? reveal(next) : nextTurn(next)
  // 남은 사람이 다 맞혔으면 끝
  if (p.kind === 'draw') {
    const waiting = activePlayers(next).filter((i) => i !== p.drawer && !p.guessed.some((g) => g.player === i))
    if (waiting.length === 0) next = reveal(next)
  }
  return next
}

function tick(s: EngineState): EngineState {
  const { phase, now } = s
  switch (phase.kind) {
    case 'intro':
      return now >= phase.until ? nextTurn(s) : s
    case 'choose': {
      if (now < phase.until) return s
      const rng = createRng(s.seed)
      return startDraw({ ...s, seed: rng.seed() }, rng.next() < 0.5 ? 0 : 1)
    }
    case 'draw':
      return now >= phase.until ? reveal(s) : s
    case 'reveal':
      return now >= phase.until ? nextTurn(s) : s
    case 'done':
      return s
  }
}

export function engineReducer(s: EngineState, a: EngineAction): EngineState {
  switch (a.type) {
    case 'tick':
      return tick({ ...s, now: a.now })
    case 'choose':
      return s.phase.kind === 'choose' && s.phase.drawer === a.player ? startDraw(s, a.index) : s
    case 'guess':
      return guess(s, a.player, a.text)
    case 'pick':
      return pick(s, a.player, a.index)
    case 'drop':
      return drop(s, a.player)
  }
}

/** 순위 (점수 높은 순, 같으면 같은 등수) */
export function ranksOf(s: Pick<EngineState, 'scores'>): number[] {
  return s.scores.map((v) => 1 + s.scores.filter((o) => o > v).length)
}
