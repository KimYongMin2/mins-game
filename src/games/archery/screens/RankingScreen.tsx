import { useEffect, useState } from 'react'
import { currentPlayerId } from '../../../shared/online/supabase'
import { RankingBoard, type RankingBoardData } from '../../../shared/ui/RankingBoard'
import { buildBoards } from '../ranking/leaderboard'
import { fetchLeaderboard } from '../ranking/online'

type Props = {
  onBack: () => void
}

type Loaded =
  | { kind: 'error'; requestKey: number }
  | { kind: 'ready'; requestKey: number; boards: RankingBoardData[]; me: string | null; players: number }

/** 온라인 랭킹: 최고 점수 · 평균 점수 · 한 경기 최다 X (상위 10명) */
export function RankingScreen({ onBack }: Props) {
  const [retry, setRetry] = useState(0)
  const [loaded, setLoaded] = useState<Loaded | null>(null)
  // 다시 시도하면 requestKey가 바뀌어 자동으로 '불러오는 중'이 된다.
  const load = loaded?.requestKey === retry ? loaded : null

  useEffect(() => {
    let cancelled = false
    Promise.all([fetchLeaderboard(), currentPlayerId().catch(() => null)])
      .then(([rows, me]) => {
        if (!cancelled) setLoaded({ kind: 'ready', requestKey: retry, boards: buildBoards(rows), me, players: rows.length })
      })
      .catch(() => {
        if (!cancelled) setLoaded({ kind: 'error', requestKey: retry })
      })
    return () => {
      cancelled = true
    }
  }, [retry])

  return (
    <section className="ar-ranking">
      {!load && <p className="ar-ranking__status">랭킹을 불러오는 중…</p>}
      {load?.kind === 'error' && (
        <div className="ar-ranking__status">
          <p>랭킹을 불러오지 못했어요. 인터넷 연결을 확인해 주세요.</p>
          <button type="button" className="button button--small" onClick={() => setRetry((n) => n + 1)}>
            다시 시도
          </button>
        </div>
      )}
      {load?.kind === 'ready' && (
        <>
          <p className="ar-ranking__status">참가자 {load.players}명</p>
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
