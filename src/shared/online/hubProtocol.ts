// 우리 게임 서버(민스서버, game-server/)와 브라우저가 주고받는 메시지 모양. 서버·브라우저가 같이 쓴다.
// 2026-11-16 조작 막기 2단계: Supabase Realtime 대신 우리 서버가 방·사람 목록·방 목록을 맡는다.
// 접속 번호(key)는 서버가 정하고, 메시지엔 서버가 보낸 사람(from)을 붙여서 남인 척할 수 없다.

export type HubRole = 'host' | 'guest'

export type HubMember = {
  /** 접속 번호 (서버가 정함) */
  id: string
  nickname: string
  role: HubRole
  joinedAt: number
  avatar?: string
  ready?: boolean
  info?: string
}

export type JoinError = 'not-found' | 'full' | 'offline'

/** 브라우저 → 서버 */
export type ClientMsg =
  | { t: 'hello'; token: string; apikey: string }
  | {
      t: 'join'
      ref: number
      game: string
      /** 방 번호, 비공개면 '번호-코드' (예전 채널 이름과 같은 꼴) */
      code: string
      role: HubRole
      nickname: string
      avatar?: string
      capacity: number
      /** 끊겼다 다시 붙을 때 예전 자리 되찾기 */
      resume?: string
    }
  | { t: 'leave'; room: string }
  | { t: 'send'; room: string; msg: unknown }
  | { t: 'ready'; room: string; ready: boolean }
  | { t: 'info'; room: string; info: string }
  | { t: 'move'; room: string; move: unknown }
  | { t: 'advertise'; list: string; info: Record<string, unknown> | null }
  | { t: 'watch'; list: string }
  | { t: 'unwatch'; list: string }
  | { t: 'ping' }

/** 서버 → 브라우저 */
export type ServerMsg =
  | { t: 'hello-ok' }
  | { t: 'error'; reason: string }
  | { t: 'joined'; ref: number; room: string; key: string; resume: string }
  | { t: 'join-error'; ref: number; reason: JoinError }
  | { t: 'members'; room: string; members: HubMember[] }
  | { t: 'msg'; room: string; from: string; msg: unknown }
  | { t: 'move'; room: string; from: string; move: unknown }
  | { t: 'rooms'; list: string; rooms: Record<string, unknown>[] }
  | { t: 'pong' }
