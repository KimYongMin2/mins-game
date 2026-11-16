import { createMatch, matchReducer, type MatchState } from '../../games/fight/play/matchState'
import { STANCES, type Stance } from '../../games/fight/rules/turn'
import type { Referee, RefereeContext } from '../hub'
import { serverSeed } from './common'

// 격투 서버 심판 (조작 막기 3단계): 둘 다 고른 자세를 서버에만 보내고, 서버가 턴 시간을 재서 동시에 공개한다.
// 예전엔 방장 폰이 친구가 고른 걸 공개 전에 받아서 엿볼 수 있었음. 서버 안에서 방장 = 0번, 친구 = 1번.

export function fightReferee(_setup: unknown, ctx: RefereeContext): Referee | null {
  const members = ctx.members()
  const host = members.find((m) => m.role === 'host')
  const guest = members.find((m) => m.role === 'guest')
  if (!host || !guest) return null
  let s: MatchState = createMatch({ now: ctx.now(), seed: serverSeed(), difficulty: 'normal', controllers: ['remote', 'remote'] })
  let doneAt: number | null = null
  const flush = (prev: MatchState) => {
    if (s.turns.length > prev.turns.length) {
      const t = s.turns.at(-1)!
      ctx.broadcast({ t: 'reveal', turn: s.turns.length - 1, host: t.stances[0], guest: t.stances[1] })
    }
    const p = s.phase
    if (p.kind === 'choosing' && (prev.phase.kind !== 'choosing' || prev.phase.index !== p.index)) ctx.broadcast({ t: 'turn', turn: p.index })
    if (doneAt === null && p.kind === 'done') doneAt = s.now
  }
  return {
    input(from, msg) {
      const m = (msg ?? {}) as Record<string, unknown>
      if (m.t === 'turn' || m.t === 'reveal') return true // 폰이 보낸 턴·공개는 버림
      if (m.t !== 'pick') return false
      const side = from === host.id ? 0 : from === guest.id ? 1 : null
      if (side === null || typeof m.turn !== 'number' || !STANCES.includes(m.stance as Stance)) return true
      const prev = s
      s = matchReducer(s, { type: 'remotePick', side, turn: m.turn, stance: m.stance as Stance })
      flush(prev)
      return true
    },
    tick(now) {
      const prev = s
      s = matchReducer(s, { type: 'tick', now: Math.max(now, s.now) })
      flush(prev)
    },
    leave() {},
    finished: () => doneAt !== null && s.now - doneAt > 5000,
  }
}
