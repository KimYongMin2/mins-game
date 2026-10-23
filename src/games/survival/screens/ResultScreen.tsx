import type { GameSummary, SurvivalRecord } from '../records'

type Props = {
  summary: GameSummary
  record: SurvivalRecord
  /** 친구 대전: 다시 하기는 방장만 */
  isHost: boolean
  /** 친구 대전에서 사람이 모자라면 다시 못 함 */
  canRetry: boolean
  onRetry: () => void
  onMenu: () => void
}

/** 결과: 순위표 (같은 라운드에 탈락하면 같은 등수) */
export function ResultScreen({ summary, record, isHost, canRetry, onRetry, onMenu }: Props) {
  const pvp = summary.mode === 'pvp'
  const t = record[summary.mode]
  return (
    <section className="sv-result">
      <div className={`sv-result__headline${summary.rank === 1 ? ' sv-result__headline--win' : ''}`}>
        <strong>{summary.rank === 1 ? '최후의 1인!' : `${summary.rank}등`}</strong>
        <span>
          {summary.ranking.length}명 중 · {summary.kills}킬
        </span>
      </div>

      <ol className="sv-result__ranking">
        {summary.ranking.map((r, i) => (
          <li key={`${r.name}-${i}`} className={r.me ? 'sv-result__me' : ''}>
            <span>{r.rank}등</span> {r.name}
            {r.kills > 0 && <em>{r.kills}킬</em>}
          </li>
        ))}
      </ol>

      <p className="sv-result__career">
        {pvp ? '친구 대전' : '봇 연습'} {t.games}판 · 우승 {t.wins}번 · {t.kills ?? 0}킬
      </p>
      {pvp && !isHost && <p className="sv-result__note">방장이 다시 하기를 누르면 바로 시작해요</p>}

      <div className="sv-result__buttons">
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
