import { DIFFICULTY_LABEL, type Difficulty, MAX_LIFE, MAX_STACKS, SMASH_COST } from '../constants'
import { type FightRecord, winRate } from '../records'

type Props = {
  record: FightRecord
  onDifficulty: (d: Difficulty) => void
  onStart: () => void
  onPvp: () => void
  onRanking: () => void
}

const DIFFICULTY_DESC: Record<Difficulty, string> = {
  normal: '봇이 대충 고름',
  hard: '봇이 스택과 버릇을 읽음',
}

const DIFFICULTIES: readonly Difficulty[] = ['normal', 'hard']

/** 시작 화면: 규칙, 난이도, 전적 */
export function StartScreen({ record, onDifficulty, onStart, onPvp, onRanking }: Props) {
  const level = record[record.difficulty]
  const rate = winRate(level)
  return (
    <section className="ft-start">
      <p className="subtitle">2초마다 동시에 자세를 골라요. 생명력 {MAX_LIFE}개를 먼저 다 깎으면 승리!</p>

      <ul className="ft-start__rules">
        <li>
          <strong>준비</strong> 스택 +1 (최대 {MAX_STACKS}개)
        </li>
        <li>
          <strong>방어</strong> 상대 타격을 막음
        </li>
        <li>
          <strong>타격</strong> 스택 1개를 써서 공격. 준비 중인 상대는 생명력 −1
        </li>
        <li>
          <strong>강타</strong> 스택 {SMASH_COST}개를 모두 써서 공격. 방어를 뚫고 타격도 이김
        </li>
        <li>같은 공격끼리 부딪히면 상쇄</li>
      </ul>

      <div className="ft-start__options" role="group" aria-label="난이도">
        {DIFFICULTIES.map((d) => (
          <button
            key={d}
            type="button"
            className={`button ft-start__option${record.difficulty === d ? ' ft-start__option--on' : ''}`}
            aria-pressed={record.difficulty === d}
            onClick={() => onDifficulty(d)}
          >
            <span className="ft-start__name">{DIFFICULTY_LABEL[d]}</span>
            <span className="ft-start__desc">{DIFFICULTY_DESC[d]}</span>
          </button>
        ))}
      </div>

      <dl className="ft-start__record">
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
      <p className="ft-start__pvp-record">
        친구 대전 {record.pvp.wins}승 {record.pvp.losses}패 {record.pvp.draws}무
      </p>

      <button type="button" className="button button--primary ft-start__button" onClick={onStart}>
        봇과 대결
      </button>
      <button type="button" className="button ft-start__pvp" onClick={onPvp}>
        친구 대전 <span>(방 코드로 초대)</span>
      </button>
      <button type="button" className="button" onClick={onRanking}>
        랭킹
      </button>
    </section>
  )
}
