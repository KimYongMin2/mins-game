// 랭킹 한 판(상위 N명 목록). 어떤 게임이든 같은 모양으로 보여준다.

export type RankingEntry = {
  rank: number
  playerId: string
  nickname: string
  /** 화면에 보여줄 값 (.667, 93.4점 등) */
  display: string
  /** 보조 설명 (3승 1패, X 2개 등) */
  detail: string
}

export type RankingBoardData = {
  key: string
  title: string
  /** 순위에 오르는 조건 등 짧은 설명 */
  rule: string
  entries: RankingEntry[]
}

type Props = {
  board: RankingBoardData
  /** 내 플레이어 id. 내 줄을 강조한다 */
  me: string | null
}

export function RankingBoard({ board, me }: Props) {
  return (
    <section className="rank-board">
      <header className="rank-board__header">
        <h2 className="rank-board__title">{board.title}</h2>
        <span className="rank-board__rule">{board.rule}</span>
      </header>
      {board.entries.length === 0 ? (
        <p className="rank-board__empty">아직 조건을 채운 사람이 없어요</p>
      ) : (
        <ol className="rank-board__list">
          {board.entries.map((e) => (
            <li key={e.playerId} className={e.playerId === me ? 'rank-board__row rank-board__row--me' : 'rank-board__row'}>
              <span className="rank-board__rank">{e.rank}</span>
              <span className="rank-board__name">
                {e.nickname}
                {e.playerId === me && <span className="rank-board__me">나</span>}
              </span>
              <span className="rank-board__value">{e.display}</span>
              <span className="rank-board__detail">{e.detail}</span>
            </li>
          ))}
        </ol>
      )}
    </section>
  )
}
