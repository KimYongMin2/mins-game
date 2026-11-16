import { MAX_TRIES, type Length } from '../../games/numbaseball/constants'
import { type Digits, isSolved, isValidNumber, score } from '../../games/numbaseball/rules/numbers'
import type { Referee, RefereeContext } from '../hub'

// 숫자야구 서버 심판 (조작 막기 3단계): 둘 다 자기 숫자를 서버에만 맡기고, 부른 숫자는 서버가 상대 숫자로 판정한다.
// 예전엔 받은 쪽 폰이 판정해 답해서 거짓 S·B를 보낼 수 있었고, 끝나기 전에 숫자를 엿볼 틈도 있었음.
// 경기 진행(차례·시간·끝)은 두 폰이 그대로 하고, 서버는 차례 순서·판정·끝났을 때 공개만 지킨다.

export function numbaseballReferee(setup: unknown, ctx: RefereeContext): Referee | null {
  const o = (setup ?? {}) as Record<string, unknown>
  const length = o.length === 3 || o.length === 4 ? (o.length as Length) : null
  const members = ctx.members()
  const host = members.find((m) => m.role === 'host')
  const guest = members.find((m) => m.role === 'guest')
  if (!length || !host || !guest || typeof o.guestFirst !== 'boolean') return null
  const first = o.guestFirst ? guest.id : host.id
  const second = o.guestFirst ? host.id : guest.id
  const other = (k: string) => (k === host.id ? guest.id : host.id)
  const secrets = new Map<string, Digits>()
  const tries = new Map<string, { digits: Digits; solved: boolean }[]>([
    [host.id, []],
    [guest.id, []],
  ])
  let doneAt: number | null = null

  const isDigits = (x: unknown): x is number[] => Array.isArray(x) && x.length === length && x.every((d) => Number.isInteger(d) && d >= 0 && d <= 9)

  return {
    input(from, msg) {
      const m = (msg ?? {}) as Record<string, unknown>
      // 폰끼리 주고받던 판정·공개·정함은 이제 서버가 보낸다 (폰이 보낸 건 버림)
      if (m.t === 'answer' || m.t === 'reveal' || m.t === 'locked') return true
      if (m.t !== 'secret' && m.t !== 'guess') return false
      const mine = tries.get(from)
      if (!mine || doneAt !== null) return true
      if (m.t === 'secret') {
        if (secrets.has(from) || !isDigits(m.digits) || !isValidNumber(m.digits, length)) return true
        secrets.set(from, m.digits)
        ctx.sendTo(other(from), { t: 'locked' })
        return true
      }
      // 부르기: 둘 다 정했고, 내 차례이고, 번호가 맞아야
      const theirs = secrets.get(other(from))
      if (!secrets.has(from) || !theirs || !isDigits(m.digits) || !isValidNumber(m.digits, length) || m.n !== mine.length) return true
      const a = tries.get(first)!.length
      const b = tries.get(second)!.length
      const myTurn = from === first ? a === b : a === b + 1
      if (!myTurn || mine.length >= MAX_TRIES) return true
      const s = score(theirs, m.digits)
      mine.push({ digits: m.digits, solved: isSolved(s, length) })
      ctx.sendTo(other(from), { t: 'guess', n: m.n, digits: m.digits })
      ctx.sendTo(from, { t: 'answer', n: m.n, strike: s.strike, ball: s.ball })
      // 같은 횟수만큼 불렀을 때 누가 맞혔거나 다 썼으면 끝 → 서로 숫자 공개
      const [x, y] = [tries.get(first)!, tries.get(second)!]
      if (x.length === y.length && (x.some((t) => t.solved) || y.some((t) => t.solved) || x.length >= MAX_TRIES)) {
        doneAt = ctx.now()
        ctx.sendTo(host.id, { t: 'reveal', digits: [...secrets.get(guest.id)!] })
        ctx.sendTo(guest.id, { t: 'reveal', digits: [...secrets.get(host.id)!] })
      }
      return true
    },
    tick() {},
    leave() {},
    finished: () => doneAt !== null && ctx.now() - doneAt > 5000,
  }
}
