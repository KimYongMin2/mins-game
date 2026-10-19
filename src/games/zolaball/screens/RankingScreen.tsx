import { useEffect, useState } from 'react'
import { currentPlayerId } from '../../../shared/online/supabase'
import { type Board, buildBoards } from '../ranking/leaderboard'
import { fetchLeaderboard } from '../ranking/online'
import type { Difficulty } from '../rules/judge'

type Props = {
  initialDifficulty?: Difficulty
  onBack: () => void
}

type Load =
  | { kind: 'loading' }
  | { kind: 'error' }
  | { kind: 'ready'; boards: Board[]; me: string | null; players: number }

/** 어떤 요청(난이도·재시도 횟수)에 대한 결과인지 함께 저장해, 요청이 바뀌면 자동으로 '불러오는 중'이 된다. */
type Loaded = Exclude<Load, { kind: 'loading' }> & { requestKey: string }

const DIFFICULTIES: { value: Difficulty; label: string }[] = [
  { value: 'normal', label: '일반' },
  { value: 'hard', label: '어려움' },
]

function BoardCard({ board, me }: { board: Board; me: string | null }) {
  return (
    <section className="zb-board">
      <header className="zb-board__header">
        <h2 className="zb-board__title">{board.title}</h2>
        <span className="zb-board__rule">{board.rule}</span>
      </header>
      {board.entries.length === 0 ? (
        <p className="zb-board__empty">아직 조건을 채운 사람이 없어요</p>
      ) : (
        <ol className="zb-board__list">
          {board.entries.map((e) => (
            <li
              key={e.playerId}
              className={e.playerId === me ? 'zb-board__row zb-board__row--me' : 'zb-board__row'}
            >
              <span className="zb-board__rank">{e.rank}</span>
              <span className="zb-board__name">
                {e.nickname}
                {e.playerId === me && <span className="zb-board__me">나</span>}
              </span>
              <span className="zb-board__value">{e.display}</span>
              <span className="zb-board__detail">{e.detail}</span>
            </li>
          ))}
        </ol>
      )}
    </section>
  )
}

/** 온라인 랭킹 (난이도별, 상위 10명) */
export function RankingScreen({ initialDifficulty = 'normal', onBack }: Props) {
  const [difficulty, setDifficulty] = useState<Difficulty>(initialDifficulty)
  const [retry, setRetry] = useState(0)
  const [loaded, setLoaded] = useState<Loaded | null>(null)
  const requestKey = `${difficulty}:${retry}`
  const load: Load = loaded?.requestKey === requestKey ? loaded : { kind: 'loading' }

  useEffect(() => {
    let cancelled = false
    Promise.all([fetchLeaderboard(difficulty), currentPlayerId().catch(() => null)])
      .then(([rows, me]) => {
        if (!cancelled) setLoaded({ requestKey, kind: 'ready', boards: buildBoards(rows), me, players: rows.length })
      })
      .catch(() => {
        if (!cancelled) setLoaded({ requestKey, kind: 'error' })
      })
    return () => {
      cancelled = true
    }
  }, [difficulty, requestKey])

  return (
    <section className="zb-ranking">
      <div className="zb-toggle zb-ranking__tabs" role="group" aria-label="난이도">
        {DIFFICULTIES.map((d) => (
          <button
            key={d.value}
            type="button"
            className="button button--small"
            aria-pressed={difficulty === d.value}
            onClick={() => setDifficulty(d.value)}
          >
            {d.label}
          </button>
        ))}
      </div>

      {load.kind === 'loading' && <p className="zb-ranking__status">랭킹을 불러오는 중…</p>}
      {load.kind === 'error' && (
        <div className="zb-ranking__status">
          <p>랭킹을 불러오지 못했어요. 인터넷 연결을 확인해 주세요.</p>
          <button type="button" className="button button--small" onClick={() => setRetry((n) => n + 1)}>
            다시 시도
          </button>
        </div>
      )}
      {load.kind === 'ready' && (
        <>
          <p className="zb-ranking__status">참가자 {load.players}명</p>
          {load.boards.map((b) => (
            <BoardCard key={b.key} board={b} me={load.me} />
          ))}
        </>
      )}

      <button type="button" className="button" onClick={onBack}>
        돌아가기
      </button>
    </section>
  )
}
