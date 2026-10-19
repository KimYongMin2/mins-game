import { Link } from 'react-router'
import { GAMES } from './gameList'

type Props = {
  nickname: string
}

export function MainPage({ nickname }: Props) {
  return (
    <main className="page">
      <header className="main__header">
        <div>
          <h1 className="title">미니게임 모음</h1>
          <p className="subtitle">
            <strong className="main__nickname">{nickname}</strong>님, 어떤 게임 할래요?
          </p>
        </div>
        <Link className="button button--small" to="/nickname">
          닉네임 변경
        </Link>
      </header>

      <ul className="game-list">
        {GAMES.map((game) =>
          game.ready ? (
            <li key={game.id}>
              <Link className="game-card" to={game.path}>
                <span className="game-card__title">{game.title}</span>
                <span className="game-card__desc">{game.description}</span>
              </Link>
            </li>
          ) : (
            <li key={game.id}>
              <div className="game-card game-card--disabled" aria-disabled="true">
                <span className="game-card__title">
                  {game.title}
                  <span className="badge">준비 중</span>
                </span>
                <span className="game-card__desc">{game.description}</span>
              </div>
            </li>
          ),
        )}
      </ul>
    </main>
  )
}
