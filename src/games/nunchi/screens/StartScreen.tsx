import { CALL_MS, COLLIDE_MS, MAX_PLAYERS, MIN_PLAYERS } from '../constants'
import type { NunchiRecord } from '../records'

type Props = {
  record: NunchiRecord
  onBots: (n: number) => void
  onBot: () => void
  onPvp: () => void
}

/** 봇 연습은 나 포함 3명부터 */
const BOT_COUNTS = [2, 3, 4, 5]

/** 시작 화면: 규칙, 친구 대전(방), 봇 연습 */
export function StartScreen({ record, onBots, onBot, onPvp }: Props) {
  return (
    <section className="nc-start">
      <p className="subtitle">
        눈치껏 1, 2, 3… 겹치거나 마지막이면 탈락! ({MIN_PLAYERS}~{MAX_PLAYERS}명)
      </p>

      <ul className="nc-start__rules">
        <li>'시작!' 뒤 아무 때나 <strong>[외치기]</strong> 한 번. 누른 순서대로 1, 2, 3…</li>
        <li>{COLLIDE_MS / 1000}초 안에 둘 이상 누르면 <strong>겹친 사람 모두 탈락</strong></li>
        <li>끝까지 안 누르고 <strong>마지막 한 명</strong>이 되면 탈락</li>
        <li>{CALL_MS / 1000}초 안에 안 누르면 탈락</li>
        <li>2명이 남으면 <strong>결승 가위바위보</strong>!</li>
      </ul>

      <button type="button" className="button button--primary nc-start__button" onClick={onPvp}>
        친구들이랑 하기 <span>(방 코드로 초대 · {MAX_PLAYERS}명까지)</span>
      </button>
      <p className="nc-start__record">
        친구 대전 {record.pvp.games}판 · 우승 {record.pvp.wins}번
      </p>

      <div className="nc-start__bots">
        <span className="nc-start__label">봇이랑 연습</span>
        <div className="nc-start__counts" role="group" aria-label="봇 수">
          {BOT_COUNTS.map((n) => (
            <button
              key={n}
              type="button"
              className={`button button--small${record.bots === n ? ' nc-start__count--on' : ''}`}
              aria-pressed={record.bots === n}
              onClick={() => onBots(n)}
            >
              봇 {n}
            </button>
          ))}
        </div>
        <button type="button" className="button" onClick={onBot}>
          봇 {record.bots}명이랑 시작
        </button>
        <p className="nc-start__record">
          봇 연습 {record.bot.games}판 · 우승 {record.bot.wins}번
        </p>
      </div>
    </section>
  )
}
