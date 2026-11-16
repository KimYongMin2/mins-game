import { createEngine, engineReducer, type EngineAction, type EngineState } from '../../games/bomb/play/engine'
import { toView, viewChanged } from '../../games/bomb/play/view'
import type { Referee, RefereeContext } from '../hub'
import { readPlayers, readTeams, serverSeed } from './common'
import { hostEngineReferee, humanIndex } from './hostEngine'

// 폭탄 돌리기 서버 심판: 터지는 시각은 서버만 안다. 던진 사람은 서버가 붙인 접속 번호로 (남이 대신 못 던짐).

export function bombReferee(setup: unknown, ctx: RefereeContext): Referee | null {
  const o = (setup ?? {}) as Record<string, unknown>
  const players = readPlayers(o.players, ctx, 2, 8)
  if (!players) return null
  const teams = readTeams(o.teams, players.length)
  if (teams === undefined) return null
  return hostEngineReferee<EngineState, ReturnType<typeof toView>, EngineAction>(ctx, {
    state: createEngine({ now: ctx.now(), seed: serverSeed(), players, teams }),
    reduce: engineReducer,
    tick: (now) => ({ type: 'tick', now }),
    toView,
    changed: viewChanged,
    input: (s, from, m) => {
      if (m.t !== 'pass') return undefined
      const who = humanIndex(s.players, from)
      const to = s.players.findIndex((p) => p.id === m.to)
      return who >= 0 && to >= 0 ? { type: 'pass', from: who, to } : null
    },
    drop: (s, key) => {
      const player = humanIndex(s.players, key)
      return player >= 0 ? { type: 'drop', player } : null
    },
    done: (s) => s.phase.kind === 'done',
    nowOf: (s) => s.now,
  })
}
