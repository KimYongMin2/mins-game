import type { UploadStatus } from '../../../shared/online/uploadQueue'
import { DIFFICULTY_LABEL, HAND_LABEL, TOTAL_PITCHES } from '../constants'
import { timingText } from '../game/describe'
import { PITCH_LABEL } from '../play/pitch'
import type { SessionSummary } from '../play/session'
import { type BattingRecord, averageOf } from '../records'
import { CONTACT_LABEL, OUTCOME_LABEL } from '../rules/judge'
import { OUTCOME_POINTS, isHit } from '../rules/scoring'

type Props = {
  summary: SessionSummary
  record: BattingRecord
  newBest: boolean
  /** 온라인 랭킹을 붙이기 전에는 없음 */
  upload?: UploadStatus
  onRetry: () => void
  onRanking?: () => void
  onMenu: () => void
}

const UPLOAD_TEXT: Record<UploadStatus, string> = {
  saving: '랭킹에 기록을 올리는 중…',
  saved: '랭킹에 기록을 올렸어요',
  queued: '지금은 올리지 못했어요. 다음에 접속할 때 다시 올릴게요',
}

export function ResultScreen({ summary, record, newBest, upload, onRetry, onRanking, onMenu }: Props) {
  const level = record[summary.difficulty]
  const avg = averageOf(level)
  return (
    <section className="bt-result">
      <div className={`bt-result__headline${newBest ? ' bt-result__headline--best' : ''}`}>
        {newBest && <span className="bt-result__badge">개인 최고 기록!</span>}
        <strong>{summary.points}점</strong>
        <span>
          홈런 {summary.homeruns}개 · 안타 이상 {summary.hits}/{TOTAL_PITCHES}
        </span>
        <span className="bt-result__mode">
          {DIFFICULTY_LABEL[summary.difficulty]} · {HAND_LABEL[summary.hand]}
        </span>
      </div>

      <table className="bt-result__table">
        <caption className="bt-visually-hidden">공별 결과</caption>
        <thead>
          <tr>
            <th scope="col">#</th>
            <th scope="col">공</th>
            <th scope="col">터치</th>
            <th scope="col">결과</th>
          </tr>
        </thead>
        <tbody>
          {summary.records.map((r) => (
            <tr key={r.index} className={r.outcome === 'homerun' ? 'bt-result__row--hr' : isHit(r.outcome) ? 'bt-result__row--hit' : ''}>
              <td>{r.index + 1}</td>
              <td>
                {PITCH_LABEL[r.pitch.type]} {r.pitch.cell}
              </td>
              <td>{r.touched ?? '-'}</td>
              <td>
                <strong>{OUTCOME_LABEL[r.outcome]}</strong>
                {isHit(r.outcome) && ` +${OUTCOME_POINTS[r.outcome]}`}
                {r.offsetMs !== null && r.contact !== 'miss' && (
                  <span className="bt-result__detail">
                    {r.contact && r.contact !== 'sweet' && `${CONTACT_LABEL[r.contact]} · `}
                    {timingText(r.offsetMs, summary.difficulty)}
                  </span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <p className="bt-result__career">
        {DIFFICULTY_LABEL[summary.difficulty]} 최고 {level.best ? level.best.points : '-'}점 · 평균{' '}
        {avg === null ? '-' : avg.toFixed(1)}점 · {level.games}경기
      </p>

      {upload && (
        <p className={`bt-result__upload bt-result__upload--${upload}`} aria-live="polite">
          {UPLOAD_TEXT[upload]}
        </p>
      )}

      <div className="bt-result__buttons">
        <button type="button" className="button button--primary" onClick={onRetry}>
          다시 하기
        </button>
        {onRanking && (
          <button type="button" className="button" onClick={onRanking}>
            랭킹
          </button>
        )}
        <button type="button" className="button" onClick={onMenu}>
          처음으로
        </button>
      </div>
    </section>
  )
}
