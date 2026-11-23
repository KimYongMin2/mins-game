// 다른 그림 찾기 심판 (순수 리듀서). 혼자 하기는 폰에서, 친구 대전은 우리 게임 서버에서 돈다.
// 모두 같은 그림 5장을 각자 푼다. 친구 대전 순위 = 총 걸린 시간 (사용자 요청 2026-11-23 — 문제마다 걸린 시간을 더하고,
// 60초 안에 못 찾으면 60초 + 못 찾은 곳 하나마다 10초). 혼자 하기는 점수(찾을 때 100점 + 다 찾으면 남은 초 × 10점).
import { createRng } from '../../../shared/random'
import { ASK_MS, BONUS_PER_SEC, CLEAR_PAUSE_MS, DONE_MS, FIND_POINTS, INTRO_MS, LOCK_MS, MISS_PENALTY_MS, QUESTIONS, REVEAL_MS } from '../constants'
import { H, W, hitDiff, makeScene, sceneOf } from './scene'

export type Player = { id: string; name: string }
/** 한 문제 결과. ms = 걸린 시간 (못 다 찾았으면 벌칙 포함) */
export type QResult = { found: number; ms: number; cleared: boolean }
export type Run = {
  q: number
  start: number
  found: number[]
  lockUntil: number
  /** 다 찾았거나 시간이 끝나 다음 문제를 기다리는 중 */
  pauseUntil: number | null
  results: QResult[]
  score: number
  misses: number
  done: boolean
}

export type EngineState = {
  now: number
  players: Player[]
  left: boolean[]
  seeds: number[]
  runs: Run[]
  phase: { kind: 'intro'; until: number } | { kind: 'play' } | { kind: 'done'; until: number }
}

export type EngineAction = { type: 'tick'; now: number } | { type: 'tap'; player: number; q: number; x: number; y: number } | { type: 'drop'; player: number }

/** 장면이 겹치지 않게 (바로 앞 문제와 같은 장면이면 다시 뽑음) */
export function pickSeeds(seed: number, n = QUESTIONS): number[] {
  const rng = createRng(seed)
  const out: number[] = []
  let prev = ''
  while (out.length < n) {
    let s = Math.floor(rng.next() * 2 ** 32)
    for (let k = 0; k < 10 && makeScene(s).theme === prev; k++) s = Math.floor(rng.next() * 2 ** 32)
    prev = makeScene(s).theme
    out.push(s)
  }
  return out
}

const newRun = (now: number): Run => ({ q: 0, start: now, found: [], lockUntil: 0, pauseUntil: null, results: [], score: 0, misses: 0, done: false })

export function createEngine(opts: { now: number; seed: number; players: Player[] }): EngineState {
  return {
    now: opts.now,
    players: opts.players,
    left: opts.players.map(() => false),
    seeds: pickSeeds(opts.seed),
    runs: opts.players.map(() => newRun(opts.now)),
    phase: { kind: 'intro', until: opts.now + INTRO_MS },
  }
}

/** 끝난 문제들 시간 합 */
export const doneMs = (r: Run) => r.results.reduce((a, x) => a + x.ms, 0)
/** 지금까지 걸린 시간 (푸는 중인 문제 포함) */
export function liveMs(s: EngineState, i: number): number {
  const r = s.runs[i]
  const running = s.phase.kind === 'play' && !r.done && r.pauseUntil === null
  return doneMs(r) + (running ? Math.min(ASK_MS, s.now - r.start) : 0)
}

const diffCount = (s: EngineState, q: number) => sceneOf(s.seeds[q]).diffs.length

function advance(s: EngineState, r: Run): Run {
  const now = s.now
  if (r.pauseUntil !== null) {
    if (now < r.pauseUntil) return r
    const q = r.q + 1
    if (q >= s.seeds.length) return { ...r, pauseUntil: null, done: true }
    return { ...r, q, start: now, found: [], lockUntil: 0, pauseUntil: null }
  }
  if (now - r.start < ASK_MS) return r
  const missed = diffCount(s, r.q) - r.found.length
  return { ...r, results: [...r.results, { found: r.found.length, ms: ASK_MS + missed * MISS_PENALTY_MS, cleared: false }], pauseUntil: now + REVEAL_MS }
}

const active = (s: EngineState) => s.players.flatMap((_, i) => (s.left[i] ? [] : [i]))

function settle(s: EngineState): EngineState {
  if (s.phase.kind !== 'play') return s
  const act = active(s)
  if (act.length === 0 || act.every((i) => s.runs[i].done)) return { ...s, phase: { kind: 'done', until: s.now + DONE_MS } }
  return s
}

function tick(s: EngineState): EngineState {
  if (s.phase.kind === 'intro') {
    if (s.now < s.phase.until) return s
    return { ...s, phase: { kind: 'play' }, runs: s.runs.map(() => newRun(s.now)) }
  }
  if (s.phase.kind !== 'play') return s
  return settle({ ...s, runs: s.runs.map((r, i) => (s.left[i] || r.done ? r : advance(s, r))) })
}

export function canTap(s: EngineState, player: number): boolean {
  const r = s.runs[player]
  return s.phase.kind === 'play' && !!r && !s.left[player] && !r.done && r.pauseUntil === null && s.now >= r.lockUntil
}

function tap(s: EngineState, a: Extract<EngineAction, { type: 'tap' }>): EngineState {
  const r = s.runs[a.player]
  if (!canTap(s, a.player) || a.q !== r.q || !(a.x >= 0 && a.x <= W && a.y >= 0 && a.y <= H)) return s
  const diffs = sceneOf(s.seeds[r.q]).diffs
  const i = hitDiff(diffs, r.found, a.x, a.y)
  let next: Run
  if (i < 0) next = { ...r, lockUntil: s.now + LOCK_MS, misses: r.misses + 1 }
  else {
    const found = [...r.found, i]
    next = { ...r, found, score: r.score + FIND_POINTS }
    if (found.length === diffs.length) {
      const ms = s.now - r.start
      next = {
        ...next,
        results: [...r.results, { found: found.length, ms, cleared: true }],
        score: next.score + Math.ceil((ASK_MS - ms) / 1000) * BONUS_PER_SEC,
        pauseUntil: s.now + CLEAR_PAUSE_MS,
      }
    }
  }
  return { ...s, runs: s.runs.map((x, k) => (k === a.player ? next : x)) }
}

function drop(s: EngineState, player: number): EngineState {
  if (s.left[player] || s.phase.kind === 'done') return s
  return settle({ ...s, left: s.left.map((l, i) => l || i === player) })
}

export function engineReducer(s: EngineState, a: EngineAction): EngineState {
  switch (a.type) {
    case 'tick':
      return tick({ ...s, now: a.now })
    case 'tap':
      return tap(s, a)
    case 'drop':
      return drop(s, a.player)
  }
}

/** 친구 대전 순위: 다 푼 사람끼리 총 시간이 짧은 순, 나간 사람은 뒤 (같은 시간은 같은 등수) */
export function ranksOf(s: EngineState): number[] {
  const key = (i: number) => (s.left[i] ? Infinity : s.runs[i].done ? doneMs(s.runs[i]) : Number.MAX_SAFE_INTEGER)
  return s.players.map((_, i) => 1 + s.players.filter((__, k) => key(k) < key(i)).length)
}
