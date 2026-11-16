import type { Referee, RefereeContext } from '../hub'

// 여럿 게임 공용 서버 심판 틀: 예전에 방장 폰이 돌리던 심판(엔진)을 서버에서 그대로 돌리고, 화면을 모두에게 보낸다.
// 게임마다 다른 건 '입력 읽기'와 '나간 사람 처리'뿐.

const HEARTBEAT_MS = 1000
/** 끝나고 이만큼 더 화면을 보낸 뒤 심판을 내린다 */
const LINGER_MS = 3000

export type EngineSpec<S, V, A> = {
  state: S
  reduce: (s: S, a: A) => S
  tick: (now: number) => A
  toView: (s: S) => V
  changed: (a: V | null, b: V) => boolean
  /** 사람 메시지 → 심판 동작. undefined = 이 게임 메시지가 아님(그대로 전달), null = 이 게임 메시지지만 무시 */
  input: (s: S, from: string, msg: Record<string, unknown>) => A | null | undefined
  /** 나간 사람 → 동작 (없으면 null) */
  drop: (s: S, key: string) => A | null
  done: (s: S) => boolean
  nowOf: (s: S) => number
  /** 화면 메시지 꼴 (기본 { t: 'view', v }) */
  wrap?: (v: V) => unknown
  /** 사람마다 다르게 보낼 화면 (숫자 잇기 손패처럼 남의 것을 가림). 없으면 모두 같은 화면 */
  viewFor?: (v: V, key: string, s: S) => V
}

export function hostEngineReferee<S, V, A>(ctx: RefereeContext, spec: EngineSpec<S, V, A>): Referee {
  let s = spec.state
  let sent: { view: V | null; at: number } = { view: null, at: 0 }
  let doneAt: number | null = null
  const wrap = spec.wrap ?? ((v: V) => ({ t: 'view', v }))
  const flush = (force = false) => {
    const view = spec.toView(s)
    const now = spec.nowOf(s)
    if (force || spec.changed(sent.view, view) || now - sent.at >= HEARTBEAT_MS) {
      const viewFor = spec.viewFor
      if (viewFor) for (const m of ctx.members()) ctx.sendTo(m.id, wrap(viewFor(view, m.id, s)))
      else ctx.broadcast(wrap(view))
      sent = { view, at: now }
    }
  }
  flush(true)
  return {
    input(from, msg) {
      if (!msg || typeof msg !== 'object') return false
      try {
        const a = spec.input(s, from, msg as Record<string, unknown>)
        if (a === undefined) return false
        if (a !== null) {
          // 받은 순간의 서버 시각으로 (박자 사이에 와도 — 눈치게임 동시 판정 등)
          s = spec.reduce(spec.reduce(s, spec.tick(ctx.now())), a)
          flush()
        }
      } catch (e) {
        // 이상한 입력 하나로 경기가 멈추지 않게 그 입력만 버림
        console.warn('[referee] 입력 무시', e)
      }
      return true
    },
    tick(now) {
      s = spec.reduce(s, spec.tick(now))
      if (doneAt === null && spec.done(s)) doneAt = now
      flush()
    },
    leave(key) {
      const a = spec.drop(s, key)
      if (a) {
        s = spec.reduce(s, a)
        flush()
      }
    },
    finished: () => doneAt !== null && spec.nowOf(s) - doneAt > LINGER_MS,
  }
}

/** 사람 번호 (서버가 정한 접속 번호로, 사람 자리만) */
export const humanIndex = (players: { id: string; kind: string }[], key: string) => players.findIndex((p) => p.id === key && p.kind === 'remote')
export const isInt = (x: unknown): x is number => typeof x === 'number' && Number.isInteger(x)
