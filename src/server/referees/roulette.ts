import { createEngine, engineReducer, type EngineAction, type EngineState } from '../../games/roulette/play/engine'
import { toView, viewChanged } from '../../games/roulette/play/view'
import type { Referee, RefereeContext } from '../hub'
import { readPlayers, readTeams, serverSeed } from './common'
import { hostEngineReferee, humanIndex, isInt } from './hostEngine'

// 러시안룰렛 서버 심판 (조작 막기 3단계): 총알 칸은 서버만 안다. 방장 폰도 화면만 받는다.
// 차례인 사람이 고른 사람·방아쇠는 서버가 붙인 접속 번호로 누구인지 정한다 (남의 차례에 못 쏨).

export function rouletteReferee(setup: unknown, ctx: RefereeContext): Referee | null {
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
      if (m.t !== 'aim' && m.t !== 'pull') return undefined
      const player = humanIndex(s.players, from)
      if (player < 0 || !isInt(m.target)) return null
      return m.t === 'aim' ? { type: 'aim', player, target: m.target } : { type: 'pull', player, target: m.target }
    },
    drop: (s, key) => {
      const player = humanIndex(s.players, key)
      return player >= 0 ? { type: 'drop', player } : null
    },
    done: (s) => s.phase.kind === 'done',
    nowOf: (s) => s.now,
  })
}
