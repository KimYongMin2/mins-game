import { createMatch, matchReducer, type MatchState } from '../../games/memory/play/matchState'
import type { Referee, RefereeContext } from '../hub'
import { serverSeed } from './common'

// 짝맞추기 서버 심판 (조작 막기 3단계): 카드 배치는 서버만 안다. 뒤집을 때마다 그 카드 그림만 둘에게 알려 준다.
// 예전엔 두 폰이 같은 시드로 덱을 만들어서 배치를 미리 알 수 있었음. 차례·시간 초과(무작위로 열기)도 서버가.
// 서버 안에서 방장 = 0번, 친구 = 1번 (둘 다 'user'로 두고 서버가 차례인 사람의 누르기만 넣는다).

export function memoryReferee(setup: unknown, ctx: RefereeContext): Referee | null {
  const o = (setup ?? {}) as Record<string, unknown>
  const members = ctx.members()
  const host = members.find((m) => m.role === 'host')
  const guest = members.find((m) => m.role === 'guest')
  if (!host || !guest || typeof o.guestFirst !== 'boolean') return null
  let s: MatchState = createMatch({ now: ctx.now(), seed: serverSeed(), difficulty: 'normal', controllers: ['user', 'user'], deckSeed: serverSeed(), first: o.guestFirst ? 1 : 0 })
  let sent = 0
  let doneAt: number | null = null
  const flush = () => {
    for (; sent < s.flips.length; sent++) {
      const { index } = s.flips[sent]
      ctx.broadcast({ t: 'flip', n: sent, index, face: s.cards[index].face })
    }
    if (doneAt === null && s.phase.kind === 'done') doneAt = s.now
  }
  return {
    input(from, msg) {
      const m = (msg ?? {}) as Record<string, unknown>
      if (m.t !== 'flip') return false
      const side = from === host.id ? 0 : from === guest.id ? 1 : null
      if (side === null || m.n !== s.flips.length || typeof m.index !== 'number') return true
      s = matchReducer(s, { type: 'tick', now: ctx.now() })
      // 보여주기가 아직 안 끝났으면(폰보다 몇 ms 늦음) 끝까지 넘긴다
      for (let k = 0; k < 3 && (s.phase.kind === 'intro' || s.phase.kind === 'showing'); k++) s = matchReducer(s, { type: 'tick', now: s.phase.until })
      if (s.phase.kind === 'picking' && s.turn === side) s = matchReducer(s, { type: 'pick', index: m.index })
      flush()
      return true
    },
    tick(now) {
      s = matchReducer(s, { type: 'tick', now: Math.max(now, s.now) })
      flush()
    },
    leave() {},
    finished: () => doneAt !== null && s.now - doneAt > 5000,
  }
}
