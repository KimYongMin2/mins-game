import { createEngine, engineReducer, type EngineAction, type EngineState } from '../../games/yut/play/engine'
import { toView, viewChanged } from '../../games/yut/play/view'
import type { Referee, RefereeContext } from '../hub'
import { readPlayers, readTeams, serverSeed } from './common'
import { hostEngineReferee, humanIndex } from './hostEngine'
import { isInt } from './validate'

// 윷놀이 서버 심판: 윷 던지기 결과(난수)를 서버가 정한다 — 방장 폰이 결과를 고를 수 없게.

export function yutReferee(setup: unknown, ctx: RefereeContext): Referee | null {
  const o = (setup ?? {}) as Record<string, unknown>
  const players = readPlayers(o.players, ctx, 2, 4)
  if (!players) return null
  const teams = readTeams(o.teams, players.length)
  if (teams === undefined || !isInt(o.pieceCount, 2, 4)) return null
  return hostEngineReferee<EngineState, ReturnType<typeof toView>, EngineAction>(ctx, {
    state: createEngine({ now: ctx.now(), seed: serverSeed(), players, teams, pieceCount: o.pieceCount }),
    reduce: engineReducer,
    tick: (now) => ({ type: 'tick', now }),
    toView,
    changed: viewChanged,
    input: (s, from, m) => {
      if (m.t !== 'throw' && m.t !== 'move') return undefined
      const player = humanIndex(s.players, from)
      if (player < 0) return null
      if (m.t === 'throw') return { type: 'throw', player }
      const piece = m.piece === 'home' ? 'home' : isInt(m.piece, 0, 100) ? m.piece : null
      return piece !== null && isInt(m.throwIdx, 0, 30) ? { type: 'move', player, throwIdx: m.throwIdx, from: piece } : null
    },
    drop: (s, key) => {
      const player = humanIndex(s.players, key)
      return player >= 0 ? { type: 'drop', player } : null
    },
    done: (s) => s.phase.kind === 'done',
    nowOf: (s) => s.now,
  })
}
