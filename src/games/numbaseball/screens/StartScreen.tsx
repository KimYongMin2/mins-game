import { DIFFICULTY_LABEL, type Difficulty, LENGTHS, type Length, MAX_TRIES, SOLO_MAX_TRIES, TURN_MS } from '../constants'
import { type NumbaseballRecord, soloAverage, soloKey, winRate } from '../records'

type Props = {
  record: NumbaseballRecord
  onDifficulty: (d: Difficulty) => void
  onLength: (l: Length) => void
  onBot: () => void
  onPvp: () => void
  onSolo: () => void
}

const DIFFICULTY_DESC: Record<Difficulty, string> = {
  normal: '봇이 단서를 자주 잊음',
  hard: '봇이 단서를 다 따져 봄',
}

const DIFFICULTIES: readonly Difficulty[] = ['normal', 'hard']

/** 시작 화면: 규칙, 숫자 개수, 난이도, 전적 */
export function StartScreen({ record, onDifficulty, onLength, onBot, onPvp, onSolo }: Props) {
  const level = record[record.difficulty]
  const rate = winRate(level)
  const solo = record[soloKey(record.length)]
  const avg = soloAverage(solo)
  return (
    <section className="nb-start">
      <p className="subtitle">서로 숨긴 숫자를 번갈아 불러서 먼저 맞히면 승리!</p>

      <ul className="nb-start__rules">
        <li>
          <strong>S</strong>(스트라이크): 숫자와 자리가 맞음 · <strong>B</strong>(볼): 숫자만 맞음 · <strong>OUT</strong>: 하나도 없음
        </li>
        <li>예) 정답 472에 427을 부르면 1S 2B</li>
        <li>서로 다른 숫자, 맨 앞은 0 안 됨 · 한 번에 {TURN_MS / 1000}초</li>
        <li>먼저 맞혀도 상대에게 같은 횟수의 기회. 둘 다 맞히면 무승부 (각자 {MAX_TRIES}번까지)</li>
      </ul>

      <div className="nb-start__options" role="group" aria-label="숫자 개수">
        {LENGTHS.map((l) => (
          <button
            key={l}
            type="button"
            className={`button nb-start__option${record.length === l ? ' nb-start__option--on' : ''}`}
            aria-pressed={record.length === l}
            onClick={() => onLength(l)}
          >
            <span className="nb-start__name">{l}자리</span>
            <span className="nb-start__desc">{l === 3 ? '예) 472' : '예) 4725'}</span>
          </button>
        ))}
      </div>

      <div className="nb-start__options" role="group" aria-label="난이도">
        {DIFFICULTIES.map((d) => (
          <button
            key={d}
            type="button"
            className={`button nb-start__option${record.difficulty === d ? ' nb-start__option--on' : ''}`}
            aria-pressed={record.difficulty === d}
            onClick={() => onDifficulty(d)}
          >
            <span className="nb-start__name">{DIFFICULTY_LABEL[d]}</span>
            <span className="nb-start__desc">{DIFFICULTY_DESC[d]}</span>
          </button>
        ))}
      </div>

      <dl className="nb-start__record">
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
          <dt>혼자 하기 ({record.length}자리)</dt>
          <dd>{solo.best === null ? '-' : `최소 ${solo.best}번`}</dd>
          <span>평균 {avg === null ? '-' : `${avg.toFixed(1)}번`} · {solo.games}판</span>
        </div>
      </dl>
      <p className="nb-start__pvp-record">
        친구 대전 {record.pvp.wins}승 {record.pvp.losses}패 {record.pvp.draws}무
      </p>

      <button type="button" className="button button--primary nb-start__button" onClick={onBot}>
        봇과 대결
      </button>
      <button type="button" className="button nb-start__sub" onClick={onPvp}>
        친구 대전 <span>(방 코드로 초대 · 숫자 개수는 방장 기준)</span>
      </button>
      <button type="button" className="button nb-start__sub" onClick={onSolo}>
        혼자 하기 <span>(봇 숫자를 {SOLO_MAX_TRIES}번 안에 · 적게 부를수록 좋음)</span>
      </button>
    </section>
  )
}
