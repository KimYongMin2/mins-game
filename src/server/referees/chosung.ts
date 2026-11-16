import { createEngine, engineReducer, type EngineAction, type EngineState } from '../../games/chosung/play/engine'
import { changeKey, viewFor } from '../../games/chosung/play/view'
import type { Referee, RefereeContext } from '../hub'
import { readPlayers, serverSeed } from './common'
import { hostEngineReferee } from './hostEngine'

// 초성 퀴즈 서버 심판: 문제·정답은 서버만, 맞혔는지·점수도 서버가. 화면은 사람마다(정답은 공개 때나 내가 맞힌 뒤에만)

export function chosungReferee(setup: unknown, ctx: RefereeContext): Referee | null {
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
      if (m.t !== 'guess') return undefined
      const player = s.players.findIndex((p) => p.id === from)
      return player >= 0 && typeof m.text === 'string' && m.text.length <= 60 ? { type: 'guess', player, text: m.text } : null
    },
    drop: (s, key) => {
      const player = s.players.findIndex((p) => p.id === key)
      return player >= 0 ? { type: 'drop', player } : null
    },
    done: (s) => s.phase.kind === 'done',
    nowOf: (s) => s.now,
  })
}
