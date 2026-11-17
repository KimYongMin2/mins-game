import { type ReactNode, createContext, useContext, useMemo, useRef, useState } from 'react'
import type { Room } from '../../shared/online/room'
import type { VoiceChanger, VoiceSettings } from '../../shared/call/voiceFx'
import type { MeetMsg } from './chat'

// 회의방 통화를 사이트 전체에 걸어 둔다 (사용자 요청 2026-11-17 — 통화한 채로 게임하기).
// 들어간 방(Joined)을 여기 두고, App이 화면 어디서든 통화 화면(MeetingCallHost)을 띄운다:
// /meeting이면 회의방 전체 화면, 다른 곳이면 떠 있는 작은 통화 창. 페이지를 새로 고치면 끊긴다(웹이라).
// 이 파일은 첫 화면 묶음에 들어가서 무거운 것(LiveKit·소리 처리)은 타입만 가져온다.

/** 들어간 방: 이름과, 비공개면 코드 (화면에 보여 줌) */
export type Joined = { room: Room<MeetMsg>; voice: VoiceChanger | null; name: string; pin: string | null }

type CallCtx = {
  joined: Joined | null
  start: (j: Joined) => void
  /** 나중에 마이크를 허락받음 */
  setVoice: (v: VoiceChanger) => void
  /** 방을 닫고 마이크를 끈다 */
  leave: () => void
  /** 목소리 효과 (방 목록에서 고른 걸 방 안에서도). null = 기본 */
  settings: VoiceSettings | null
  setSettings: (s: VoiceSettings) => void
}

const Ctx = createContext<CallCtx | null>(null)

export function MeetingCallProvider({ children }: { children: ReactNode }) {
  const [joined, setJoinedState] = useState<Joined | null>(null)
  const joinedRef = useRef<Joined | null>(null)
  const setJoined = (j: Joined | null) => {
    joinedRef.current = j
    setJoinedState(j)
  }
  const [settings, setSettings] = useState<VoiceSettings | null>(null)
  const value = useMemo<CallCtx>(
    () => ({
      joined,
      start: setJoined,
      setVoice: (voice) => {
        const j = joinedRef.current
        if (j) setJoined({ ...j, voice })
      },
      leave: () => {
        const j = joinedRef.current
        j?.voice?.stop()
        j?.room.leave()
        setJoined(null)
      },
      settings,
      setSettings,
    }),
    [joined, settings],
  )
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useMeetingCall(): CallCtx {
  const c = useContext(Ctx)
  if (!c) throw new Error('MeetingCallProvider 밖')
  return c
}
