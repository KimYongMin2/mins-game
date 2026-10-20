import type { BombRecord, GameSummary } from '../records'

type Props = {
  summary: GameSummary
  record: BombRecord
  /** 친구 대전: 다시 하기는 방장만 */
  isHost: boolean
  /** 친구 대전에서 방에 혼자 남았으면 다시 못 함 */
  canRetry: boolean
  onRetry: () => void
  onMenu: () => void
}

/** 결과: 순위표 */
export function ResultScreen({ summary, record, isHost, canRetry, onRetry, onMenu }: Props) {
  const pvp = summary.mode === 'pvp'
  const t = record[summary.mode]
  return (
    <section className="bm-result">
      <div className={`bm-result__headline${summary.rank === 1 ? ' bm-result__headline--win' : ''}`}>
        <strong>{summary.rank === 1 ? '우승!' : `${summary.rank}등`}</strong>
        <span>
          {summary.names.length}명 중 · {summary.passes}번 던짐
        </span>
      </div>

      <ol className="bm-result__ranking">
        {summary.names.map((name, i) => (
          <li key={`${name}-${i}`} className={i + 1 === summary.rank ? 'bm-result__me' : ''}>
            <span>{i + 1}등</span> {name}
          </li>
        ))}
      </ol>

      <p className="bm-result__career">
        {pvp ? '친구 대전' : '봇 연습'} {t.games}판 · 우승 {t.wins}번
      </p>
      {pvp && !isHost && <p className="bm-result__note">방장이 다시 하기를 누르면 바로 시작해요</p>}

      <div className="bm-result__buttons">
        {isHost && (
          <button type="button" className="button button--primary" onClick={onRetry} disabled={!canRetry}>
            {canRetry ? '다시 하기' : '친구들이 다 나갔어요'}
          </button>
        )}
        <button type="button" className="button" onClick={onMenu}>
          {pvp ? '나가기' : '처음으로'}
        </button>
      </div>
    </section>
  )
}
