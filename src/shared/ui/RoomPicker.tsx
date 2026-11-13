import { type ReactNode, useEffect, useState } from 'react'
import { type ListedRoom, PIN_LENGTH, gameListId, readListedRoom } from '../online/room'
import { ROOM_NAME_MAX, cleanList, watchRooms } from '../online/roomList'

// 친구 대전 방 고르기: 그 게임의 열린 방 목록 + 방 만들기(이름 · 전체 공개 / 🔒 비공개 숫자 코드).
// 비공개 방도 목록에 🔒로 보이고, 누르면 코드를 묻는다. 시작한 방('게임 중')·가득 찬 방은 못 누른다.
// 방에 실제로 들어가는 건 부르는 쪽(대기실)이 한다. 게임 규칙은 모른다.


const randomPin = () => String(Math.floor(Math.random() * 10 ** PIN_LENGTH)).padStart(PIN_LENGTH, '0')

type Props = {
  gameId: string
  nickname: string
  /** 방 만들기: 이름과, 비공개면 코드 */
  onCreate: (name: string, pin: string | null) => void
  /** 목록에서 고름: 비공개면 입력한 코드 */
  onJoin: (room: ListedRoom, pin: string | null) => void
  error?: string
  /** [방 만들기] 옆에 나란히 놓을 버튼 (메인 게임 창의 [봇이랑 연습]) */
  side?: ReactNode
}

export function RoomPicker({ gameId, nickname, onCreate, onJoin, error, side }: Props) {
  const [creating, setCreating] = useState(false)
  if (creating) return <CreateForm nickname={nickname} onCreate={onCreate} onBack={() => setCreating(false)} />
  return <RoomList gameId={gameId} onJoin={onJoin} onCreate={() => setCreating(true)} error={error} side={side} />
}

function RoomList({ gameId, onJoin, onCreate, error, side }: { gameId: string; onJoin: Props['onJoin']; onCreate: () => void; error?: string; side?: ReactNode }) {
  const [rooms, setRooms] = useState<ListedRoom[] | null>(null)
  const [offline, setOffline] = useState(false)
  const [asking, setAsking] = useState<string | null>(null)
  const [pin, setPin] = useState('')
  useEffect(() => watchRooms<object>(gameListId(gameId), (raw) => setRooms(cleanList(raw, readListedRoom)), () => setOffline(true)), [gameId])

  // 들어갈 수 있는 방 먼저, 그다음 최근에 만든 순
  const open = (r: ListedRoom) => !r.playing && r.count < r.capacity
  const sorted = [...(rooms ?? [])].sort((a, b) => Number(open(b)) - Number(open(a)) || b.at - a.at)
  return (
    <div className="room-pick">
      <div className={`room-pick__actions${side ? ' room-pick__actions--two' : ''}`}>
        {side}
        <button type="button" className="button button--primary pvp-lobby__big" onClick={onCreate}>
          방 만들기
        </button>
      </div>
      {error && (
        <p className="error pvp-lobby__error" role="alert">
          {error}
        </p>
      )}
      <h2 className="room-pick__title">열린 방</h2>
      {offline ? (
        <p className="room-pick__tip">서버에 연결하지 못했어요. 인터넷 연결을 확인해 주세요</p>
      ) : rooms === null ? (
        <p className="room-pick__tip">불러오는 중…</p>
      ) : sorted.length === 0 ? (
        <p className="room-pick__tip">열린 방이 없어요. 새로 만들어 보세요</p>
      ) : (
        <ol className="room-pick__rooms">
          {sorted.map((r, i) => (
            <li key={r.id} className="room-pick__item">
              <button
                type="button"
                className="room-pick__room"
                disabled={!open(r)}
                onClick={() => {
                  if (!r.locked) return onJoin(r, null)
                  setAsking(asking === r.id ? null : r.id)
                  setPin('')
                }}
              >
                <span className="room-pick__no">{i + 1}</span>
                <span className="room-pick__name">
                  {r.name}
                  {r.locked && <span className="open-rooms__lock">비공개</span>}
                </span>
                <span className="room-pick__count">{r.playing ? '게임 중' : r.count >= r.capacity ? '가득' : `${r.count}/${r.capacity}명`}</span>
              </button>
              {asking === r.id && open(r) && (
                <form
                  className="pvp-lobby__join"
                  onSubmit={(e) => {
                    e.preventDefault()
                    if (pin.length === PIN_LENGTH) onJoin(r, pin)
                  }}
                >
                  <input
                    className="input pvp-lobby__input"
                    value={pin}
                    onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, PIN_LENGTH))}
                    placeholder={`코드 ${PIN_LENGTH}자리`}
                    inputMode="numeric"
                    autoComplete="off"
                    autoFocus
                    aria-label="비공개 방 코드"
                  />
                  <button type="submit" className="button" disabled={pin.length !== PIN_LENGTH}>
                    들어가기
                  </button>
                </form>
              )}
            </li>
          ))}
        </ol>
      )}
    </div>
  )
}

/** 방 만들기: 이름·공개 여부·코드. 비우면 이름은 'OO님의 방', 코드는 추천 숫자 */
function CreateForm({ nickname, onCreate, onBack }: { nickname: string; onCreate: Props['onCreate']; onBack: () => void }) {
  const [name, setName] = useState('')
  const [locked, setLocked] = useState(false)
  const [pin, setPin] = useState('')
  const [suggested] = useState(randomPin)
  const defaultName = `${nickname}님의 방`
  const pinOk = pin.length === 0 || pin.length === PIN_LENGTH
  return (
    <form
      className="room-pick"
      onSubmit={(e) => {
        e.preventDefault()
        if (pinOk) onCreate(name.trim() || defaultName, locked ? pin || suggested : null)
      }}
    >
      <label className="room-pick__field">
        <span>방 이름</span>
        <input className="input" value={name} onChange={(e) => setName(e.target.value.slice(0, ROOM_NAME_MAX))} placeholder={defaultName} autoComplete="off" />
      </label>
      <div className="room-pick__field" role="radiogroup" aria-label="공개 여부">
        <span>공개</span>
        <div className="room-pick__toggle">
          {[false, true].map((v) => (
            <button
              key={String(v)}
              type="button"
              role="radio"
              aria-checked={locked === v}
              className={`button${locked === v ? ' button--primary' : ''}`}
              onClick={() => setLocked(v)}
            >
              {v ? '비공개' : '전체 공개'}
            </button>
          ))}
        </div>
        <small>{locked ? '목록엔 보이지만 코드를 알아야 들어와요' : '목록에서 누구나 들어와요'}</small>
      </div>
      {locked && (
        <label className="room-pick__field">
          <span>
            코드 (숫자 {PIN_LENGTH}자리, 비우면 {suggested})
          </span>
          <input
            className="input pvp-lobby__input"
            value={pin}
            onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, PIN_LENGTH))}
            placeholder={suggested}
            inputMode="numeric"
            autoComplete="off"
          />
          {!pinOk && <small className="error">{PIN_LENGTH}자리로 입력하거나 비워 두세요</small>}
        </label>
      )}
      <button type="submit" className="button button--primary pvp-lobby__big" disabled={!pinOk}>
        만들기
      </button>
      <button type="button" className="button button--small" onClick={onBack}>
        취소
      </button>
    </form>
  )
}

/** 대기실에 보여 줄 방 이름·공개 여부 한 줄 */
export function RoomBadge({ name, pin }: { name: string; pin: string | null }) {
  return (
    <div className="pvp-lobby__code-box">
      <strong className="room-pick__room-name">{name}</strong>
      <span className="pvp-lobby__label">
        {pin ? (
          <>
            비공개 · 코드 <b className="room-pick__pin">{pin}</b> — 친구에게 코드를 알려 주세요
          </>
        ) : (
          '전체 공개 — 친구가 목록에서 눌러 들어와요'
        )}
      </span>
    </div>
  )
}
