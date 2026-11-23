import { ASK_MS } from '../constants'
import { type EngineState, type QResult, doneMs, liveMs, ranksOf } from './engine'

// 사람마다 화면: 그림 씨앗값은 내가 지금 푸는 문제 것만 (남의 앞 문제 그림을 미리 못 보게)

export type SpotView = {
  phase: EngineState['phase']['kind']
  /** 시작 전 남은 시간 */
  introLeftMs: number
  players: { id: string; name: string }[]
  left: boolean[]
  rows: { q: number; found: number; doneMs: number; done: boolean; score: number }[]
  ranks: number[]
  total: number
  me: number
  my: {
    q: number
    seed: number
    found: number[]
    qLeftMs: number
    lockLeftMs: number
    pauseLeftMs: number
    results: QResult[]
    score: number
    liveMs: number
    done: boolean
  } | null
}

export function viewFor(s: EngineState, viewerId: string): SpotView {
  const me = s.players.findIndex((p) => p.id === viewerId)
  const r = me >= 0 ? s.runs[me] : null
  const playing = s.phase.kind === 'play'
  return {
    phase: s.phase.kind,
    introLeftMs: s.phase.kind === 'intro' ? Math.max(0, s.phase.until - s.now) : 0,
    players: s.players.map(({ id, name }) => ({ id, name })),
    left: s.left,
    rows: s.runs.map((x) => ({ q: x.q, found: x.found.length, doneMs: doneMs(x), done: x.done, score: x.score })),
    ranks: ranksOf(s),
    total: s.seeds.length,
    me,
    my:
      r && s.phase.kind !== 'intro'
        ? {
            q: r.q,
            seed: s.seeds[r.q],
            found: r.found,
            qLeftMs: playing && r.pauseUntil === null && !r.done ? Math.max(0, ASK_MS - (s.now - r.start)) : 0,
            lockLeftMs: Math.max(0, r.lockUntil - s.now),
            pauseLeftMs: r.pauseUntil === null ? 0 : Math.max(0, r.pauseUntil - s.now),
            results: r.results,
            score: r.score,
            liveMs: liveMs(s, me),
            done: r.done,
          }
        : null,
  }
}

export function changeKey(s: EngineState): string {
  return [s.phase.kind, s.left.join(), ...s.runs.map((r) => [r.q, r.found.length, r.done ? 1 : 0, r.pauseUntil === null ? 0 : 1, r.lockUntil > s.now ? 1 : 0].join('.'))].join('|')
}
