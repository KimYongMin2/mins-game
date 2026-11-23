import { createEngine, engineReducer, type EngineAction, type EngineState } from '../../games/spotdiff/play/engine'
import { changeKey, viewFor } from '../../games/spotdiff/play/view'
import type { Referee, RefereeContext } from '../hub'
import { readPlayers, serverSeed } from './common'
import { hostEngineReferee, isInt } from './hostEngine'

// 다른 그림 찾기 서버 심판: 그림 씨앗값·누른 곳 판정·걸린 시간을 서버가 (서버 시계로 잼).
// 화면은 사람마다(그림 씨앗값은 그 사람이 지금 푸는 문제 것만)

const isNum = (x: unknown): x is number => typeof x === 'number' && Number.isFinite(x)

export function spotdiffReferee(setup: unknown, ctx: RefereeContext): Referee | null {
  const o = (setup ?? {}) as Record<string, unknown>
  const players = readPlayers(o.players, ctx, 2, 8)
  if (!players || players.some((p) => p.kind === 'bot')) return null
  return hostEngineReferee<EngineState, EngineState, EngineAction>(ctx, {
    state: createEngine({ now: ctx.now(), seed: serverSeed(), players }),
    reduce: engineReducer,
    tick: (now) => ({ type: 'tick', now }),
    toView: (s) => s,
    changed: (a, b) => !a || changeKey(a) !== changeKey(b),
    viewFor: (_v, key, s) => viewFor(s, key) as unknown as EngineState,
    input: (s, from, m) => {
      if (m.t !== 'tap') return undefined
      const player = s.players.findIndex((p) => p.id === from)
      return player >= 0 && isInt(m.q) && isNum(m.x) && isNum(m.y) ? { type: 'tap', player, q: m.q, x: m.x, y: m.y } : null
    },
    drop: (s, key) => {
      const player = s.players.findIndex((p) => p.id === key)
      return player >= 0 ? { type: 'drop', player } : null
    },
    done: (s) => s.phase.kind === 'done',
    nowOf: (s) => s.now,
  })
}
