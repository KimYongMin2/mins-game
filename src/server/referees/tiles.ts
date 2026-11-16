import { createEngine, engineReducer, type EngineAction, type EngineState } from '../../games/tiles/play/engine'
import { toView, viewChanged, type TilesView } from '../../games/tiles/play/view'
import type { Referee, RefereeContext } from '../hub'
import { readPlayers, readTeams, serverSeed } from './common'
import { hostEngineReferee, humanIndex } from './hostEngine'
import { isInt, isTable } from './validate'

// 숫자 잇기 서버 심판: 더미 순서는 서버만, 손패는 각자 자기 것만 받는다 (예전엔 화면 상태에 모든 손패가 들어 있었음).
// 남의 손패는 장수만 알 수 있게 같은 수의 -1로, 끝나면(점수 비교) 다 공개. 가져온 타일도 가져온 사람만.

const hideFor = (v: TilesView, key: string): TilesView => {
  if (v.phase === 'done') return v
  const me = v.players.findIndex((p) => p.id === key)
  return {
    ...v,
    hands: v.hands.map((h, i) => (i === me ? h : h.map(() => -1))),
    last: v.last && v.last.drawn !== undefined && v.last.player !== me ? { ...v.last, drawn: undefined } : v.last,
  }
}

export function tilesReferee(setup: unknown, ctx: RefereeContext): Referee | null {
  const o = (setup ?? {}) as Record<string, unknown>
  const players = readPlayers(o.players, ctx, 2, 4)
  if (!players) return null
  const teams = readTeams(o.teams, players.length)
  if (teams === undefined) return null
  return hostEngineReferee<EngineState, TilesView, EngineAction>(ctx, {
    state: createEngine({ now: ctx.now(), seed: serverSeed(), players, teams }),
    reduce: engineReducer,
    tick: (now) => ({ type: 'tick', now }),
    toView,
    changed: viewChanged,
    viewFor: hideFor,
    input: (s, from, m) => {
      if (m.t !== 'play' && m.t !== 'draw' && m.t !== 'draft') return undefined
      const player = humanIndex(s.players, from)
      if (player < 0) return null
      if (m.t === 'draw') return { type: 'draw', player }
      if (!isTable(m.table)) return null
      if (m.t === 'play') return { type: 'play', player, table: m.table }
      return isInt(m.turnSeq, 0) ? { type: 'draft', player, turnSeq: m.turnSeq, table: m.table } : null
    },
    drop: (s, key) => {
      const player = humanIndex(s.players, key)
      return player >= 0 ? { type: 'drop', player } : null
    },
    done: (s) => s.phase.kind === 'done',
    nowOf: (s) => s.now,
  })
}
