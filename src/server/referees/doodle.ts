import { createEngine, engineReducer, type EngineAction, type EngineState } from '../../games/doodle/play/engine'
import { type InkOp, applyOps, readOps, tooBig, type Stroke } from '../../games/doodle/play/ink'
import { changeKey, viewFor } from '../../games/doodle/play/view'
import type { Referee, RefereeContext } from '../hub'
import { readPlayers, serverSeed } from './common'
import { hostEngineReferee } from './hostEngine'
import { isInt } from './validate'

// 그림 맞히기 서버 심판: 제시어는 서버와 그리는 사람만, 정답 판정·점수·보기도 서버가.
// 그림은 그리는 사람이 보낸 것만 모두에게 넘기고(다른 사람이 낙서를 끼워 넣지 못하게), 그 판 그림을 기억해 inkSync에 답한다.

export function doodleReferee(setup: unknown, ctx: RefereeContext): Referee | null {
  const o = (setup ?? {}) as Record<string, unknown>
  const players = readPlayers(o.players, ctx, 2, 8)
  // 봇 없는 게임
  if (!players || players.some((p) => p.kind === 'bot')) return null
  let strokes: Stroke[] = []
  let inkTurn = -1
  /** 그림 묶음을 그대로 기억 (다시 보낼 때 그대로) */
  let history: InkOp[] = []
  const drawerKey = (s: EngineState) => (s.phase.kind === 'draw' ? s.players[s.phase.drawer].id : null)
  return hostEngineReferee<EngineState, EngineState, EngineAction>(ctx, {
    state: createEngine({ now: ctx.now(), seed: serverSeed(), players }),
    reduce: engineReducer,
    tick: (now) => ({ type: 'tick', now }),
    toView: (s) => s,
    changed: (a, b) => !a || changeKey(a) !== changeKey(b),
    viewFor: (_v, key, s) => viewFor(s, key) as unknown as EngineState,
    input: (s, from, m) => {
      if (inkTurn !== s.turnNo) {
        inkTurn = s.turnNo
        strokes = []
        history = []
      }
      if (m.t === 'ink') {
        const ops = readOps(m.ops)
        // 그리는 사람이 이번 차례에 보낸 것만 넘긴다 (undefined = 그대로 전달)
        if (from !== drawerKey(s) || m.turn !== s.turnNo || !ops) return null
        const next = applyOps(strokes, ops)
        if (tooBig(next)) return null
        strokes = next
        history = ops.some((x) => x.op === 'x') ? ops.slice(ops.map((x) => x.op).lastIndexOf('x')) : [...history, ...ops]
        return undefined
      }
      if (m.t === 'inkSync') {
        ctx.sendTo(from, { t: 'inkAll', turn: s.turnNo, ops: history })
        return null
      }
      if (m.t !== 'choose' && m.t !== 'guess' && m.t !== 'pick') return undefined
      const player = s.players.findIndex((p) => p.id === from)
      if (player < 0) return null
      if (m.t === 'guess') return typeof m.text === 'string' && m.text.length <= 100 ? { type: 'guess', player, text: m.text } : null
      return isInt(m.index, 0, 3) ? { type: m.t, player, index: m.index } : null
    },
    drop: (s, key) => {
      const player = s.players.findIndex((p) => p.id === key)
      return player >= 0 ? { type: 'drop', player } : null
    },
    done: (s) => s.phase.kind === 'done',
    nowOf: (s) => s.now,
  })
}
