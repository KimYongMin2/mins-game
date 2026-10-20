import type { GameSummary, YutRecord } from '../records'

type Props = {
  summary: GameSummary
  record: YutRecord
  /** 친구 대전: 다시 하기는 방장만 */
  isHost: boolean
  canRetry: boolean
  onRetry: () => void
  onMenu: () => void
}

/** 결과: 우승자와 나간 말 수 */
export function ResultScreen({ summary, record, isHost, canRetry, onRetry, onMenu }: Props) {
  const pvp = summary.mode === 'pvp'
  const t = record[summary.mode]
  const winner = summary.standings.find((s) => s.winner)
  return (
    <section className="yt-result">
      <div className={`yt-result__headline${summary.won ? ' yt-result__headline--win' : ''}`}>
        <strong>{summary.won ? '우승!' : '아쉬워요'}</strong>
        <span>{winner ? `${winner.name} 님이 말을 다 내보냈어요` : ''}</span>
      </div>

      <ol className="yt-result__ranking">
        {summary.standings.map((s, i) => (
          <li key={`${s.name}-${i}`}>
            <span>{s.winner ? '우승' : `${i + 1}등`}</span> {s.name}
            <em>
              나감 {s.out}/{s.total}
            </em>
          </li>
        ))}
      </ol>

      <p className="yt-result__career">
        {pvp ? '친구 대전' : '봇 연습'} {t.games}판 · 우승 {t.wins}번
      </p>
      {pvp && !isHost && <p className="yt-result__note">방장이 다시 하기를 누르면 바로 시작해요</p>}

      <div className="yt-result__buttons">
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
