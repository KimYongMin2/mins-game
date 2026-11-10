import { useState } from 'react'
import { pvpLink } from '../nav'

// 초대 링크 보내기 (사용자 요청): 방 주소(그 게임 + ?mode=pvp&join=방&name=..&pin=..)를 폰이면 공유 창으로(카톡 등), 아니면 복사.
// 친구가 링크를 누르면 바로 그 방으로 들어온다(닉네임이 없으면 닉네임을 정한 뒤 다시 그 링크로).

export function inviteUrl(room: { id: string; name: string }, pin: string | null): string {
  return window.location.origin + pvpLink(window.location.pathname, { kind: 'join', room, pin })
}

export function InviteButton({ room, pin, game }: { room: { id: string; name: string }; pin: string | null; game?: string }) {
  const [note, setNote] = useState<string | null>(null)
  async function invite() {
    const url = inviteUrl(room, pin)
    const text = `${game ? `${game} ` : ''}'${room.name}'에 들어와`
    try {
      if (navigator.share) {
        await navigator.share({ title: '미니게임 초대', text, url })
        return
      }
    } catch (e) {
      // 공유 창을 닫은 건 그냥 둔다
      if ((e as Error)?.name === 'AbortError') return
    }
    try {
      await navigator.clipboard.writeText(url)
      setNote('링크를 복사했어요 · 친구에게 붙여 넣어 보내세요')
    } catch {
      setNote(url)
    }
  }
  return (
    <div className="invite">
      <button type="button" className="button invite__button" onClick={() => void invite()}>
        초대 링크 보내기
      </button>
      {note && <p className="invite__note">{note}</p>}
    </div>
  )
}
