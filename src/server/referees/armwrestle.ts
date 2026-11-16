import type { Event } from '../../games/armwrestle/constants'
import { createMatch, matchReducer, type MatchState } from '../../games/armwrestle/play/matchState'
import { phaseChanged, serverSync } from '../../games/armwrestle/play/pvp'
import type { Grade } from '../../games/armwrestle/rules/timing'

const EVENTS: readonly Event[] = ['mash', 'timing']
const GRADE_NAMES: readonly Grade[] = ['perfect', 'great', 'good', 'miss']
import type { Referee, RefereeContext } from '../hub'
import { serverSeed } from './common'

// 팔씨름 서버 심판 (사용자 요청 2026-11-16 — 타이밍 게임도 서버로): 손 위치·남은 시간·판 승패를 서버가 정한다 (예전엔 방장 폰).
// 두 폰은 누른 횟수(연타전)와 판정(타이밍전 — 0.01초라 각자 폰에서)만 보낸다. 서버 안에서 방장 = 0, 친구 = 1. 0.1초마다 + 단계가 바뀌면 바로 상태를 보냄.

const SYNC_MS = 100

export function armwrestleReferee(setup: unknown, ctx: RefereeContext): Referee | null {
  const o = (setup ?? {}) as Record<string, unknown>
  const members = ctx.members()
  const host = members.find((m) => m.role === 'host')
  const guest = members.find((m) => m.role === 'guest')
  if (!host || !guest || !EVENTS.includes(o.event as Event)) return null
  let s: MatchState = createMatch({ now: ctx.now(), seed: serverSeed(), event: o.event as Event, difficulty: 'normal', controllers: ['remote', 'remote'] })
  let sentAt = -Infinity
  let doneAt: number | null = null
  const send = () => {
    ctx.sendTo(host.id, serverSync(s, 'host'))
    ctx.sendTo(guest.id, serverSync(s, 'guest'))
    sentAt = s.now
  }
  const step = (next: MatchState) => {
    const prev = s
    s = next
    if (phaseChanged(prev, s) || s.now - sentAt >= SYNC_MS) send()
    if (doneAt === null && s.phase.kind === 'done') doneAt = s.now
  }
  send()
  return {
    input(from, msg) {
      const m = (msg ?? {}) as Record<string, unknown>
      if (m.t === 'sync') return true // 폰이 보낸 상태는 버림
      if (m.t !== 'taps' && m.t !== 'press') return false
      const side = from === host.id ? 0 : from === guest.id ? 1 : null
      if (side === null) return true
      const now = ctx.now()
      const ticked = matchReducer(s, { type: 'tick', now: Math.max(now, s.now) })
      if (m.t === 'taps' && Number.isInteger(m.total) && (m.total as number) >= 0 && (m.total as number) < 100_000) step(matchReducer(ticked, { type: 'remoteTaps', total: m.total as number, side }))
      else if (m.t === 'press' && Number.isInteger(m.pass) && GRADE_NAMES.includes(m.grade as Grade)) step(matchReducer(ticked, { type: 'remotePress', pass: m.pass as number, grade: m.grade as Grade, side }))
      return true
    },
    tick(now) {
      step(matchReducer(s, { type: 'tick', now: Math.max(now, s.now) }))
    },
    leave() {},
    finished: () => doneAt !== null && s.now - doneAt > 4000,
  }
}
