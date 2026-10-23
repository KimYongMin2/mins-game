import { DIFFICULTY_LABEL, type Difficulty, EVENT_LABEL, type Event, ROUND_MS } from '../constants'
import { type ArmRecord, winRate } from '../records'

type Props = {
  record: ArmRecord
  onEvent: (e: Event) => void
  onDifficulty: (d: Difficulty) => void
  onStart: () => void
  onPvp: () => void
  onCalibrate: () => void
}

const EVENT_DESC: Record<Event, string> = {
  mash: '빠르게 많이 누르기',
  timing: '막대가 노란 곳에 올 때 누르기',
}

const DIFFICULTY_DESC: Record<Difficulty, string> = {
  normal: '봇이 적당히 셈',
  hard: '봇이 꽤 셈',
}

const EVENTS: readonly Event[] = ['mash', 'timing']
const DIFFICULTIES: readonly Difficulty[] = ['normal', 'hard']

/** 시작 화면: 종목, 난이도, 전적 */
export function StartScreen({ record, onEvent, onDifficulty, onStart, onPvp, onCalibrate }: Props) {
  const level = record[record.event][record.difficulty]
  const rate = winRate(level)
  return (
    <section className="aw-start">
      <p className="subtitle">손을 끝까지 넘기면 그 판 승리. 3판 2선승! (한 판 {ROUND_MS / 1000}초)</p>

      <div className="aw-start__options" role="group" aria-label="종목">
        {EVENTS.map((e) => (
          <button
            key={e}
            type="button"
            className={`button aw-start__option${record.event === e ? ' aw-start__option--on' : ''}`}
            aria-pressed={record.event === e}
            onClick={() => onEvent(e)}
          >
            <span className="aw-start__name">{EVENT_LABEL[e]}</span>
            <span className="aw-start__desc">{EVENT_DESC[e]}</span>
          </button>
        ))}
      </div>

      <div className="aw-start__options aw-start__options--small" role="group" aria-label="난이도">
        {DIFFICULTIES.map((d) => (
          <button
            key={d}
            type="button"
            className={`button aw-start__option${record.difficulty === d ? ' aw-start__option--on' : ''}`}
            aria-pressed={record.difficulty === d}
            onClick={() => onDifficulty(d)}
          >
            <span className="aw-start__name">{DIFFICULTY_LABEL[d]}</span>
            <span className="aw-start__desc">{DIFFICULTY_DESC[d]}</span>
          </button>
        ))}
      </div>

      <dl className="aw-start__record">
        <div>
          <dt>
            전적 ({EVENT_LABEL[record.event]} · {DIFFICULTY_LABEL[record.difficulty]})
          </dt>
          <dd>
            {level.wins}승 {level.losses}패
          </dd>
          <span>승률 {rate === null ? '-' : `${Math.round(rate * 100)}%`}</span>
        </div>
        <div>
          <dt>최다 연승</dt>
          <dd>{level.bestStreak}연승</dd>
          <span>지금 {level.streak}연승</span>
        </div>
      </dl>
      <p className="aw-start__pvp-record">
        친구 대전 {record.pvp.wins}승 {record.pvp.losses}패
      </p>

      <button type="button" className="button button--primary aw-start__button" onClick={onStart}>
        봇과 대결
      </button>
      <button type="button" className="button aw-start__pvp" onClick={onPvp}>
        친구 대전 <span>(방 코드로 초대 · 방장이 고른 종목)</span>
      </button>
      {record.event === 'timing' && (
        <button type="button" className="button aw-start__pvp" onClick={onCalibrate}>
          타이밍 맞추기 <span>(누른 게 늦거나 빠르게 잡힐 때)</span>
        </button>
      )}
    </section>
  )
}
