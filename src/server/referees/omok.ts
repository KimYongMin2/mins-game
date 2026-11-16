import { PICK_MS } from '../../games/omok/constants'
import type { Referee, RefereeContext } from '../hub'

// 오목 서버 심판 (조작 막기 3단계): 흑 카드가 몇 번째인지는 서버만 알다가, 고른 순간 둘에게 알려 준다.
// 예전엔 방장이 정해 시작 메시지에 넣어서 둘 다(특히 카드를 고르는 쪽이) 미리 알 수 있었음.
// 돌 두기는 규칙 검사를 두 폰이 똑같이 해서(틀린 수는 상대 폰이 안 받음) 그대로 둘이 주고받는다.

export function omokReferee(setup: unknown, ctx: RefereeContext): Referee | null {
  const o = (setup ?? {}) as Record<string, unknown>
  const members = ctx.members()
  const host = members.find((m) => m.role === 'host')
  const guest = members.find((m) => m.role === 'guest')
  if (!host || !guest || typeof o.guestPicks !== 'boolean') return null
  const picker = o.guestPicks ? guest.id : host.id
  const blackCard = crypto.getRandomValues(new Uint8Array(1))[0] % 2
  const deadline = ctx.now() + PICK_MS + 1000
  let pickedAt: number | null = null
  const reveal = (card: number) => {
    pickedAt = ctx.now()
    ctx.broadcast({ t: 'pick', card, blackCard })
  }
  return {
    input(from, msg) {
      const m = (msg ?? {}) as Record<string, unknown>
      if (m.t !== 'pick') return false
      if (pickedAt === null && from === picker && (m.card === 0 || m.card === 1)) reveal(m.card)
      return true
    },
    tick(now) {
      // 시간 안에 안 고르면 서버가 아무 카드나
      if (pickedAt === null && now >= deadline) reveal(crypto.getRandomValues(new Uint8Array(1))[0] % 2)
    },
    leave() {},
    // 카드만 정하면 할 일 끝 (돌 두기는 두 폰이)
    finished: () => pickedAt !== null && ctx.now() - pickedAt > 3000,
  }
}
