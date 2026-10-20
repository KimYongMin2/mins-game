import { DIFFICULTY_LABEL, type Difficulty, PAIRS } from '../constants'
import { type MemoryRecord, winRate } from '../records'

type Props = {
  record: MemoryRecord
  onDifficulty: (d: Difficulty) => void
  onStart: () => void
  onPvp: () => void
}

const DIFFICULTY_DESC: Record<Difficulty, string> = {
  normal: '봇이 본 카드를 자주 잊음',
  hard: '봇이 본 카드를 거의 다 기억함',
}

const DIFFICULTIES: readonly Difficulty[] = ['normal', 'hard']

/** 시작 화면: 규칙, 난이도, 전적 */
export function StartScreen({ record, onDifficulty, onStart, onPvp }: Props) {
  const level = record[record.difficulty]
  const rate = winRate(level)
  return (
    <section className="mm-start">
      <p className="subtitle">카드 {PAIRS * 2}장, 번갈아 두 장씩 열어요. 짝을 더 많이 찾으면 승리!</p>

      <ul className="mm-start__rules">
        <li>같은 그림이면 가져가고 <strong>한 번 더</strong></li>
        <li>다르면 다시 덮고 상대 차례</li>
        <li>한 장에 10초. 넘기면 아무거나 열려요</li>
      </ul>

      <div className="mm-start__options" role="group" aria-label="난이도">
        {DIFFICULTIES.map((d) => (
          <button
            key={d}
            type="button"
            className={`button mm-start__option${record.difficulty === d ? ' mm-start__option--on' : ''}`}
            aria-pressed={record.difficulty === d}
            onClick={() => onDifficulty(d)}
          >
            <span className="mm-start__name">{DIFFICULTY_LABEL[d]}</span>
            <span className="mm-start__desc">{DIFFICULTY_DESC[d]}</span>
          </button>
        ))}
      </div>

      <dl className="mm-start__record">
        <div>
          <dt>전적 ({DIFFICULTY_LABEL[record.difficulty]})</dt>
          <dd>
            {level.wins}승 {level.losses}패 {level.draws}무
          </dd>
          <span>승률 {rate === null ? '-' : `${Math.round(rate * 100)}%`}</span>
        </div>
        <div>
          <dt>최다 연승</dt>
          <dd>{level.bestStreak}연승</dd>
          <span>지금 {level.streak}연승</span>
        </div>
      </dl>
      <p className="mm-start__pvp-record">
        친구 대전 {record.pvp.wins}승 {record.pvp.losses}패 {record.pvp.draws}무
      </p>

      <button type="button" className="button button--primary mm-start__button" onClick={onStart}>
        봇과 대결
      </button>
      <button type="button" className="button mm-start__pvp" onClick={onPvp}>
        친구 대전 <span>(방 코드로 초대)</span>
      </button>
    </section>
  )
}
