import { createEngine, engineReducer, type EngineAction, type EngineState } from '../../games/artillery/play/engine'
import { toView, viewChanged } from '../../games/artillery/play/view'
import type { Referee, RefereeContext } from '../hub'
import { readPlayers, readTeams, serverSeed } from './common'
import { hostEngineReferee, humanIndex } from './hostEngine'
import { isNum } from './validate'

// 탱크 대전 서버 심판: 지형·바람·포탄 궤적·피해를 서버가 계산한다 (방장 폰이 피해를 바꿀 수 없게).

export function artilleryReferee(setup: unknown, ctx: RefereeContext): Referee | null {
  const o = (setup ?? {}) as Record<string, unknown>
  const players = readPlayers(o.players, ctx, 2, 4)
  if (!players) return null
  const teams = readTeams(o.teams, players.length)
  if (teams === undefined) return null
  return hostEngineReferee<EngineState, ReturnType<typeof toView>, EngineAction>(ctx, {
    state: createEngine({ now: ctx.now(), seed: serverSeed(), players, teams, friendlyFire: o.friendlyFire === true, level: 'normal' }),
    reduce: engineReducer,
    tick: (now) => ({ type: 'tick', now }),
    toView,
    changed: viewChanged,
    input: (s, from, m) => {
      if (m.t !== 'aim' && m.t !== 'fire') return undefined
      const player = humanIndex(s.players, from)
      if (player < 0 || m.turnNo !== s.turnNo || !isNum(m.x) || !isNum(m.angle) || !isNum(m.power)) return null
      return { type: m.t, player, x: m.x, angle: m.angle, power: m.power }
    },
    drop: (s, key) => {
      const player = humanIndex(s.players, key)
      return player >= 0 ? { type: 'drop', player } : null
    },
    done: (s) => s.phase.kind === 'done',
    nowOf: (s) => s.now,
  })
}
