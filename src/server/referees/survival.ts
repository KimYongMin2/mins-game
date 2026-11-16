import { createEngine, engineReducer, type EngineAction, type EngineState } from '../../games/survival/play/engine'
import { toView, viewChanged } from '../../games/survival/play/view'
import type { Referee, RefereeContext } from '../hub'
import { readPlayers, readTeams, serverSeed } from './common'
import { hostEngineReferee, humanIndex } from './hostEngine'
import { isNum, isVec } from './validate'

// 서바이벌 서버 심판: 고르는 동안 남의 자리·방향은 서버만 안다 (공개 때 보냄). 벽·판정도 서버가.

export function survivalReferee(setup: unknown, ctx: RefereeContext): Referee | null {
  const o = (setup ?? {}) as Record<string, unknown>
  const players = readPlayers(o.players, ctx, 2, 8)
  if (!players) return null
  const teams = readTeams(o.teams, players.length)
  if (teams === undefined) return null
  return hostEngineReferee<EngineState, ReturnType<typeof toView>, EngineAction>(ctx, {
    state: createEngine({ now: ctx.now(), seed: serverSeed(), players, teams, friendlyFire: o.friendlyFire === true }),
    reduce: engineReducer,
    tick: (now) => ({ type: 'tick', now }),
    toView,
    changed: viewChanged,
    input: (s, from, m) => {
      if (m.t !== 'plan') return undefined
      const player = humanIndex(s.players, from)
      const p = m.plan as Record<string, unknown> | undefined
      if (player < 0 || m.round !== s.round || !p || typeof p !== 'object') return null
      if ((p.pos !== null && !isVec(p.pos)) || (p.angle !== null && !isNum(p.angle)) || typeof p.locked !== 'boolean') return null
      return { type: 'plan', player, plan: { pos: p.pos as { x: number; y: number } | null, angle: p.angle as number | null, locked: p.locked } }
    },
    drop: (s, key) => {
      const player = humanIndex(s.players, key)
      return player >= 0 ? { type: 'drop', player } : null
    },
    done: (s) => s.phase.kind === 'done',
    nowOf: (s) => s.now,
  })
}
