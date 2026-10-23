import { MAX_PLAYERS, MIN_PLAYERS, PLAN_MS } from '../constants'
import type { SurvivalRecord } from '../records'

type Props = {
  record: SurvivalRecord
  onBots: (n: number) => void
  onBot: () => void
  onPvp: () => void
}

const BOT_COUNTS = [1, 2, 3, 4, 5]

/** 시작 화면: 규칙, 친구 대전(방), 봇 연습 */
export function StartScreen({ record, onBots, onBot, onPvp }: Props) {
  return (
    <section className="sv-start">
      <p className="subtitle">
        몰래 숨고, 일자로 쏘고, 마지막까지 살아남기! ({MIN_PLAYERS}~{MAX_PLAYERS}명)
      </p>

      <ul className="sv-start__rules">
        <li>
          라운드마다 <strong>숨을 자리</strong>를 누르고 <strong>총 쏠 방향</strong>을 골라 확정 ({PLAN_MS / 1000}초)
        </li>
        <li>고르는 동안 다른 사람 자리는 안 보여요</li>
        <li>모두 고르면 공개! 총알이 일자로 나가 <strong>처음 맞은 한 명</strong>이 탈락</li>
        <li>
          라운드마다 <strong>엄폐물</strong>이 새로 생겨요. 벽에 닿으면 레이저가 막혀요
        </li>
        <li>탈락자가 나오면 남은 사람 수만큼 맵이 줄어요 (둘이 남아도 적당히 넓게), 한 명 남을 때까지</li>
        <li>남은 사람이 모두 맞으면 그 라운드는 무효</li>
      </ul>

      <button type="button" className="button button--primary sv-start__button" onClick={onPvp}>
        친구들이랑 하기 <span>(방 코드로 초대 · {MAX_PLAYERS}명까지)</span>
      </button>
      <p className="sv-start__record">
        친구 대전 {record.pvp.games}판 · 우승 {record.pvp.wins}번 · {record.pvp.kills ?? 0}킬
      </p>

      <div className="sv-start__bots">
        <span className="sv-start__label">봇이랑 연습</span>
        <div className="sv-start__counts" role="group" aria-label="봇 수">
          {BOT_COUNTS.map((n) => (
            <button
              key={n}
              type="button"
              className={`button button--small${record.bots === n ? ' sv-start__count--on' : ''}`}
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
        <p className="sv-start__record">
          봇 연습 {record.bot.games}판 · 우승 {record.bot.wins}번 · {record.bot.kills ?? 0}킬
        </p>
      </div>
    </section>
  )
}
