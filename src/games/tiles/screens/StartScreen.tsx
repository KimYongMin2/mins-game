import { FIRST_MELD, HAND_SIZE, MAX_PLAYERS, MIN_PLAYERS } from '../constants'
import { Tile } from '../field/Tile'
import type { TilesRecord } from '../records'
import { WILD_IDS, tileId } from '../rules/tiles'

type Props = {
  record: TilesRecord
  onBots: (n: number) => void
  onBot: () => void
  onPvp: () => void
}

const BOT_COUNTS = [1, 2, 3]

/** 시작 화면: 규칙, 친구 대전(방), 봇 연습 */
export function StartScreen({ record, onBots, onBot, onPvp }: Props) {
  return (
    <section className="nt-start">
      <p className="subtitle">
        숫자 타일을 이어 줄을 만들고, 손패를 먼저 다 털면 우승! ({MIN_PLAYERS}~{MAX_PLAYERS}명)
      </p>

      <div className="nt-start__sample" aria-hidden>
        <span>
          {[4, 5, 6].map((n) => (
            <Tile key={n} id={tileId(0, n)} small />
          ))}
        </span>
        <span>
          {[1, 2, 3].map((c) => (
            <Tile key={c} id={tileId(c, 9)} small />
          ))}
          <Tile id={WILD_IDS[0]} small />
        </span>
      </div>

      <ul className="nt-start__rules">
        <li>숫자 1~13 · 4가지 색 · 두 벌 + 와일드 2장. 처음 {HAND_SIZE}장</li>
        <li>
          줄 = <strong>같은 색 연속 3장 이상</strong>(작은 숫자부터 순서대로, 와일드는 그 자리 숫자) 또는 <strong>같은 숫자 다른 색 3장 이상</strong>
        </li>
        <li>
          첫 등록은 내 타일로만 <strong>합 {FIRST_MELD} 이상</strong>
        </li>
        <li>그 뒤엔 바닥 줄을 쪼개고 다시 짜서 내 타일을 끼워 넣어요. 끝낼 때 바닥이 다 맞으면 통과</li>
        <li>못 내면 1장 가져오기 · 한 차례 60초 (시간이 끝날 때 바닥이 다 맞으면 그대로 내려놓고, 틀리면 되돌리고 1장)</li>
      </ul>

      <button type="button" className="button button--primary nt-start__button" onClick={onPvp}>
        친구들이랑 하기 <span>(방 코드로 초대 · {MAX_PLAYERS}명까지 · 빈자리는 봇)</span>
      </button>
      <p className="nt-start__record">
        친구 대전 {record.pvp.games}판 · 우승 {record.pvp.wins}번
      </p>

      <div className="nt-start__bots">
        <span className="nt-start__label">봇이랑 연습</span>
        <div className="nt-start__counts" role="group" aria-label="봇 수">
          {BOT_COUNTS.map((n) => (
            <button
              key={n}
              type="button"
              className={`button button--small${record.bots === n ? ' nt-start__count--on' : ''}`}
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
        <p className="nt-start__record">
          봇 연습 {record.bot.games}판 · 우승 {record.bot.wins}번
        </p>
      </div>
    </section>
  )
}
