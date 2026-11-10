import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router'
import { pvpLink, switchTargets } from '../nav'
import { type Room, makeRoomCode } from '../online/room'

// 대기실 '게임 바꾸기' (사용자 요청): 친구들이 모인 채로 방장이 다른 게임을 고르면 다 같이 그 게임 방으로 넘어간다.
// 방장이 같은 이름·코드로 새 게임 방을 만들며(정해 둔 방 번호) 친구들에게 '여기로 옮겨'(room.sendMove)를 보내고,
// 친구들은 받으면 그 방으로 바로 들어간다(주소 꼬리 ?mode=pvp&join=…). 새 방에선 다시 준비. 게임 규칙은 모른다.

type SwitchRoom = Pick<Room<never>, 'role' | 'code' | 'name' | 'sendMove' | 'onMove'>

export function GameSwitch({ room, gameId, people }: { room: SwitchRoom; gameId: string; people: number }) {
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [moving, setMoving] = useState<string | null>(null)
  const [warn, setWarn] = useState<string | null>(null)

  // 친구: 방장이 옮기면 따라간다 (방장이 새 방을 여는 동안 조금 기다렸다가 — 들어가는 쪽도 몇 초는 방장을 기다려 줌)
  useEffect(() => {
    if (room.role !== 'guest') return
    return room.onMove((m) => {
      const title = switchTargets().find((t) => t.path === m.path)?.title ?? '다른 게임'
      setMoving(title)
      setTimeout(() => navigate(pvpLink(m.path, { kind: 'join', room: { id: m.id, name: m.name }, pin: m.pin }), { replace: true }), 700)
    })
  }, [room, navigate])

  if (room.role === 'guest') return moving ? <p className="game-switch__moving">방장이 {moving}(으)로 바꿨어요 · 옮기는 중…</p> : null

  const pin = room.code.includes('-') ? room.code.split('-')[1] : null
  const options = switchTargets().filter((t) => t.id !== gameId)
  function go(path: string) {
    const id = makeRoomCode()
    const name = room.name ?? '방'
    room.sendMove({ path, id, name, pin })
    navigate(pvpLink(path, { kind: 'create', name, pin, id }), { replace: true })
  }

  return (
    <div className="game-switch">
      <button type="button" className="button button--small game-switch__toggle" aria-expanded={open} onClick={() => {
          setOpen(!open)
          setWarn(null)
        }}>
        게임 바꾸기
      </button>
      {open && (
        <div className="game-switch__list" role="list">
          {options.map((t) => {
            const fits = people <= t.max
            return (
              <button
                key={t.id}
                type="button"
                role="listitem"
                className={`game-switch__item${fits ? '' : ' game-switch__item--full'}`}
                aria-disabled={!fits}
                onClick={() => (fits ? go(t.path) : setWarn(`지금 ${people}명이 모여 있어서 ${t.title}(${t.min === t.max ? `${t.max}명` : `최대 ${t.max}명`})(으)로는 바꿀 수 없어요`))}
              >
                <span className="game-switch__title">{t.title}</span>
                <span className="game-switch__size">{t.min === t.max ? `${t.min}명` : `${t.min}–${t.max}명`}</span>
              </button>
            )
          })}
          {warn && (
            <p className="game-switch__warn" role="alert">
              {warn}
            </p>
          )}
          <p className="game-switch__note">고르면 지금 모인 친구들이 다 같이 넘어가요 · 인원이 넘치는 게임은 바꿀 수 없어요</p>
        </div>
      )}
    </div>
  )
}
