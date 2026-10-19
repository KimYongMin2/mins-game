import { ROUNDS, TOTAL_ARROWS } from '../constants'
import { type ArcheryRecord, averageOf } from '../records'

type Props = {
  record: ArcheryRecord
  onStart: () => void
}

/** 시작 화면: 경기 구성과 내 기록 */
export function StartScreen({ record, onStart }: Props) {
  const avg = averageOf(record)
  return (
    <section className="ar-start">
      <p className="subtitle">
        {TOTAL_ARROWS}발을 쏴서 점수를 내요. 바람을 읽고 조준을 옮기세요!
      </p>

      <ol className="ar-start__rounds">
        {ROUNDS.map((r) => (
          <li key={r.distance}>
            <strong>{r.distance}m</strong>
            <span>{r.arrows}발</span>
          </li>
        ))}
      </ol>

      <dl className="ar-start__record">
        <div>
          <dt>최고 점수</dt>
          <dd>{record.best ? `${record.best.points}점` : '-'}</dd>
          {record.best && <span>X {record.best.xCount}개</span>}
        </div>
        <div>
          <dt>평균 점수</dt>
          <dd>{avg === null ? '-' : `${avg.toFixed(1)}점`}</dd>
          <span>{record.games}경기</span>
        </div>
      </dl>

      <button type="button" className="button button--primary ar-start__button" onClick={onStart}>
        시작
      </button>
      <p className="ar-start__how">
        누른 채로 드래그해서 조준, 떼면 발사
        <br />
        PC는 스페이스바를 누른 채 방향키로도 조준할 수 있어요
      </p>
    </section>
  )
}
