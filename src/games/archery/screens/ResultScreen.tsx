import { ROUNDS } from '../constants'
import type { RoundSummary } from '../play/roundState'
import { type ArcheryRecord, averageOf } from '../records'
import { totalOf } from '../rules/scoring'

type Props = {
  summary: RoundSummary
  record: ArcheryRecord
  newBest: boolean
  onRetry: () => void
  onMenu: () => void
}

function cell(points: number, x: boolean) {
  if (x) return 'X'
  return points === 0 ? 'M' : String(points)
}

export function ResultScreen({ summary, record, newBest, onRetry, onMenu }: Props) {
  const avg = averageOf(record)
  return (
    <section className="ar-result">
      <div className={`ar-result__headline${newBest ? ' ar-result__headline--best' : ''}`}>
        {newBest && <span className="ar-result__badge">개인 최고 기록!</span>}
        <strong>{summary.points}점</strong>
        <span>X {summary.xCount}개</span>
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
                      <span key={s.index} className={s.score.points === 10 ? 'ar-result__arrow ar-result__arrow--gold' : 'ar-result__arrow'}>
                        {cell(s.score.points, s.score.x)}
                      </span>
                    ))}
                  </div>
                </td>
                <td className="ar-result__sub">{sub.points}</td>
              </tr>
            )
          })}
        </tbody>
      </table>

      <p className="ar-result__career">
        최고 {record.best?.points ?? '-'}점 · 평균 {avg === null ? '-' : avg.toFixed(1)}점 · {record.games}경기
      </p>

      <div className="ar-result__buttons">
        <button type="button" className="button button--primary" onClick={onRetry}>
          다시 하기
        </button>
        <button type="button" className="button" onClick={onMenu}>
          처음으로
        </button>
      </div>
    </section>
  )
}
