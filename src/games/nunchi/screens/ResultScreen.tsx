import type { GameSummary, NunchiRecord } from '../records'

type Props = {
  summary: GameSummary
  record: NunchiRecord
  /** 친구 대전: 다시 하기는 방장만 */
  isHost: boolean
  /** 친구 대전에서 사람이 모자라면 다시 못 함 */
  canRetry: boolean
  onRetry: () => void
  onMenu: () => void
}

/** 결과: 순위표 (같은 판에 탈락하면 같은 등수) */
export function ResultScreen({ summary, record, isHost, canRetry, onRetry, onMenu }: Props) {
  const pvp = summary.mode === 'pvp'
  const t = record[summary.mode]
  const myName = summary.ranking.find((r) => r.rank === summary.rank)
  return (
    <section className="nc-result">
      <div className={`nc-result__headline${summary.rank === 1 ? ' nc-result__headline--win' : ''}`}>
        <strong>{summary.rank === 1 ? '우승!' : `${summary.rank}등`}</strong>
        <span>{summary.ranking.length}명 중</span>
      </div>

      <ol className="nc-result__ranking">
        {summary.ranking.map((r, i) => (
          <li key={`${r.name}-${i}`} className={r === myName ? 'nc-result__me' : ''}>
            <span>{r.rank}등</span> {r.name}
          </li>
        ))}
      </ol>

      <p className="nc-result__career">
        {pvp ? '친구 대전' : '봇 연습'} {t.games}판 · 우승 {t.wins}번
      </p>
      {pvp && !isHost && <p className="nc-result__note">방장이 다시 하기를 누르면 바로 시작해요</p>}

      <div className="nc-result__buttons">
        {isHost && (
          <button type="button" className="button button--primary" onClick={onRetry} disabled={!canRetry}>
            {canRetry ? '다시 하기' : '사람이 모자라요'}
          </button>
        )}
        <button type="button" className="button" onClick={onMenu}>
          {pvp ? '나가기' : '처음으로'}
        </button>
      </div>
    </section>
  )
}
