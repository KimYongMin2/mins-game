import { DIFFICULTY_LABEL, type Difficulty, STONES, TURN_MS } from '../constants'
import { type AlkkagiRecord, winRate } from '../records'

type Props = {
  record: AlkkagiRecord
  onDifficulty: (d: Difficulty) => void
  onBot: () => void
  onPvp: () => void
}

const DIFFICULTY_DESC: Record<Difficulty, string> = {
  normal: '조준이 자주 빗나감',
  hard: '거의 정확하게 맞힘',
}

const DIFFICULTIES: readonly Difficulty[] = ['normal', 'hard']

/** 시작 화면: 규칙, 난이도, 전적 */
export function StartScreen({ record, onDifficulty, onBot, onPvp }: Props) {
  const level = record[record.difficulty]
  const rate = winRate(level)
  return (
    <section className="ak-start">
      <p className="subtitle">돌을 튕겨 상대 돌을 판 밖으로! 먼저 다 떨어뜨리면 승리</p>

      <ul className="ak-start__rules">
        <li>각자 돌 {STONES}개. 카드 두 장 중 하나를 골라 흑·백을 정해요. 흑이 먼저</li>
        <li>내 돌을 누른 채 뒤로 당겼다 놓으면 반대쪽으로 튕겨요 (많이 당길수록 세게)</li>
        <li>
          상대 돌을 떨어뜨리고 튕긴 돌이 판에 남으면 <strong>한 번 더</strong>
        </li>
        <li>내 돌이 떨어져도 잃어요 · 한 번에 {TURN_MS / 1000}초</li>
      </ul>

      <div className="ak-start__options" role="group" aria-label="난이도">
        {DIFFICULTIES.map((d) => (
          <button
            key={d}
            type="button"
            className={`button ak-start__option${record.difficulty === d ? ' ak-start__option--on' : ''}`}
            aria-pressed={record.difficulty === d}
            onClick={() => onDifficulty(d)}
          >
            <span className="ak-start__name">{DIFFICULTY_LABEL[d]}</span>
            <span className="ak-start__desc">{DIFFICULTY_DESC[d]}</span>
          </button>
        ))}
      </div>

      <dl className="ak-start__record">
        <div>
          <dt>봇전 ({DIFFICULTY_LABEL[record.difficulty]})</dt>
          <dd>
            {level.wins}승 {level.losses}패 {level.draws}무
          </dd>
          <span>
            승률 {rate === null ? '-' : `${Math.round(rate * 100)}%`} · 최다 {level.bestStreak}연승
          </span>
        </div>
        <div>
          <dt>친구 대전</dt>
          <dd>
            {record.pvp.wins}승 {record.pvp.losses}패 {record.pvp.draws}무
          </dd>
          <span>봇전 기록과 따로</span>
        </div>
      </dl>

      <button type="button" className="button button--primary ak-start__button" onClick={onBot}>
        봇과 대결
      </button>
      <button type="button" className="button ak-start__sub" onClick={onPvp}>
        친구 대전 <span>(방 코드로 초대)</span>
      </button>
    </section>
  )
}
