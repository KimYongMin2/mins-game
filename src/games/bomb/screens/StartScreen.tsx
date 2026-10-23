import { MAX_PLAYERS, MIN_PLAYERS } from '../constants'
import type { BombRecord } from '../records'

type Props = {
  record: BombRecord
  onBots: (n: number) => void
  onBot: () => void
  onPvp: () => void
}

const BOT_COUNTS = [1, 2, 3, 4, 5, 6, 7]

/** 시작 화면: 규칙, 친구 대전(방), 봇 연습 */
export function StartScreen({ record, onBots, onBot, onPvp }: Props) {
  return (
    <section className="bm-start">
      <p className="subtitle">
        폭탄을 들면 얼른 다른 사람에게! 터질 때 들고 있으면 탈락, 마지막까지 살아남으면 우승 ({MIN_PLAYERS}~{MAX_PLAYERS}명)
      </p>

      <ul className="bm-start__rules">
        <li>폭탄을 든 사람이 <strong>바로 옆(왼쪽·오른쪽)</strong> 사람에게 던져요</li>
        <li>언제 터질지는 아무도 몰라요. 째깍 소리가 점점 빨라져요</li>
        <li>던지는 중에 터지면 받던 사람이 탈락</li>
        <li>한 명이 탈락할 때마다 남은 사람끼리 다시</li>
      </ul>

      <button type="button" className="button button--primary bm-start__button" onClick={onPvp}>
        친구들이랑 하기 <span>(방 코드로 초대 · {MAX_PLAYERS}명까지)</span>
      </button>
      <p className="bm-start__record">
        친구 대전 {record.pvp.games}판 · 우승 {record.pvp.wins}번
      </p>

      <div className="bm-start__bots">
        <span className="bm-start__label">봇이랑 연습 · 봇 몇 명?</span>
        <div className="bm-start__counts" role="group" aria-label="봇 수">
          {BOT_COUNTS.map((n) => (
            <button
              key={n}
              type="button"
              className={`button button--small${record.bots === n ? ' bm-start__count--on' : ''}`}
              aria-pressed={record.bots === n}
              onClick={() => onBots(n)}
            >
              {n}
            </button>
          ))}
        </div>
        <button type="button" className="button" onClick={onBot}>
          봇 {record.bots}명이랑 시작
        </button>
        <p className="bm-start__record">
          봇 연습 {record.bot.games}판 · 우승 {record.bot.wins}번
        </p>
      </div>
    </section>
  )
}
