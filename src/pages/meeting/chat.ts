import type { CallSignal } from '../../shared/call/voiceMesh'

// 회의방 글자 채팅 (디스코드 음성 채널 옆 채팅처럼, 사용자 요청 2026-11-17).
// 방 메시지로 보낸다 (DB 없음 → 나중에 들어온 사람은 그 전 채팅을 못 봄). 게임 서버는 보낸 사람(from)을 붙여 주고, 내 메시지는 나한테 다시 안 와서 화면에 바로 넣는다.

/** 한 줄 최대 글자 수 */
export const CHAT_MAX = 300
/** 화면에 남겨 두는 줄 수 */
export const CHAT_KEEP = 200

export type ChatSignal = { t: 'chat'; from: string; text: string }
export type MeetMsg = CallSignal | ChatSignal

/** 채팅 한 줄. kind 'join'·'leave'는 들어옴·나감 알림 줄 */
export type ChatLine = { key: number; kind: 'chat' | 'join' | 'leave'; name: string; text: string; mine?: boolean; at: number }

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
