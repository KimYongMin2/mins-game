// 초성 퀴즈 심판 (순수 리듀서). 혼자 하기는 폰에서, 친구 대전은 우리 게임 서버에서 돈다 (정답은 서버만).
// 한 판 10문제: 'ㄱㄹ (동물)'처럼 초성과 갈래가 나오고 채팅으로 먼저 맞히면 점수. 10초가 지나면 글자 하나 힌트(그 뒤 점수 절반).
import { type Rng, createRng } from '../../../shared/random'
import { WORD_GROUPS, normalizeGuess } from '../../../shared/words/koWords'
import { ASK_MS, CHAT_MAX, DONE_MS, HINT_MS, INTRO_MS, LOG_KEEP, POINTS, QUESTIONS, REVEAL_MS } from '../constants'

export type Player = { id: string; name: string }
export type Question = { word: string; group: string; /** 힌트로 보여줄 글자 자리 */ hintAt: number }
export type Guess = { player: number; points: number; hinted: boolean }
export type LogEntry = { seq: number; kind: 'chat' | 'correct' | 'system'; player: number | null; text: string }

export type Phase =
  | { kind: 'intro'; until: number }
  | { kind: 'ask'; start: number; until: number; guessed: Guess[] }
  | { kind: 'reveal'; until: number; guessed: Guess[] }
  | { kind: 'done'; until: number }

export type EngineState = {
  now: number
  seed: number
  players: Player[]
  left: boolean[]
  scores: number[]
  questions: Question[]
  /** 지금 문제 번호 (0부터) */
  q: number
  phase: Phase
  log: LogEntry[]
  logSeq: number
}

export type EngineAction = { type: 'tick'; now: number } | { type: 'guess'; player: number; text: string } | { type: 'drop'; player: number }

function shuffle<T>(rng: Rng, xs: readonly T[]): T[] {
  const a = [...xs]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng.next() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

/** 문제: 갈래를 골고루 섞어서, 두 글자 이상 */
export function pickQuestions(rng: Rng, n = QUESTIONS): Question[] {
  const all = Object.entries(WORD_GROUPS).flatMap(([group, ws]) => ws.filter((w) => [...w].length >= 2).map((word) => ({ word, group })))
  return shuffle(rng, all)
    .slice(0, n)
    .map((x) => ({ ...x, hintAt: Math.floor(rng.next() * [...x.word].length) }))
}

function addLog(s: EngineState, kind: LogEntry['kind'], player: number | null, text: string): EngineState {
  const seq = s.logSeq + 1
  return { ...s, logSeq: seq, log: [...s.log, { seq, kind, player, text }].slice(-LOG_KEEP) }
}

export const activePlayers = (s: EngineState) => s.players.flatMap((_, i) => (s.left[i] ? [] : [i]))

export function createEngine(opts: { now: number; seed: number; players: Player[] }): EngineState {
  const rng = createRng(opts.seed)
  return {
    now: opts.now,
    seed: rng.seed(),
    players: opts.players,
    left: opts.players.map(() => false),
    scores: opts.players.map(() => 0),
    questions: pickQuestions(rng),
    q: -1,
    phase: { kind: 'intro', until: opts.now + INTRO_MS },
    log: [],
    logSeq: 0,
  }
}

export const hintShown = (s: EngineState) => s.phase.kind === 'ask' && s.now >= s.phase.start + HINT_MS

function ask(s: EngineState): EngineState {
  const q = s.q + 1
  if (q >= s.questions.length || activePlayers(s).length === 0) return { ...s, phase: { kind: 'done', until: s.now + DONE_MS } }
  return { ...s, q, phase: { kind: 'ask', start: s.now, until: s.now + ASK_MS, guessed: [] } }
}

function reveal(s: EngineState): EngineState {
  if (s.phase.kind !== 'ask') return s
  return addLog({ ...s, phase: { kind: 'reveal', until: s.now + REVEAL_MS, guessed: s.phase.guessed } }, 'system', null, `정답: ${s.questions[s.q].word}`)
}

export function canGuess(s: EngineState, player: number): boolean {
  return s.phase.kind === 'ask' && !s.left[player] && !s.phase.guessed.some((g) => g.player === player)
}

function guess(s: EngineState, player: number, text: string): EngineState {
  const p = s.phase
  if (!canGuess(s, player) || p.kind !== 'ask') return s
  // eslint-disable-next-line no-control-regex -- 보이지 않는 제어 문자 지우기
  const clean = [...text.replace(/[\u0000-\u001f\u007f]/g, '').trim()].slice(0, CHAT_MAX).join('')
  if (!clean) return s
  if (normalizeGuess(clean) !== normalizeGuess(s.questions[s.q].word)) return addLog(s, 'chat', player, clean)
  const hinted = hintShown(s)
  const base = POINTS[p.guessed.length] ?? 1
  const points = hinted ? Math.ceil(base / 2) : base
  const guessed = [...p.guessed, { player, points, hinted }]
  let next = addLog({ ...s, scores: s.scores.map((v, i) => (i === player ? v + points : v)), phase: { ...p, guessed } }, 'correct', player, `${s.players[player].name}님 정답! +${points}`)
  if (activePlayers(next).every((i) => guessed.some((g) => g.player === i))) next = reveal(next)
  return next
}

function drop(s: EngineState, player: number): EngineState {
  if (s.left[player] || s.phase.kind === 'done') return s
  const next = addLog({ ...s, left: s.left.map((l, i) => l || i === player) }, 'system', null, `${s.players[player].name}님이 나갔어요`)
  if (activePlayers(next).length === 0) return { ...next, phase: { kind: 'done', until: s.now + DONE_MS } }
  const p = next.phase
  if (p.kind === 'ask' && activePlayers(next).every((i) => p.guessed.some((g) => g.player === i))) return reveal(next)
  return next
}

function tick(s: EngineState): EngineState {
  const { phase, now } = s
  if (phase.kind === 'done' || now < phase.until) return s
  if (phase.kind === 'ask') return reveal(s)
  return ask(s)
}

export function engineReducer(s: EngineState, a: EngineAction): EngineState {
  switch (a.type) {
    case 'tick':
      return tick({ ...s, now: a.now })
    case 'guess':
      return guess(s, a.player, a.text)
    case 'drop':
      return drop(s, a.player)
  }
}

export const ranksOf = (s: Pick<EngineState, 'scores'>) => s.scores.map((v) => 1 + s.scores.filter((o) => o > v).length)
