import { DIFFICULTY_LABEL, type Difficulty, HAND_LABEL, type Hand, TOTAL_PITCHES } from '../constants'
import { type BattingRecord, averageOf } from '../records'

type Props = {
  record: BattingRecord
  onChange: (choice: { difficulty: Difficulty; hand: Hand }) => void
  onStart: () => void
  onRanking: () => void
}

const DIFFICULTY_DESC: Record<Difficulty, string> = {
  normal: '판정 구간 넉넉',
  hard: '구속 빠르고 판정 구간 70%',
}

const HAND_DESC: Record<Hand, string> = {
  right: '왼쪽 타석, 오른쪽으로 휘두름',
  left: '오른쪽 타석, 왼쪽으로 휘두름',
}

function Choice<T extends string>({
  label,
  value,
  options,
  names,
  descs,
  onPick,
}: {
  label: string
  value: T
  options: readonly T[]
  names: Record<T, string>
  descs: Record<T, string>
  onPick: (v: T) => void
}) {
  return (
    <fieldset className="bt-choice">
      <legend className="bt-choice__legend">{label}</legend>
      <div className="bt-choice__options">
        {options.map((o) => (
          <button
            key={o}
            type="button"
            className={`button bt-choice__option${o === value ? ' bt-choice__option--on' : ''}`}
            aria-pressed={o === value}
            onClick={() => onPick(o)}
          >
            <span className="bt-choice__name">{names[o]}</span>
            <span className="bt-choice__desc">{descs[o]}</span>
          </button>
        ))}
      </div>
    </fieldset>
  )
}

/** 시작 화면: 난이도·타석 선택과 내 기록 */
export function StartScreen({ record, onChange, onStart, onRanking }: Props) {
  const { difficulty, hand } = record
  const level = record[difficulty]
  const avg = averageOf(level)
  return (
    <section className="bt-start">
      <p className="subtitle">공 {TOTAL_PITCHES}개! 들어오는 곳을 타이밍 맞춰 터치해서 홈런을 노려요.</p>

      <Choice
        label="난이도"
        value={difficulty}
        options={['normal', 'hard'] as const}
        names={DIFFICULTY_LABEL}
        descs={DIFFICULTY_DESC}
        onPick={(d) => onChange({ difficulty: d, hand })}
      />
      <Choice
        label="타석"
        value={hand}
        options={['right', 'left'] as const}
        names={HAND_LABEL}
        descs={HAND_DESC}
        onPick={(h) => onChange({ difficulty, hand: h })}
      />

      <dl className="bt-start__record">
        <div>
          <dt>최고 점수 ({DIFFICULTY_LABEL[difficulty]})</dt>
          <dd>{level.best ? `${level.best.points}점` : '-'}</dd>
          {level.best && <span>홈런 {level.best.homeruns}개</span>}
        </div>
        <div>
          <dt>평균 점수</dt>
          <dd>{avg === null ? '-' : `${avg.toFixed(1)}점`}</dd>
          <span>{level.games}경기</span>
        </div>
      </dl>

      <button type="button" className="button button--primary bt-start__button" onClick={onStart}>
        시작
      </button>
      <button type="button" className="button" onClick={onRanking}>
        랭킹
      </button>
      <p className="bt-start__how">
        멀리 칠수록 점수가 높아요 (비거리 1m = 1점). 공 위치 + 정확한 타이밍 = 홈런. 배트 끝 너머는 헛스윙, 손잡이 쪽은 빗맞아요.
        <br />
        화면 아무 곳이나 터치(PC는 클릭)
      </p>
    </section>
  )
}
