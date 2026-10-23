import { CHAMBERS, MAX_PLAYERS, MIN_PLAYERS, TURN_MS } from '../constants'
import type { RouletteRecord } from '../records'

type Props = {
  record: RouletteRecord
  onBots: (n: number) => void
  onBot: () => void
  onPvp: () => void
}

const BOT_COUNTS = [1, 2, 3, 4, 5]

/** 시작 화면: 규칙, 친구 대전(방), 봇 연습 */
export function StartScreen({ record, onBots, onBot, onPvp }: Props) {
  return (
    <section className="rl-start">
      <p className="subtitle">
        {CHAMBERS}칸 중 한 발은 진짜! 누구를 쏠까, 마지막까지 살아남기 ({MIN_PLAYERS}~{MAX_PLAYERS}명)
      </p>

      <ul className="rl-start__rules">
        <li>
          내 차례면 쏠 사람을 골라 <strong>방아쇠</strong> — 나 자신도 고를 수 있어요 ({TURN_MS / 1000}초)
        </li>
        <li>
          총알은 1~{CHAMBERS}번째 당김 중 한 번에 나가요. 몇 번 당겼는지는 모두 보여요
        </li>
        <li>
          빈 칸이면 <strong>지목당한 사람 차례</strong> (나를 쐈으면 한 번 더)
        </li>
        <li>
          남을 맞히면 탈락시키고 <strong>새 총알로 내가 계속</strong>
        </li>
        <li>나를 쏴서 맞으면 탈락, 다음 자리 사람 차례</li>
      </ul>

      <button type="button" className="button button--primary rl-start__button" onClick={onPvp}>
        친구들이랑 하기 <span>(방 코드로 초대 · {MAX_PLAYERS}명까지)</span>
      </button>
      <p className="rl-start__record">
        친구 대전 {record.pvp.games}판 · 우승 {record.pvp.wins}번 · {record.pvp.kills ?? 0}킬
      </p>

      <div className="rl-start__bots">
        <span className="rl-start__label">봇이랑 연습</span>
        <div className="rl-start__counts" role="group" aria-label="봇 수">
          {BOT_COUNTS.map((n) => (
            <button
              key={n}
              type="button"
              className={`button button--small${record.bots === n ? ' rl-start__count--on' : ''}`}
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
        <p className="rl-start__record">
          봇 연습 {record.bot.games}판 · 우승 {record.bot.wins}번 · {record.bot.kills ?? 0}킬
        </p>
      </div>
    </section>
  )
}
