import { type UploadStatus, lastUploadError } from '../../../shared/online/uploadQueue'
import { ROUNDS } from '../constants'
import type { RoundSummary } from '../play/roundState'
import { type ArcheryRecord, averageOf } from '../records'
import { formatArrow, formatPoints, totalOf } from '../rules/scoring'

type Props = {
  summary: RoundSummary
  record: ArcheryRecord
  newBest: boolean
  upload: UploadStatus
  onRetry: () => void
  onRanking: () => void
  onMenu: () => void
}

const UPLOAD_TEXT: Record<UploadStatus, string> = {
  saving: '랭킹에 기록을 올리는 중…',
  saved: '랭킹에 기록을 올렸어요',
  queued: '지금은 올리지 못했어요. 다음에 접속할 때 다시 올릴게요',
}

export function ResultScreen({ summary, record, newBest, upload, onRetry, onRanking, onMenu }: Props) {
  const avg = averageOf(record)
  return (
    <section className="ar-result">
      <div className={`ar-result__headline${newBest ? ' ar-result__headline--best' : ''}`}>
        {newBest && <span className="ar-result__badge">개인 최고 기록!</span>}
        <strong>{formatPoints(summary.points)}점</strong>
        <span>
          X {summary.xCount}개 · 10점 {summary.tenCount}개
        </span>
      </div>

      <table className="ar-result__table">
        <caption className="ar-visually-hidden">거리별 점수</caption>
        <tbody>
          {ROUNDS.map((round) => {
            const shots = summary.shots.filter((s) => s.distance === round.distance)
            const sub = totalOf(shots.map((s) => s.score))
            return (
              <tr key={round.distance}>
                <th scope="row">{round.distance}m</th>
                <td>
                  <div className="ar-result__arrows">
                    {shots.map((s) => (
                      <span
                        key={s.index}
                        className={`ar-result__arrow${s.score.ring === 10 ? ' ar-result__arrow--gold' : ''}${s.score.x ? ' ar-result__arrow--x' : ''}`}
                      >
                        {formatArrow(s.score)}
                      </span>
                    ))}
                  </div>
                </td>
                <td className="ar-result__sub">{formatPoints(sub.points)}</td>
              </tr>
            )
          })}
        </tbody>
      </table>

      <p className="ar-result__career">
        최고 {record.best ? formatPoints(record.best.points) : '-'}점 · 평균 {avg === null ? '-' : avg.toFixed(1)}점 ·{' '}
        {record.games}경기
      </p>

      <p className={`ar-result__upload ar-result__upload--${upload}`} aria-live="polite">
        {UPLOAD_TEXT[upload]}
        {upload === 'queued' && lastUploadError() && <span className="upload-error"> ({lastUploadError()})</span>}
      </p>

      <div className="ar-result__buttons">
        <button type="button" className="button button--primary" onClick={onRetry}>
          다시 하기
        </button>
        <button type="button" className="button" onClick={onRanking}>
          랭킹
        </button>
        <button type="button" className="button" onClick={onMenu}>
          처음으로
        </button>
      </div>
    </section>
  )
}
