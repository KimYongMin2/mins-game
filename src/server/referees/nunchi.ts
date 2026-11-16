import { createEngine, engineReducer, type EngineAction, type EngineState } from '../../games/nunchi/play/engine'
import { toView, viewChanged } from '../../games/nunchi/play/view'
import type { Referee, RefereeContext } from '../hub'
import { readPlayers, readTeams, serverSeed } from './common'
import { hostEngineReferee, humanIndex } from './hostEngine'

// 눈치게임 서버 심판: 누른 순서(동시 판정)는 서버에 도착한 시각으로, 결승 가위바위보 손은 공개 전까지 서버만 안다.

const HANDS = ['rock', 'paper', 'scissors']

export function nunchiReferee(setup: unknown, ctx: RefereeContext): Referee | null {
  const o = (setup ?? {}) as Record<string, unknown>
  const players = readPlayers(o.players, ctx, 3, 6)
  if (!players) return null
  const teams = readTeams(o.teams, players.length)
  if (teams === undefined) return null
  return hostEngineReferee<EngineState, ReturnType<typeof toView>, EngineAction>(ctx, {
    state: createEngine({ now: ctx.now(), seed: serverSeed(), players, teams }),
    reduce: engineReducer,
    // 누른 순간을 서버 시각으로 (박자 사이에 와도 그때 시각)
    tick: (now) => ({ type: 'tick', now }),
    toView,
    changed: viewChanged,
    input: (s, from, m) => {
      if (m.t !== 'press' && m.t !== 'pick') return undefined
      const player = humanIndex(s.players, from)
      if (player < 0) return null
      if (m.t === 'press') return { type: 'press', player }
      return typeof m.hand === 'string' && HANDS.includes(m.hand) ? { type: 'pick', player, hand: m.hand as 'rock' } : null
    },
    drop: (s, key) => {
      const player = humanIndex(s.players, key)
      return player >= 0 ? { type: 'drop', player } : null
    },
    done: (s) => s.phase.kind === 'done',
    nowOf: (s) => s.now,
  })
}
