import { createEngine, engineReducer, type EngineAction, type EngineState } from '../../games/wordchain/play/engine'
import { changeKey, toView } from '../../games/wordchain/play/view'
import { isNoun } from '../dict'
import type { Referee, RefereeContext } from '../hub'
import { readPlayers, serverSeed } from './common'
import { hostEngineReferee } from './hostEngine'

// 끝말잇기 서버 심판: 차례·규칙 검사·사전 확인(표준국어대사전 명사)·탈락을 서버가. 사전을 못 쓰면(키 없음·사전 서버 문제) 받아 줌.

export function wordchainReferee(setup: unknown, ctx: RefereeContext): Referee | null {
  const o = (setup ?? {}) as Record<string, unknown>
  const players = readPlayers(o.players, ctx, 2, 8)
  if (!players || players.some((p) => p.kind === 'bot')) return null
  return hostEngineReferee<EngineState, EngineState, EngineAction>(ctx, {
    state: createEngine({ now: ctx.now(), seed: serverSeed(), players }),
    reduce: engineReducer,
    tick: (now) => ({ type: 'tick', now }),
    toView: (s) => s,
    changed: (a, b) => !a || changeKey(a) !== changeKey(b),
    wrap: (s) => ({ t: 'view', v: toView(s) }),
    input: (s, from, m, later) => {
      if (m.t !== 'say') return undefined
      const player = s.players.findIndex((p) => p.id === from)
      if (player < 0 || typeof m.word !== 'string' || m.word.length > 40) return null
      const after = engineReducer(s, { type: 'try', player, word: m.word })
      // 검사를 통과해 '확인 중'이 되면 사전을 보고 나중에 결과를 넣는다
      if (after.phase.kind === 'turn' && after.phase.checking && !(s.phase.kind === 'turn' && s.phase.checking)) {
        const word = after.phase.checking
        void isNoun(word).then((ok) => later(ok === false ? { type: 'reject', word } : { type: 'accept', word }))
      }
      return { type: 'try', player, word: m.word }
    },
    drop: (s, key) => {
      const player = s.players.findIndex((p) => p.id === key)
      return player >= 0 ? { type: 'drop', player } : null
    },
    done: (s) => s.phase.kind === 'done',
    nowOf: (s) => s.now,
  })
}
