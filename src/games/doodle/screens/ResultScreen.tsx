import type { ReactNode } from 'react'
import type { DoodleRecord, GameSummary } from '../records'

type Props = {
  summary: GameSummary
  record: DoodleRecord
  isHost: boolean
  canRetry: boolean
  retryLocked: boolean
  readySlot?: ReactNode
  onRetry: () => void
  onMenu: () => void
}

/** 결과: 점수 순위표 */
export function ResultScreen({ summary, record, isHost, canRetry, retryLocked, readySlot, onRetry, onMenu }: Props) {
  return (
    <section className="dd-result">
      <div className={`dd-result__headline${summary.rank === 1 ? ' dd-result__headline--win' : ''}`}>
        <strong>{summary.rank === 1 ? '우승!' : `${summary.rank}등`}</strong>
        <span>
          {summary.ranking.length}명 중 · {summary.score}점
        </span>
      </div>
      <ol className="dd-result__ranking">
        {summary.ranking.map((r, i) => (
          <li key={`${r.name}-${i}`} className={r.me ? 'dd-result__me' : ''}>
            <span>{r.rank}등</span> {r.name} <b>{r.score}점</b>
          </li>
        ))}
      </ol>
      <p className="dd-result__career">
        친구 대전 {record.games}판 · 우승 {record.wins}번 · 최고 {record.best}점
      </p>
      {readySlot ?? (!isHost && <p className="dd-result__note">방장이 다시 하기를 누르면 바로 시작해요</p>)}
      <div className="dd-result__buttons">
        {isHost && (
          <button type="button" className="button button--primary" onClick={onRetry} disabled={!canRetry || retryLocked}>
            {canRetry ? '다시 하기' : '친구들이 다 나갔어요'}
          </button>
        )}
        <button type="button" className="button" onClick={onMenu}>
          나가기
        </button>
      </div>
    </section>
  )
}
