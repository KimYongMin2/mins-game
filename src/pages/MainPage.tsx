import { Link } from 'react-router'
import { GAMES, type GameEntry } from './gameList'

/** 친구랑 할 수 있는 게임과 혼자 하는 게임을 나눠 보여준다 */
const SECTIONS: { play: GameEntry['play']; title: string; note: string }[] = [
  { play: 'pvp', title: '친구랑 같이', note: '친구 대전 · 봇 대전' },
  { play: 'solo', title: '혼자 하기', note: '기록 도전 · 랭킹' },
]

/** 인원 표시 색: 혼자 / 둘 / 여럿 */
const sizeOf = (players: string) => (players === '1인' ? 'solo' : players === '2인' ? 'duo' : 'group')

function GameCard({ game }: { game: GameEntry }) {
  if (!game.ready) {
    return (
      <div className="game-card game-card--disabled" aria-disabled="true">
        <span className="game-card__title">
          {game.title}
          <span className="badge">준비 중</span>
        </span>
        <span className="game-card__desc">{game.description}</span>
      </div>
    )
  }
  return (
    <Link className="game-card" to={game.path}>
      <span className="game-card__title">{game.title}</span>
      <span className="game-card__desc">{game.description}</span>
      <span className={`badge badge--count badge--${sizeOf(game.players)}`}>{game.players}</span>
    </Link>
  )
}

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

      {SECTIONS.map((section) => (
        <section key={section.play} className="game-section">
          <h2 className="game-section__title">
            {section.title}
            <span className="game-section__note">{section.note}</span>
          </h2>
          <ul className="game-list">
            {GAMES.filter((g) => g.play === section.play).map((game) => (
              <li key={game.id}>
                <GameCard game={game} />
              </li>
            ))}
          </ul>
        </section>
      ))}
    </main>
  )
}
