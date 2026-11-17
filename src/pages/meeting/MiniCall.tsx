import { useEffect, useRef, useState } from 'react'
import { ANIMAL_EMOJI, decodeLook } from '../../shared/art3d/animalKinds'
import { IconHeadphoneOff, IconHeadphones, IconMic, IconMicOff, IconPhoneOff, IconVolume, IconX } from '../../shared/ui/icons'
import { readLocal, writeLocal } from '../../shared/storage/local'
import type { GameInvite } from './chat'

// 회의방 밖(메인·게임)에서 떠 있는 작은 통화 창 (사용자 요청 2026-11-17 — 통화한 채로 게임하기, 디스코드처럼).
// 기본은 위 오른쪽 구석(게임 조작은 대부분 아래라서). 위 줄을 끌어서 옮길 수 있고 자리는 기기에 기억, 접으면 작은 네모 하나.
// 누가 '같이 게임하기'로 방을 만들면 여기에도 [들어가기]가 뜬다.

const POS_KEY = 'meeting-mini-pos'
const FOLD_KEY = 'meeting-mini-fold'
/** 화면 가장자리에서 띄우는 거리 */
const EDGE = 8
/** 처음 자리: 오른쪽 위 (게임 머리말 버튼 아래) */
const DEFAULT_POS = { right: EDGE, top: 64 }
/** 이만큼 움직여야 끌기 (그보다 적으면 누르기) */
const DRAG_PX = 6

type Pos = { right: number; top: number }

function loadPos(): Pos {
  try {
    const p = JSON.parse(readLocal(POS_KEY) ?? 'null') as Pos | null
    if (p && Number.isFinite(p.right) && Number.isFinite(p.top)) return p
  } catch {
    /* 기본 자리 */
  }
  return DEFAULT_POS
}

/** 창이 화면 밖으로 나가지 않게 */
function clampPos(p: Pos, el: HTMLElement | null): Pos {
  const w = el?.offsetWidth ?? 200
  const h = el?.offsetHeight ?? 100
  return {
    right: Math.min(Math.max(EDGE, p.right), Math.max(EDGE, window.innerWidth - w - EDGE)),
    top: Math.min(Math.max(EDGE, p.top), Math.max(EDGE, window.innerHeight - h - EDGE)),
  }
}

export type MiniFace = { id: string; name: string; avatar?: string; speaking: boolean; me?: boolean }

type Props = {
  name: string
  faces: MiniFace[]
  micOn: boolean
  hasMic: boolean
  deafened: boolean
  unread: number
  blocked: boolean
  invite: (GameInvite & { from: string }) | null
  onMic: () => void
  onDeaf: () => void
  onOpen: () => void
  onLeave: () => void
  onUnblock: () => void
  onJoinGame: () => void
  onDismissInvite: () => void
}

const MAX_FACES = 5

export function MiniCall({ name, faces, micOn, hasMic, deafened, unread, blocked, invite, onMic, onDeaf, onOpen, onLeave, onUnblock, onJoinGame, onDismissInvite }: Props) {
  const ref = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState(loadPos)
  // 폰은 처음엔 접힌 네모로 (펼친 창이 게임 화면을 많이 가려서). 한 번 접거나 펴면 그걸 기억
  const [folded, setFolded] = useState(() => {
    const saved = readLocal(FOLD_KEY)
    return saved === null ? window.innerWidth < 560 : saved === '1'
  })
  // 게임 초대가 오면 펼쳐서 보여 준다 (기억은 안 바꿈)
  const inviteKey = invite ? `${invite.path}#${invite.id}` : null
  useEffect(() => {
    if (inviteKey) setFolded(false)
  }, [inviteKey])
  const drag = useRef<{ x: number; y: number; start: Pos; moved: boolean } | null>(null)

  // 화면 크기가 바뀌거나(폰 돌리기) 접고 펼 때 화면 안으로
  useEffect(() => {
    const fit = () => setPos((p) => clampPos(p, ref.current))
    fit()
    window.addEventListener('resize', fit)
    return () => window.removeEventListener('resize', fit)
  }, [folded])

  const fold = (v: boolean) => {
    setFolded(v)
    writeLocal(FOLD_KEY, v ? '1' : '0')
  }

  /** 끌기 손잡이 (위 줄 또는 접힌 네모). 조금만 움직이고 떼면 onTap */
  const handle = (onTap: () => void) => ({
    onPointerDown: (e: React.PointerEvent) => {
      if (e.button !== 0) return
      drag.current = { x: e.clientX, y: e.clientY, start: pos, moved: false }
      e.currentTarget.setPointerCapture(e.pointerId)
    },
    onPointerMove: (e: React.PointerEvent) => {
      const d = drag.current
      if (!d) return
      const dx = e.clientX - d.x
      const dy = e.clientY - d.y
      if (!d.moved && Math.hypot(dx, dy) < DRAG_PX) return
      d.moved = true
      setPos(clampPos({ right: d.start.right - dx, top: d.start.top + dy }, ref.current))
    },
    onPointerUp: () => {
      const d = drag.current
      drag.current = null
      if (!d) return
      if (d.moved) setPos((p) => (writeLocal(POS_KEY, JSON.stringify(p)), p))
      else onTap()
    },
    onPointerCancel: () => {
      drag.current = null
    },
  })

  const speaking = faces.some((f) => f.speaking && !f.me)
  const shown = [...faces.filter((f) => f.speaking), ...faces.filter((f) => !f.speaking)].slice(0, MAX_FACES)

  if (folded)
    return (
      <div ref={ref} className="mini-call mini-call--folded" style={{ right: pos.right, top: pos.top }}>
        <button
          type="button"
          className={`mini-call__dot${speaking ? ' mini-call__dot--speaking' : ''}`}
          aria-label={`통화 중: ${name} — 펼치기`}
          {...handle(() => fold(false))}
        >
          {deafened ? <IconHeadphoneOff size={20} /> : micOn ? <IconVolume size={20} /> : <IconMicOff size={20} />}
          {(unread > 0 || invite) && <span className="mini-call__badge">{invite ? '!' : unread > 99 ? '99+' : unread}</span>}
        </button>
      </div>
    )

  return (
    <div ref={ref} className="mini-call" style={{ right: pos.right, top: pos.top }} role="region" aria-label="통화 중">
      <div className="mini-call__top">
        <button type="button" className="mini-call__title" {...handle(onOpen)} title="눌러서 회의방으로 · 끌어서 옮기기">
          <IconVolume size={15} />
          <span>{name}</span>
          {unread > 0 && <span className="mini-call__badge mini-call__badge--inline">{unread > 99 ? '99+' : unread}</span>}
        </button>
        <button type="button" className="mini-call__fold" onClick={() => fold(true)} aria-label="작게 접기">
          <IconX size={14} />
        </button>
      </div>
      <button type="button" className="mini-call__faces" onClick={onOpen} aria-label="회의방으로 돌아가기">
        {shown.map((f) => {
          const look = decodeLook(f.avatar)
          return (
            <span key={f.id} className={`mini-call__face${f.speaking ? ' mini-call__face--speaking' : ''}`} title={f.name}>
              {look ? ANIMAL_EMOJI[look.animal] : f.name.slice(0, 1)}
            </span>
          )
        })}
        {faces.length > MAX_FACES && <span className="mini-call__more">+{faces.length - MAX_FACES}</span>}
      </button>
      {invite && (
        <div className="mini-call__invite">
          <span>
            <b>{invite.from}</b>님이 <b>{invite.title}</b> 방을 만들었어요
          </span>
          <div className="mini-call__invite-row">
            <button type="button" className="mini-call__act mini-call__act--primary" onClick={onJoinGame}>
              들어가기
            </button>
            <button type="button" className="mini-call__act" onClick={onDismissInvite}>
              닫기
            </button>
          </div>
        </div>
      )}
      {blocked && (
        <button type="button" className="mini-call__act mini-call__act--primary mini-call__unblock" onClick={onUnblock}>
          소리 켜기
        </button>
      )}
      <div className="mini-call__controls">
        <button type="button" className={`mini-call__btn${micOn ? '' : ' mini-call__btn--off'}`} aria-pressed={!micOn} disabled={!hasMic} onClick={onMic} aria-label={micOn ? '마이크 끄기' : '마이크 켜기'}>
          {micOn ? <IconMic size={18} /> : <IconMicOff size={18} />}
        </button>
        <button type="button" className={`mini-call__btn${deafened ? ' mini-call__btn--off' : ''}`} aria-pressed={deafened} onClick={onDeaf} aria-label={deafened ? '듣기 켜기' : '듣기 끄기'}>
          {deafened ? <IconHeadphoneOff size={18} /> : <IconHeadphones size={18} />}
        </button>
        <button type="button" className="mini-call__btn mini-call__btn--leave" onClick={onLeave} aria-label="통화 나가기">
          <IconPhoneOff size={18} />
        </button>
      </div>
    </div>
  )
}
