import type { CallSignal } from '../../shared/call/voiceMesh'

// 회의방 글자 채팅 (디스코드 음성 채널 옆 채팅처럼, 사용자 요청 2026-11-17).
// 방 메시지로 보낸다 (DB 없음 → 나중에 들어온 사람은 그 전 채팅을 못 봄). 게임 서버는 보낸 사람(from)을 붙여 주고, 내 메시지는 나한테 다시 안 와서 화면에 바로 넣는다.

/** 한 줄 최대 글자 수 */
export const CHAT_MAX = 300
/** 화면에 남겨 두는 줄 수 */
export const CHAT_KEEP = 200

export type ChatSignal = { t: 'chat'; from: string; text: string }
/** 듣기 끔/켬 (다른 사람 칸에 표시) */
export type DeafSignal = { t: 'deaf'; from: string; on: boolean }
/** 같이 게임하기: 누가 게임 방을 만들었다는 알림 (채팅에 [들어가기] 카드) */
export type GameInvite = { path: string; title: string; id: string; name: string; pin: string | null }
export type GameSignal = { t: 'game'; from: string } & GameInvite
export type MeetMsg = CallSignal | ChatSignal | DeafSignal | GameSignal

/**
 * 받은 방 메시지가 게임 초대면 그 내용 (누구나 보낼 수 있어서 검사).
 * 주소는 우리 게임 목록(paths → 이름)에 있는 것만, 방 번호·코드는 게임 방 모양만
 */
export function readGame(msg: unknown, games: Record<string, string>): GameInvite | null {
  if (!msg || typeof msg !== 'object' || (msg as { t?: unknown }).t !== 'game') return null
  const m = msg as Record<string, unknown>
  if (typeof m.path !== 'string' || !(m.path in games)) return null
  if (typeof m.id !== 'string' || !/^[A-Z0-9]{4,12}$/.test(m.id)) return null
  const pin = typeof m.pin === 'string' && /^\d{4}$/.test(m.pin) ? m.pin : null
  const name = cleanChat(m.name)?.slice(0, 20) ?? '방'
  return { path: m.path, title: games[m.path], id: m.id, name, pin }
}

/** 받은 방 메시지가 듣기 끔/켬이면 그 값 */
export function readDeaf(msg: unknown): boolean | null {
  if (!msg || typeof msg !== 'object' || (msg as { t?: unknown }).t !== 'deaf') return null
  const on = (msg as { on?: unknown }).on
  return typeof on === 'boolean' ? on : null
}

/** 채팅 한 줄. kind 'join'·'leave'는 들어옴·나감 알림 줄 */
export type ChatLine = { key: number; kind: 'chat' | 'join' | 'leave' | 'game'; name: string; text: string; mine?: boolean; at: number; game?: GameInvite }

/** 보이지 않는 제어 문자를 지우고 앞뒤 공백을 자르고 길이를 줄인다. 비면 null */
export function cleanChat(text: unknown): string | null {
  if (typeof text !== 'string') return null
  // eslint-disable-next-line no-control-regex -- 보이지 않는 제어 문자 지우기 (줄바꿈도 한 줄로)
  const t = text.replace(/[\u0000-\u001f\u007f​-‏‪-‮⁦-⁩]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, CHAT_MAX)
  return t || null
}

/** 받은 방 메시지가 채팅이면 글자 (누구나 보낼 수 있어서 검사) */
export function readChat(msg: unknown): string | null {
  if (!msg || typeof msg !== 'object' || (msg as { t?: unknown }).t !== 'chat') return null
  return cleanChat((msg as { text?: unknown }).text)
}

/** 줄을 더하고 오래된 건 버린다 */
export function pushLine(lines: ChatLine[], line: ChatLine): ChatLine[] {
  const next = [...lines, line]
  return next.length > CHAT_KEEP ? next.slice(next.length - CHAT_KEEP) : next
}

/** 사람 목록이 바뀌었을 때 새로 들어온 사람·나간 사람 (접속 번호 기준) */
export function diffMembers<T extends { id: string }>(before: T[], after: T[]): { joined: T[]; left: T[] } {
  const was = new Set(before.map((m) => m.id))
  const now = new Set(after.map((m) => m.id))
  return { joined: after.filter((m) => !was.has(m.id)), left: before.filter((m) => !now.has(m.id)) }
}
