import { useEffect, useState } from 'react'
import { type ListedRoom, PIN_LENGTH, gameListId, readListedRoom } from '../shared/online/room'
import { cleanList, watchRooms } from '../shared/online/roomList'
import type { GameEntry } from './gameList'

// 메인 '지금 열린 방' (사용자 요청): 친구 대전 되는 게임마다 방 목록(presence)을 지켜보다가, 들어갈 수 있는 방을 모아 보여준다.
// 메인에 있을 때만 지켜보고 떠나면 끊는다. 열린 방이 없으면 칸째 숨긴다. 누르면 그 방으로 바로(비공개면 코드를 묻는다).

type Found = { game: GameEntry; room: ListedRoom }

export function OpenRooms({ games, onJoin }: { games: GameEntry[]; onJoin: (game: GameEntry, room: ListedRoom, pin: string | null) => void }) {
  const [byGame, setByGame] = useState<Record<string, ListedRoom[]>>({})
  const [asking, setAsking] = useState<string | null>(null)
  const [pin, setPin] = useState('')
  const ids = games.map((g) => g.id).join()
  useEffect(() => {
    const stops = games.map((g) =>
      watchRooms<object>(
        gameListId(g.id),
        (raw) => setByGame((prev) => ({ ...prev, [g.id]: cleanList(raw, readListedRoom) })),
        () => {},
      ),
    )
    return () => stops.forEach((stop) => stop())
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ids])

  const found: Found[] = games
    .flatMap((game) => (byGame[game.id] ?? []).filter((r) => !r.playing && r.count < r.capacity).map((room) => ({ game, room })))
    .sort((a, b) => b.room.at - a.room.at)
  if (found.length === 0) return null

  return (
    <section className="open-rooms" aria-label="지금 열린 방">
      <h2 className="shelf-head__title">지금 열린 방</h2>
      <ul className="open-rooms__list">
        {found.map(({ game, room }) => {
          const key = `${game.id}:${room.id}`
          return (
            <li key={key}>
              <button
                type="button"
                className="open-rooms__room"
                onClick={() => {
                  if (!room.locked) return onJoin(game, room, null)
                  setAsking(asking === key ? null : key)
                  setPin('')
                }}
              >
                <img className="open-rooms__cover" src={`/covers/${game.id}.jpg`} alt="" loading="lazy" />
                <span className="open-rooms__body">
                  <span className="open-rooms__name">
                    {room.name}
                    {room.locked && <span className="open-rooms__lock">비공개</span>}
                  </span>
                  <span className="open-rooms__game">{game.title}</span>
                </span>
                <span className="open-rooms__count">
                  {room.count}/{room.capacity}명
                </span>
              </button>
              {asking === key && (
                <form
                  className="pvp-lobby__join"
                  onSubmit={(e) => {
                    e.preventDefault()
                    if (pin.length === PIN_LENGTH) onJoin(game, room, pin)
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
          )
        })}
      </ul>
    </section>
  )
}
