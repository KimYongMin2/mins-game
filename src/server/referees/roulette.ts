import { createEngine, engineReducer, type EngineState } from '../../games/roulette/play/engine'
import { toView, viewChanged, type RouletteView } from '../../games/roulette/play/view'
import type { Referee, RefereeContext } from '../hub'
import { readPlayers, readTeams, serverSeed } from './common'

// 러시안룰렛 서버 심판 (조작 막기 3단계): 총알 칸은 서버만 안다. 방장 폰도 화면만 받는다.
// 차례인 사람이 고른 사람·방아쇠는 서버가 붙인 접속 번호로 누구인지 정한다 (남의 차례에 못 쏨).

const HEARTBEAT_MS = 1000
/** 끝나고 이만큼 더 화면을 보낸 뒤 심판을 내린다 */
const LINGER_MS = 3000

export function rouletteReferee(setup: unknown, ctx: RefereeContext): Referee | null {
  const o = (setup ?? {}) as Record<string, unknown>
  const players = readPlayers(o.players, ctx, 2, 8)
  if (!players) return null
  const teams = readTeams(o.teams, players.length)
  if (teams === undefined) return null
  let s: EngineState = createEngine({ now: ctx.now(), seed: serverSeed(), players, teams, friendlyFire: o.friendlyFire === true })
  let sent: { view: RouletteView | null; at: number } = { view: null, at: 0 }
  let doneAt: number | null = null
  const indexOf = (id: string) => s.players.findIndex((p) => p.id === id && p.kind === 'remote')
  const flush = (force = false) => {
    const view = toView(s)
    if (force || viewChanged(sent.view, view) || s.now - sent.at >= HEARTBEAT_MS) {
      ctx.broadcast({ t: 'view', v: view })
      sent = { view, at: s.now }
    }
  }
  flush(true)
  return {
    input(from, msg) {
      const m = msg as { t?: unknown; target?: unknown }
      if (m?.t !== 'aim' && m?.t !== 'pull') return false
      const player = indexOf(from)
      if (player < 0 || typeof m.target !== 'number' || !Number.isInteger(m.target)) return true
      s = engineReducer(s, m.t === 'aim' ? { type: 'aim', player, target: m.target } : { type: 'pull', player, target: m.target })
      flush()
      return true
    },
    tick(now) {
      s = engineReducer(s, { type: 'tick', now })
      if (s.phase.kind === 'done' && doneAt === null) doneAt = now
      flush()
    },
    leave(key) {
      const player = indexOf(key)
      if (player >= 0) s = engineReducer(s, { type: 'drop', player })
      flush()
    },
    finished: () => doneAt !== null && s.now - doneAt > LINGER_MS,
  }
}
