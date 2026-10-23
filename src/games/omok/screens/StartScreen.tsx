import { DIFFICULTY_LABEL, type Difficulty, TURN_MS } from '../constants'
import { type OmokRecord, winRate } from '../records'

type Props = {
  record: OmokRecord
  onDifficulty: (d: Difficulty) => void
  onBot: () => void
  onPvp: () => void
}

const DIFFICULTY_DESC: Record<Difficulty, string> = {
  normal: '가끔 막을 곳을 놓침',
  hard: '공격·수비를 다 따져 봄',
}

const DIFFICULTIES: readonly Difficulty[] = ['normal', 'hard']

/** 시작 화면: 규칙, 난이도, 전적 */
export function StartScreen({ record, onDifficulty, onBot, onPvp }: Props) {
  const level = record[record.difficulty]
  const rate = winRate(level)
  return (
    <section className="om-start">
      <p className="subtitle">가로·세로·대각선으로 다섯 개를 먼저 이으면 승리!</p>

      <ul className="om-start__rules">
        <li>카드 두 장 중 하나를 골라 흑·백을 정해요. 흑이 먼저</li>
        <li>
          <strong>흑</strong>: 정확히 다섯만 승리. 쌍삼·쌍사·장목(6개 이상)은 금수(✕), 4-3은 돼요
        </li>
        <li>
          <strong>백</strong>: 금수 없음, 6개 이상 이어도 승리
        </li>
        <li>자리를 누른 뒤 [착수하기]로 둬요 · 한 수 {TURN_MS / 1000}초</li>
      </ul>

      <div className="om-start__options" role="group" aria-label="난이도">
        {DIFFICULTIES.map((d) => (
          <button
            key={d}
            type="button"
            className={`button om-start__option${record.difficulty === d ? ' om-start__option--on' : ''}`}
            aria-pressed={record.difficulty === d}
            onClick={() => onDifficulty(d)}
          >
            <span className="om-start__name">{DIFFICULTY_LABEL[d]}</span>
            <span className="om-start__desc">{DIFFICULTY_DESC[d]}</span>
          </button>
        ))}
      </div>

      <dl className="om-start__record">
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

      <button type="button" className="button button--primary om-start__button" onClick={onBot}>
        봇과 대결
      </button>
      <button type="button" className="button om-start__sub" onClick={onPvp}>
        친구 대전 <span>(방 코드로 초대)</span>
      </button>
    </section>
  )
}
