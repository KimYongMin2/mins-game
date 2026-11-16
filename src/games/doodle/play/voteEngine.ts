// '다 같이 그리기' 심판 (우리 게임 서버에서만): 판마다 모두 같은 제시어를 60초 동안 각자 그리고(남의 그림은 안 보임),
// 그림을 나란히(누가 그렸는지 숨기고) 보여 주면 자기 것 빼고 하나에 투표. 받은 표 1개당 점수, 3판 합계 1등이 우승.
// 그림 자체는 심판 밖(서버 심판 파일)에서 사람마다 모아 두고, 투표 단계에 섞은 순서로 보낸다.
import { type Rng, createRng } from '../../../shared/random'
import { DONE_MS, INTRO_MS, LOG_KEEP, VOTE_DRAW_MS, VOTE_PICK_MS, VOTE_POINTS, VOTE_RESULT_MS, VOTE_ROUNDS, VOTE_WORD_MS } from '../constants'
import { WORDS } from '../../../shared/words/koWords'
import type { Player } from './engine'

export type VotePhase =
  | { kind: 'intro'; until: number }
  | { kind: 'word'; word: string; until: number }
  | { kind: 'draw'; word: string; until: number }
  /** 그림 순서(사람 번호를 섞은 것)와 지금까지 투표 (사람 번호 → 고른 그림의 사람 번호) */
  | { kind: 'vote'; word: string; order: number[]; votes: (number | null)[]; until: number }
  | { kind: 'result'; word: string; order: number[]; votes: (number | null)[]; until: number }
  | { kind: 'done'; until: number }

export type VoteState = {
  now: number
  seed: number
  players: Player[]
  left: boolean[]
  scores: number[]
  round: number
  phase: VotePhase
  used: string[]
  /** 판마다 받은 표 (결과 화면) */
  history: { word: string; got: number[] }[]
  logSeq: number
}

export type VoteAction =
  | { type: 'tick'; now: number }
  | { type: 'vote'; player: number; target: number }
  | { type: 'drop'; player: number }

function shuffle<T>(rng: Rng, xs: readonly T[]): T[] {
  const a = [...xs]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng.next() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

export const activeOf = (s: VoteState) => s.players.flatMap((_, i) => (s.left[i] ? [] : [i]))

export function createVote(opts: { now: number; seed: number; players: Player[] }): VoteState {
  return {
    now: opts.now,
    seed: opts.seed,
    players: opts.players,
    left: opts.players.map(() => false),
    scores: opts.players.map(() => 0),
    round: 0,
    phase: { kind: 'intro', until: opts.now + INTRO_MS },
    used: [],
    history: [],
    logSeq: 0,
  }
}

function nextRound(s: VoteState): VoteState {
  if (s.round >= VOTE_ROUNDS || activeOf(s).length < 2) return { ...s, phase: { kind: 'done', until: s.now + DONE_MS } }
  const rng = createRng(s.seed)
  const pool = WORDS.filter((w) => !s.used.includes(w))
  const word = pool[Math.floor(rng.next() * pool.length)]
  return { ...s, seed: rng.seed(), round: s.round + 1, used: [...s.used, word], phase: { kind: 'word', word, until: s.now + VOTE_WORD_MS } }
}

function startVote(s: VoteState): VoteState {
  if (s.phase.kind !== 'draw') return s
  const rng = createRng(s.seed)
  const order = shuffle(rng, activeOf(s))
  return { ...s, seed: rng.seed(), phase: { kind: 'vote', word: s.phase.word, order, votes: s.players.map(() => null), until: s.now + VOTE_PICK_MS } }
}

function finishVote(s: VoteState): VoteState {
  if (s.phase.kind !== 'vote') return s
  const { word, order, votes } = s.phase
  const got = s.players.map((_, i) => votes.filter((v) => v === i).length)
  const scores = s.scores.map((v, i) => v + got[i] * VOTE_POINTS)
  return { ...s, scores, history: [...s.history, { word, got }].slice(-LOG_KEEP), phase: { kind: 'result', word, order, votes, until: s.now + VOTE_RESULT_MS } }
}

/** 표를 낼 수 있는 사람이 다 냈는지 */
function allVoted(s: VoteState): boolean {
  if (s.phase.kind !== 'vote') return false
  const { votes, order } = s.phase
  // 그림이 자기 것뿐인 사람(고를 게 없음)은 빼고
  return activeOf(s).every((i) => votes[i] !== null || order.every((o) => o === i))
}

function vote(s: VoteState, player: number, target: number): VoteState {
  const p = s.phase
  if (p.kind !== 'vote' || s.left[player] || player === target || !p.order.includes(target) || p.votes[player] !== null) return s
  const next = { ...s, phase: { ...p, votes: p.votes.map((v, i) => (i === player ? target : v)) } }
  return allVoted(next) ? finishVote(next) : next
}

function drop(s: VoteState, player: number): VoteState {
  if (s.left[player] || s.phase.kind === 'done') return s
  const next = { ...s, left: s.left.map((l, i) => l || i === player) }
  if (activeOf(next).length < 2) return { ...next, phase: { kind: 'done', until: s.now + DONE_MS } }
  return allVoted(next) ? finishVote(next) : next
}

function tick(s: VoteState): VoteState {
  const { phase, now } = s
  if (phase.kind === 'done' || now < phase.until) return s
  switch (phase.kind) {
    case 'intro':
      return nextRound(s)
    case 'word':
      return { ...s, phase: { kind: 'draw', word: phase.word, until: now + VOTE_DRAW_MS } }
    case 'draw':
      return startVote(s)
    case 'vote':
      return finishVote(s)
    case 'result':
      return nextRound(s)
  }
}

export function voteReducer(s: VoteState, a: VoteAction): VoteState {
  switch (a.type) {
    case 'tick':
      return tick({ ...s, now: a.now })
    case 'vote':
      return vote(s, a.player, a.target)
    case 'drop':
      return drop(s, a.player)
  }
}

export const voteRanks = (s: Pick<VoteState, 'scores'>) => s.scores.map((v) => 1 + s.scores.filter((o) => o > v).length)

/** 사람마다 화면: 투표 중엔 누가 그렸는지 숨기고(그림 번호만), 결과·끝에선 공개 */
export type VoteView = {
  players: { id: string; name: string }[]
  left: boolean[]
  scores: number[]
  round: number
  rounds: number
  phase: VotePhase['kind']
  leftMs: number
  word: string | null
  /** 투표·결과: 그림 순서 (그림 번호 k = order[k]의 그림). 투표 중엔 사람 번호 대신 내 것인지만 */
  gallery: { mine: boolean; owner: number | null; votes: number | null }[] | null
  /** 내가 고른 그림 번호 */
  myVote: number | null
  ranks: number[]
  history: VoteState['history']
}

export function voteViewFor(s: VoteState, viewerId: string): VoteView {
  const me = s.players.findIndex((p) => p.id === viewerId)
  const p = s.phase
  let gallery: VoteView['gallery'] = null
  let myVote: number | null = null
  if (p.kind === 'vote' || p.kind === 'result') {
    const reveal = p.kind === 'result'
    gallery = p.order.map((owner) => ({ mine: owner === me, owner: reveal ? owner : null, votes: reveal ? p.votes.filter((v) => v === owner).length : null }))
    const mv = p.votes[me]
    myVote = mv === null || mv === undefined ? null : p.order.indexOf(mv)
  }
  return {
    players: s.players.map(({ id, name }) => ({ id, name })),
    left: s.left,
    scores: s.scores,
    round: s.round,
    rounds: VOTE_ROUNDS,
    phase: p.kind,
    leftMs: Math.max(0, p.until - s.now),
    word: p.kind === 'intro' || p.kind === 'done' ? null : p.word,
    gallery,
    myVote,
    ranks: voteRanks(s),
    history: s.history,
  }
}

export function voteChangeKey(s: VoteState): string {
  const p = s.phase
  return [p.kind, s.round, s.left.join(), p.kind === 'vote' ? p.votes.join() : ''].join('|')
}
