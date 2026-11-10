import type { ReactNode } from 'react'
import type { GameSummary, RouletteRecord } from '../records'
import { TeamResult } from '../../../shared/ui/TeamResult'

type Props = {
  summary: GameSummary
  record: RouletteRecord
  /** 친구 대전: 다시 하기는 방장만 */
  isHost: boolean
  /** 친구 대전에서 사람이 모자라면 다시 못 함 */
  canRetry: boolean
  /** 친구 대전: 친구가 모두 준비하기 전엔 다시 하기를 못 누름 */
  retryLocked?: boolean
  /** 친구 대전 다시 하기 전 준비 (친구 [준비] 버튼 / 방장 쪽 준비 상태) */
  readySlot?: ReactNode
  onRetry: () => void
  onMenu: () => void
}

/** 결과: 순위표 (늦게 탈락할수록 앞) */
export function ResultScreen({ summary, record, isHost, canRetry, retryLocked = false, readySlot, onRetry, onMenu }: Props) {
  const pvp = summary.mode === 'pvp'
  const t = record[summary.mode]
  return (
    <section className="rl-result">
      {summary.team ? (
        <TeamResult outcome={summary.team} detail={`${summary.kills}킬`} />
      ) : (
        <>
          <div className={`rl-result__headline${summary.rank === 1 ? ' rl-result__headline--win' : ''}`}>
            <strong>{summary.rank === 1 ? '생존!' : `${summary.rank}등`}</strong>
            <span>
              {summary.ranking.length}명 중 · {summary.kills}킬
            </span>
          </div>

          <ol className="rl-result__ranking">
            {summary.ranking.map((r, i) => (
              <li key={`${r.name}-${i}`} className={r.me ? 'rl-result__me' : ''}>
                <span>{r.rank}등</span> {r.name}
                {r.kills > 0 && <em>{r.kills}킬</em>}
              </li>
            ))}
          </ol>
        </>
      )}

      <p className="rl-result__career">
        {pvp ? '친구 대전' : '봇 연습'} {t.games}판 · 우승 {t.wins}번 · {t.kills ?? 0}킬
      </p>
      {pvp && (readySlot ?? (!isHost && <p className="rl-result__note">방장이 다시 하기를 누르면 바로 시작해요</p>))}

      <div className="rl-result__buttons">
        {isHost && (
          <button type="button" className="button button--primary" onClick={onRetry} disabled={!canRetry || retryLocked}>
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
