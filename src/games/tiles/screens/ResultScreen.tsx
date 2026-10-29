import type { GameSummary, TilesRecord } from '../records'

type Props = {
  summary: GameSummary
  record: TilesRecord
  /** 친구 대전: 다시 하기는 방장만 */
  isHost: boolean
  canRetry: boolean
  onRetry: () => void
  onMenu: () => void
}

/** 결과: 우승자와 남은 타일 */
export function ResultScreen({ summary, record, isHost, canRetry, onRetry, onMenu }: Props) {
  const pvp = summary.mode === 'pvp'
  const t = record[summary.mode]
  const winner = summary.standings[0]
  return (
    <section className="nt-result">
      <div className={`nt-result__headline${summary.won ? ' nt-result__headline--win' : ''}`}>
        <strong>{summary.won ? '우승!' : '아쉬워요'}</strong>
        <span>
          {winner && (winner.tiles === 0 ? `${winner.name} 님이 손패를 다 털었어요` : `더미가 떨어져 남은 점수가 가장 적은 ${winner.name} 님 우승`)}
        </span>
      </div>

      <ol className="nt-result__ranking">
        {summary.standings.map((s, i) => (
          <li key={`${s.name}-${i}`} className={s.me ? 'nt-result__me' : undefined}>
            <span>{i === 0 ? '우승' : `${i + 1}등`}</span> {s.name}
            <em>{s.tiles === 0 ? '다 털음' : `${s.tiles}장 · ${s.value}점 남음`}</em>
          </li>
        ))}
      </ol>

      <p className="nt-result__career">
        {pvp ? '친구 대전' : '봇 연습'} {t.games}판 · 우승 {t.wins}번
      </p>
      {pvp && !isHost && <p className="nt-result__note">방장이 다시 하기를 누르면 바로 시작해요</p>}

      <div className="nt-result__buttons">
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
