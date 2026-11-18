import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import { type CurrentRoom, watchCurrentRoom } from '../online/currentRoom'
import type { Member } from '../online/room'
import { IconMessage, IconMic, IconSend, IconX } from './icons'
import './RoomDock.css'

// 모든 게임 방 공통 글자 채팅·음성 (사용자 요청 2026-11-18). 게임마다 고치지 않고 '지금 방'(currentRoom)을 보고 화면 왼쪽에 작게 붙는다.
// 평소엔 동그란 버튼 둘(채팅·음성)만, 채팅은 누르면 펼침 + 안 읽은 수, 새 글은 버튼 옆에 잠깐 보임.
// 음성은 [음성]을 누를 때만 마이크를 켜고 우리 음성 서버(LiveKit)에 붙음 — 무거운 음성 코드는 그때 받음.
// 봇 연습엔 방이 없어서 안 보임, 회의방·낚시터는 따로 있어서 뺌(currentRoom).

const RoomVoice = lazy(() => import('./RoomVoice'))

export type TalkLine = { key: number; name: string; text: string; mine: boolean; system?: boolean }

const MAX_LINES = 100
/** 자기 채팅이 따로 있는 게임 (정답을 채팅으로 내는 게임 — 여기 채팅까지 있으면 헷갈리고, 그림 맞히기는 정답이 새어 나감): 음성만 */
const OWN_CHAT = new Set(['doodle', 'wordchain', 'chosung'])

export function RoomDock({ voiceBlocked }: { /** 수다방 통화 중이면 게임 음성은 막음 (소리가 겹쳐서) */ voiceBlocked: boolean }) {
  const [cur, setCur] = useState<CurrentRoom | null>(null)
  useEffect(() => watchCurrentRoom(setCur), [])
  if (!cur) return null
  return <Dock key={cur.room.code + cur.gameId} cur={cur} voiceBlocked={voiceBlocked} />
}

function Dock({ cur, voiceBlocked }: { cur: CurrentRoom; voiceBlocked: boolean }) {
  const { room, members } = cur
  const chatOn = !OWN_CHAT.has(cur.gameId)
  const [lines, setLines] = useState<TalkLine[]>([])
  const [open, setOpen] = useState(false)
  const [unread, setUnread] = useState(0)
  const [peek, setPeek] = useState<TalkLine | null>(null)
  const [text, setText] = useState('')
  const [voice, setVoice] = useState(false)
  const seq = useRef(0)
  const openRef = useRef(open)
  openRef.current = open
  const logRef = useRef<HTMLOListElement>(null)

  const push = (l: Omit<TalkLine, 'key'>) => setLines((ls) => [...ls.slice(-(MAX_LINES - 1)), { ...l, key: ++seq.current }])

  // 받은 채팅
  useEffect(() => {
    if (!room.onTalk) return
    let peekTimer: ReturnType<typeof setTimeout> | undefined
    const off = room.onTalk(({ from, name, text }) => {
      const mine = from === room.myId
      const line = { key: ++seq.current, name, text, mine }
      setLines((ls) => [...ls.slice(-(MAX_LINES - 1)), line])
      if (!openRef.current && !mine) {
        setUnread((n) => n + 1)
        setPeek(line)
        clearTimeout(peekTimer)
        peekTimer = setTimeout(() => setPeek(null), 4000)
      }
    })
    return () => {
      off()
      clearTimeout(peekTimer)
    }
  }, [room])

  // 들어옴·나감 (처음 목록은 빼고)
  const prev = useRef<Member[] | null>(null)
  const mountedAt = useRef(performance.now())
  useEffect(() => {
    const before = prev.current
    prev.current = members
    // 들어온 직후 1.5초는 이미 있던 사람 목록을 채우는 중이라 알리지 않음
    if (!before || performance.now() - mountedAt.current < 1500) return
    for (const m of members) if (!before.some((b) => b.id === m.id)) push({ name: '', text: `${m.nickname}님이 들어왔어요`, mine: false, system: true })
    for (const b of before) if (!members.some((m) => m.id === b.id)) push({ name: '', text: `${b.nickname}님이 나갔어요`, mine: false, system: true })
  }, [members])

  useEffect(() => {
    if (open) {
      setUnread(0)
      setPeek(null)
    }
  }, [open, lines.length])
  useEffect(() => {
    const el = logRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [lines, open])

  const send = () => {
    const t = text.trim()
    if (!t) return
    room.sendTalk?.(t)
    setText('')
  }

  if (!room.sendTalk) return null
  return (
    <div className="rdock" aria-label="방 채팅·음성">
      <div className="rdock__bar">
        {chatOn && <button type="button" className={`rdock__btn${open ? ' rdock__btn--on' : ''}`} onClick={() => setOpen((o) => !o)} aria-label={open ? '채팅 닫기' : '채팅 열기'} aria-expanded={open}>
          <IconMessage width={20} height={20} />
          {unread > 0 && <span className="rdock__badge">{unread > 99 ? '99+' : unread}</span>}
        </button>}
        {voice ? (
          <Suspense fallback={<span className="rdock__btn rdock__btn--wait">…</span>}>
            <RoomVoice room={room} members={members} onLeave={() => setVoice(false)} />
          </Suspense>
        ) : (
          <button
            type="button"
            className="rdock__btn"
            disabled={voiceBlocked || !room.sfuToken}
            onClick={() => setVoice(true)}
            aria-label="음성 참여"
            title={voiceBlocked ? '수다방 통화 중이라 게임 음성은 못 켜요' : '음성 참여 (이 방 사람들과 말하기)'}
          >
            <IconMic width={20} height={20} />
          </button>
        )}
        {peek && !open && (
          <button type="button" className="rdock__peek" onClick={() => setOpen(true)}>
            <b>{peek.name}</b> {peek.text}
          </button>
        )}
      </div>
      {open && chatOn && (
        <div className="rdock__panel" role="dialog" aria-label="방 채팅">
          <div className="rdock__head">
            <span>방 채팅 · {members.length + 1}명</span>
            <button type="button" className="rdock__close" onClick={() => setOpen(false)} aria-label="채팅 닫기">
              <IconX width={16} height={16} />
            </button>
          </div>
          <ol className="rdock__log" ref={logRef}>
            {lines.length === 0 && <li className="rdock__empty">아직 채팅이 없어요</li>}
            {lines.map((l) =>
              l.system ? (
                <li key={l.key} className="rdock__sys">
                  {l.text}
                </li>
              ) : (
                <li key={l.key} className={l.mine ? 'rdock__mine' : undefined}>
                  <b>{l.mine ? '나' : l.name}</b> {l.text}
                </li>
              ),
            )}
          </ol>
          <form
            className="rdock__form"
            onSubmit={(e) => {
              e.preventDefault()
              send()
            }}
          >
            <input
              className="rdock__input"
              value={text}
              maxLength={200}
              placeholder="채팅 (Enter)"
              onChange={(e) => setText(e.target.value)}
              // 게임 키(스페이스·방향키 등)가 같이 눌리지 않게
              onKeyDown={(e) => {
                e.stopPropagation()
                if (e.key === 'Escape') setOpen(false)
              }}
              onKeyUp={(e) => e.stopPropagation()}
              autoFocus
            />
            <button type="submit" className="rdock__send" aria-label="보내기" disabled={!text.trim()}>
              <IconSend width={18} height={18} />
            </button>
          </form>
        </div>
      )}
    </div>
  )
}
