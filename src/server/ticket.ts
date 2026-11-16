// 판 입장권(티켓): 서버가 정한 시드를 서명해 준다. 끝나면 이 티켓과 입력 기록을 받아 그 판을 다시 돌린다.
// 서명 키는 Supabase 비밀 키에서 뽑아 따로 키를 더 두지 않는다. 티켓 id가 기록 id라 한 티켓으로 두 번 못 올린다.

export type Ticket = { id: string; game: string; uid: string; seed: number; exp: number; sig: string }

/** 티켓을 받은 뒤 이 안에 올려야 함 */
export const TICKET_MS = 6 * 60 * 60 * 1000

const enc = new TextEncoder()
const payload = (t: Omit<Ticket, 'sig'>) => `${t.id}|${t.game}|${t.uid}|${t.seed}|${t.exp}`

async function hmac(secret: string, text: string): Promise<string> {
  const key = await crypto.subtle.importKey('raw', enc.encode(`ticket:${secret}`), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  const sig = new Uint8Array(await crypto.subtle.sign('HMAC', key, enc.encode(text)))
  return Array.from(sig, (b) => b.toString(16).padStart(2, '0')).join('')
}

export async function issueTicket(secret: string, game: string, uid: string, now = Date.now()): Promise<Ticket> {
  const seed = crypto.getRandomValues(new Uint32Array(1))[0]
  const t = { id: crypto.randomUUID(), game, uid, seed, exp: now + TICKET_MS }
  return { ...t, sig: await hmac(secret, payload(t)) }
}

/** 이 사용자가 이 게임에 받은, 아직 안 지난 진짜 티켓인지 */
export async function checkTicket(secret: string, x: unknown, game: string, uid: string, now = Date.now()): Promise<Ticket | null> {
  if (!x || typeof x !== 'object') return null
  const t = x as Record<string, unknown>
  if (typeof t.id !== 'string' || !/^[0-9a-f-]{36}$/.test(t.id) || t.game !== game || t.uid !== uid) return null
  if (typeof t.seed !== 'number' || !Number.isInteger(t.seed) || typeof t.exp !== 'number' || t.exp < now || typeof t.sig !== 'string') return null
  const ticket = { id: t.id, game, uid, seed: t.seed, exp: t.exp }
  const sig = await hmac(secret, payload(ticket))
  // 길이가 같을 때만 한 글자씩 비교 (시간으로 엿보기 어렵게 전부 돌림)
  if (sig.length !== t.sig.length) return null
  let diff = 0
  for (let i = 0; i < sig.length; i++) diff |= sig.charCodeAt(i) ^ t.sig.charCodeAt(i)
  return diff === 0 ? { ...ticket, sig } : null
}
