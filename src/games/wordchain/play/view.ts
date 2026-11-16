import { type EngineState, type Link, type LogEntry, ranksOf, startsOf } from './engine'

// 화면 (모두 같음 — 숨길 비밀이 없음). 시간은 남은 ms로
export type WordchainView = {
  players: { id: string; name: string }[]
  left: boolean[]
  out: number[]
  phase: EngineState['phase']['kind']
  leftMs: number
  turn: number | null
  checking: string | null
  /** 최근 낱말들 */
  chain: Link[]
  count: number
  starts: string[]
  log: LogEntry[]
  ranks: number[]
}

export function toView(s: EngineState): WordchainView {
  const p = s.phase
  return {
    players: s.players.map(({ id, name }) => ({ id, name })),
    left: s.left,
    out: s.out,
    phase: p.kind,
    leftMs: Math.max(0, p.until - s.now),
    turn: p.kind === 'turn' ? p.player : null,
    checking: p.kind === 'turn' ? p.checking : null,
    chain: s.chain.slice(-12),
    count: s.chain.length - 1,
    starts: startsOf(s),
    log: s.log.slice(-6),
    ranks: ranksOf(s),
  }
}

export function changeKey(s: EngineState): string {
  const p = s.phase
  return [p.kind, s.chain.length, s.logSeq, s.out.join(), s.left.join(), p.kind === 'turn' ? `${p.player}.${p.checking}` : ''].join('|')
}
