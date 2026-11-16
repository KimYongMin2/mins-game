import { chosungOf } from '../../../shared/words/koWords'
import { type EngineState, type Guess, type LogEntry, canGuess, hintShown, ranksOf } from './engine'

// 사람마다 화면: 정답은 정답 공개 때(또는 내가 맞힌 뒤)에만. 힌트가 나오면 글자 하나를 보여 줌 ('ㄱ린').

export type ChosungView = {
  players: { id: string; name: string }[]
  left: boolean[]
  scores: number[]
  phase: EngineState['phase']['kind']
  leftMs: number
  q: number
  total: number
  /** 지금 문제 초성 (힌트가 나오면 그 자리만 글자) */
  clue: string | null
  group: string | null
  hint: boolean
  answer: string | null
  canGuess: boolean
  guessed: Guess[]
  log: LogEntry[]
  ranks: number[]
}

export function viewFor(s: EngineState, viewerId: string): ChosungView {
  const me = s.players.findIndex((p) => p.id === viewerId)
  const p = s.phase
  const cur = s.q >= 0 ? s.questions[s.q] : null
  const hint = hintShown(s)
  const iGot = (p.kind === 'ask' || p.kind === 'reveal') && p.guessed.some((g) => g.player === me)
  let clue: string | null = null
  if (cur && (p.kind === 'ask' || p.kind === 'reveal')) {
    const cho = [...chosungOf(cur.word)]
    const syl = [...cur.word]
    clue = cho.map((c, i) => (hint && i === cur.hintAt ? syl[i] : c)).join('')
  }
  return {
    players: s.players.map(({ id, name }) => ({ id, name })),
    left: s.left,
    scores: s.scores,
    phase: p.kind,
    leftMs: Math.max(0, p.until - s.now),
    q: Math.max(0, s.q),
    total: s.questions.length,
    clue,
    group: cur && (p.kind === 'ask' || p.kind === 'reveal') ? cur.group : null,
    hint,
    answer: cur && (p.kind === 'reveal' || iGot) ? cur.word : null,
    canGuess: canGuess(s, me),
    guessed: p.kind === 'ask' || p.kind === 'reveal' ? p.guessed : [],
    log: s.log.slice(-15),
    ranks: ranksOf(s),
  }
}

export function changeKey(s: EngineState): string {
  const p = s.phase
  return [p.kind, s.q, s.logSeq, s.left.join(), hintShown(s)].join('|')
}
