import { createEngine, engineReducer, type EngineAction, type EngineState } from '../../games/doodle/play/engine'
import { type InkOp, applyOps, readOps, tooBig, type Stroke } from '../../games/doodle/play/ink'
import { changeKey, viewFor } from '../../games/doodle/play/view'
import { createVote, voteChangeKey, voteReducer, voteViewFor, type VoteAction, type VoteState } from '../../games/doodle/play/voteEngine'
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
  if (o.mode === 'vote') return players.length >= 3 ? voteReferee(players, ctx) : null
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
      if (m.t !== 'choose' && m.t !== 'guess') return undefined
      const player = s.players.findIndex((p) => p.id === from)
      if (player < 0) return null
      if (m.t === 'guess') return typeof m.text === 'string' && m.text.length <= 100 ? { type: 'guess', player, text: m.text } : null
      return isInt(m.index, 0, 1) ? { type: 'choose', player, index: m.index } : null
    },
    drop: (s, key) => {
      const player = s.players.findIndex((p) => p.id === key)
      return player >= 0 ? { type: 'drop', player } : null
    },
    done: (s) => s.phase.kind === 'done',
    nowOf: (s) => s.now,
  })
}


/**
 * '다 같이 그리기'(투표) 서버 심판: 그리는 동안 각자 그림은 서버에만 모으고(남에게 안 넘김 — 베끼기 막기),
 * 투표 단계에 섞은 순서로 모두에게 보낸다(누가 그렸는지는 결과 때 공개). 투표는 서버가 붙인 접속 번호로.
 */
function voteReferee(players: { id: string; name: string; kind: 'remote' | 'bot' }[], ctx: RefereeContext): Referee {
  const drawings = new Map<string, { strokes: Stroke[]; ops: InkOp[] }>()
  let round = 0
  let sentGallery = -1
  const galleryOf = (s: VoteState) => (s.phase.kind === 'vote' || s.phase.kind === 'result' ? s.phase.order.map((i) => drawings.get(s.players[i].id)?.ops ?? []) : null)
  return hostEngineReferee<VoteState, VoteState, VoteAction>(ctx, {
    state: createVote({ now: ctx.now(), seed: serverSeed(), players }),
    reduce: (s, a) => {
      const next = voteReducer(s, a)
      // 새 판이면 그림 비움, 투표가 시작되면 그림을 한 번 모두에게
      if (next.round !== round) {
        round = next.round
        drawings.clear()
      }
      if (next.phase.kind === 'vote' && sentGallery !== next.round) {
        sentGallery = next.round
        ctx.broadcast({ t: 'gallery', round: next.round, drawings: galleryOf(next) })
      }
      return next
    },
    tick: (now) => ({ type: 'tick', now }),
    toView: (s) => s,
    changed: (a, b) => !a || voteChangeKey(a) !== voteChangeKey(b),
    viewFor: (_v, key, s) => voteViewFor(s, key) as unknown as VoteState,
    wrap: (v) => ({ t: 'vview', v }),
    input: (s, from, m) => {
      const player = s.players.findIndex((p) => p.id === from)
      if (m.t === 'ink') {
        const ops = readOps(m.ops)
        if (player < 0 || s.phase.kind !== 'draw' || m.turn !== s.round || !ops) return null
        const d = drawings.get(from) ?? { strokes: [], ops: [] }
        const strokes = applyOps(d.strokes, ops)
        if (tooBig(strokes)) return null
        const all = [...d.ops, ...ops]
        const cut = all.map((x) => x.op).lastIndexOf('x')
        drawings.set(from, { strokes, ops: cut >= 0 ? all.slice(cut) : all })
        return null // 남에게 안 넘김
      }
      if (m.t === 'inkSync') {
        // 그리는 중이면 내 그림만 돌려주고, 투표·결과면 모든 그림
        if (s.phase.kind === 'draw') ctx.sendTo(from, { t: 'inkAll', turn: s.round, ops: drawings.get(from)?.ops ?? [] })
        else if (s.phase.kind === 'vote' || s.phase.kind === 'result') ctx.sendTo(from, { t: 'gallery', round: s.round, drawings: galleryOf(s) })
        return null
      }
      if (m.t !== 'vote') return undefined
      if (player < 0 || s.phase.kind !== 'vote' || !isInt(m.index, 0, 15)) return null
      const target = s.phase.order[m.index]
      return target === undefined ? null : { type: 'vote', player, target }
    },
    drop: (s, key) => {
      const player = s.players.findIndex((p) => p.id === key)
      return player >= 0 ? { type: 'drop', player } : null
    },
    done: (s) => s.phase.kind === 'done',
    nowOf: (s) => s.now,
  })
}
