// 끝말잇기 심판 (우리 게임 서버에서만 — 사전 확인을 서버가). 순수 리듀서.
// 돌아가며 앞 단어 끝 글자(두음법칙 인정)로 시작하는 두 글자 이상 명사를 낸다. 이미 나온 단어는 안 됨.
// 틀리면 시간 안에 다시 낼 수 있고, 10초가 지나면 탈락. 마지막에 남은 사람이 우승.
// 사전 확인은 비동기라: try(검사 통과하면 '확인 중') → 서버가 사전을 보고 accept / reject.
import { createRng } from '../../../shared/random'
import { WORDS, initialVariants, isSyllable } from '../../../shared/words/koWords'
import { DONE_MS, INTRO_MS, LOG_KEEP, TURN_MS, WORD_MAX, WORD_MIN } from '../constants'

export type Player = { id: string; name: string }
export type Link = { word: string; player: number | null }
export type LogEntry = { seq: number; kind: 'bad' | 'out' | 'system'; player: number | null; text: string }

export type Phase =
  | { kind: 'intro'; until: number }
  /** checking = 사전 확인 중인 단어 (그동안 시간은 안 끝남) */
  | { kind: 'turn'; player: number; until: number; checking: string | null }
  | { kind: 'done'; until: number }

export type EngineState = {
  now: number
  seed: number
  players: Player[]
  left: boolean[]
  /** 탈락(나감 포함)한 순서 */
  out: number[]
  /** 이은 단어 (첫 단어는 서버가 정함) */
  chain: Link[]
  phase: Phase
  log: LogEntry[]
  logSeq: number
}

export type EngineAction =
  | { type: 'tick'; now: number }
  /** 단어 내기 (형식·규칙 검사 → 통과하면 확인 중) */
  | { type: 'try'; player: number; word: string }
  /** 서버: 사전에 있음 */
  | { type: 'accept'; word: string }
  /** 서버: 사전에 없음 */
  | { type: 'reject'; word: string }
  | { type: 'drop'; player: number }

function addLog(s: EngineState, kind: LogEntry['kind'], player: number | null, text: string): EngineState {
  const seq = s.logSeq + 1
  return { ...s, logSeq: seq, log: [...s.log, { seq, kind, player, text }].slice(-LOG_KEEP) }
}

export const alive = (s: EngineState) => s.players.flatMap((_, i) => (s.left[i] || s.out.includes(i) ? [] : [i]))

export function createEngine(opts: { now: number; seed: number; players: Player[] }): EngineState {
  const rng = createRng(opts.seed)
  // 첫 낱말: 이어 갈 낱말이 많은 글자로 끝나는 것만 (처음에 '펭귄'이 나와 '귄'으로 시작할 말이 없었음)
  const starters = WORDS.filter((w) => {
    if ([...w].length < 2 || [...w].length > 3) return false
    const heads = initialVariants([...w].at(-1)!)
    return WORDS.filter((x) => x !== w && heads.includes([...x][0])).length >= 2
  })
  const first = starters[Math.floor(rng.next() * starters.length)]
  // 순서는 자리 섞어서 (첫 사람 무작위)
  const order = opts.players.map((_, i) => i)
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(rng.next() * (i + 1))
    ;[order[i], order[j]] = [order[j], order[i]]
  }
  return {
    now: opts.now,
    seed: rng.seed(),
    players: order.map((i) => opts.players[i]),
    left: opts.players.map(() => false),
    out: [],
    chain: [{ word: first, player: null }],
    phase: { kind: 'intro', until: opts.now + INTRO_MS },
    log: [],
    logSeq: 0,
  }
}

/** 지금 단어가 시작해야 하는 글자들 (두음법칙 포함) */
export function startsOf(s: EngineState): string[] {
  const last = s.chain.at(-1)!.word
  return initialVariants([...last].at(-1)!)
}

/** from 다음 살아 있는 사람 (자리 순서) */
function nextAlive(s: EngineState, from: number): number | null {
  const n = s.players.length
  for (let k = 1; k <= n; k++) {
    const i = (from + k) % n
    if (!s.left[i] && !s.out.includes(i)) return i
  }
  return null
}

function turnOf(s: EngineState, player: number): EngineState {
  return { ...s, phase: { kind: 'turn', player, until: s.now + TURN_MS, checking: null } }
}

function finishIfLast(s: EngineState): EngineState | null {
  if (alive(s).length > 1) return null
  return { ...s, phase: { kind: 'done', until: s.now + DONE_MS } }
}

/** 형식·규칙 검사. 틀리면 이유 */
export function checkWord(s: EngineState, word: string): string | null {
  const w = word.replace(/\s+/g, '')
  const chars = [...w]
  if (chars.length < WORD_MIN) return '두 글자 이상만 돼요'
  if (chars.length > WORD_MAX) return '너무 길어요'
  if (!chars.every(isSyllable)) return '한글 낱말만 돼요'
  if (!startsOf(s).includes(chars[0])) return `'${startsOf(s).join("' 또는 '")}'(으)로 시작해야 해요`
  if (s.chain.some((l) => l.word === w)) return '이미 나온 낱말이에요'
  return null
}

function tryWord(s: EngineState, player: number, word: string): EngineState {
  const p = s.phase
  if (p.kind !== 'turn' || p.player !== player || p.checking) return s
  const w = word.replace(/\s+/g, '').slice(0, 20)
  const bad = checkWord(s, w)
  if (bad) return addLog(s, 'bad', player, `${w} — ${bad}`)
  return { ...s, phase: { ...p, checking: w } }
}

function accept(s: EngineState, word: string): EngineState {
  const p = s.phase
  if (p.kind !== 'turn' || p.checking !== word) return s
  const next = { ...s, chain: [...s.chain, { word, player: p.player }] }
  const to = nextAlive(next, p.player)
  return to === null ? { ...next, phase: { kind: 'done', until: s.now + DONE_MS } } : turnOf(next, to)
}

function reject(s: EngineState, word: string): EngineState {
  const p = s.phase
  if (p.kind !== 'turn' || p.checking !== word) return s
  return addLog({ ...s, phase: { ...p, checking: null } }, 'bad', p.player, `${word} — 사전에 없어요`)
}

function eliminate(s: EngineState, player: number, why: string): EngineState {
  const next = addLog({ ...s, out: [...s.out, player] }, 'out', player, `${s.players[player].name} 탈락 (${why})`)
  const end = finishIfLast(next)
  if (end) return end
  const p = s.phase
  if (p.kind === 'turn' && p.player === player) {
    const to = nextAlive(next, player)
    return to === null ? { ...next, phase: { kind: 'done', until: s.now + DONE_MS } } : turnOf(next, to)
  }
  return next
}

function tick(s: EngineState): EngineState {
  const { phase, now } = s
  if (phase.kind === 'intro') return now >= phase.until ? turnOf(s, 0) : s
  if (phase.kind === 'turn' && !phase.checking && now >= phase.until) return eliminate(s, phase.player, '시간 초과')
  return s
}

export function engineReducer(s: EngineState, a: EngineAction): EngineState {
  switch (a.type) {
    case 'tick':
      return tick({ ...s, now: a.now })
    case 'try':
      return tryWord(s, a.player, a.word)
    case 'accept':
      return accept(s, a.word)
    case 'reject':
      return reject(s, a.word)
    case 'drop': {
      if (s.left[a.player] || s.phase.kind === 'done') return s
      const marked = { ...s, left: s.left.map((l, i) => l || i === a.player) }
      return s.out.includes(a.player) ? marked : eliminate(marked, a.player, '나감')
    }
  }
}

/** 순위: 남은 사람 1등, 늦게 탈락할수록 위 */
export function ranksOf(s: EngineState): number[] {
  const n = s.players.length
  return s.players.map((_, i) => {
    const k = s.out.indexOf(i)
    return k < 0 ? 1 : n - k
  })
}
