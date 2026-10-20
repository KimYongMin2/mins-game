import { useEffect, useState } from 'react'
import { currentPlayerId } from '../../../shared/online/supabase'
import { RankingBoard, type RankingBoardData } from '../../../shared/ui/RankingBoard'
import { DIFFICULTY_LABEL, type Difficulty } from '../constants'
import { buildBoards } from '../ranking/leaderboard'
import { fetchLeaderboard } from '../ranking/online'

type Props = {
  initialDifficulty: Difficulty
  onBack: () => void
}

/** 어떤 요청(난이도·재시도 횟수)에 대한 결과인지 함께 저장해, 요청이 바뀌면 자동으로 '불러오는 중'이 된다 */
type Loaded =
  | { kind: 'error'; requestKey: string }
  | { kind: 'ready'; requestKey: string; boards: RankingBoardData[]; me: string | null; players: number }

const DIFFICULTIES: readonly Difficulty[] = ['normal', 'hard']

/** 온라인 랭킹 (난이도별): 승률 · 최다 연승 (상위 10명) */
export function RankingScreen({ initialDifficulty, onBack }: Props) {
  const [difficulty, setDifficulty] = useState(initialDifficulty)
  const [retry, setRetry] = useState(0)
  const [loaded, setLoaded] = useState<Loaded | null>(null)
  const requestKey = `${difficulty}:${retry}`
  const load = loaded?.requestKey === requestKey ? loaded : null

  useEffect(() => {
    let cancelled = false
    Promise.all([fetchLeaderboard(difficulty), currentPlayerId().catch(() => null)])
      .then(([rows, me]) => {
        if (!cancelled) setLoaded({ kind: 'ready', requestKey, boards: buildBoards(rows), me, players: rows.length })
      })
      .catch(() => {
        if (!cancelled) setLoaded({ kind: 'error', requestKey })
      })
    return () => {
      cancelled = true
    }
  }, [difficulty, requestKey])

  return (
    <section className="ft-ranking">
      <div className="ft-ranking__tabs" role="group" aria-label="난이도">
        {DIFFICULTIES.map((d) => (
          <button
            key={d}
            type="button"
            className="button button--small"
            aria-pressed={difficulty === d}
            onClick={() => setDifficulty(d)}
          >
            {DIFFICULTY_LABEL[d]}
          </button>
        ))}
      </div>

      {!load && <p className="ft-ranking__status">랭킹을 불러오는 중…</p>}
      {load?.kind === 'error' && (
        <div className="ft-ranking__status">
          <p>랭킹을 불러오지 못했어요. 인터넷 연결을 확인해 주세요.</p>
          <button type="button" className="button button--small" onClick={() => setRetry((n) => n + 1)}>
            다시 시도
          </button>
        </div>
      )}
      {load?.kind === 'ready' && (
        <>
          <p className="ft-ranking__status">참가자 {load.players}명</p>
          {load.boards.map((b) => (
            <RankingBoard key={b.key} board={b} me={load.me} />
          ))}
        </>
      )}
      <button type="button" className="button" onClick={onBack}>
        돌아가기
      </button>
    </section>
  )
}
