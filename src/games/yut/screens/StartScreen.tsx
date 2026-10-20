import { MAX_PLAYERS, MIN_PLAYERS, PIECE_COUNTS } from '../constants'
import type { YutRecord } from '../records'

type Props = {
  record: YutRecord
  onBots: (n: number) => void
  onPieces: (n: number) => void
  onBot: () => void
  onPvp: () => void
}

const BOT_COUNTS = [1, 2, 3]

/** 시작 화면: 말 개수, 친구 대전(방), 봇 연습 */
export function StartScreen({ record, onBots, onPieces, onBot, onPvp }: Props) {
  return (
    <section className="yt-start">
      <p className="subtitle">
        내 말을 먼저 다 내보내면 우승! ({MIN_PLAYERS}~{MAX_PLAYERS}명 개인전)
      </p>

      <ul className="yt-start__rules">
        <li>윷·모가 나오면 한 번 더. 도·개·걸·빽도로 상대 말을 잡아도 한 번 더</li>
        <li>내 말끼리 만나면 업어서 같이, 상대 말에 멈추면 잡아서 처음으로</li>
        <li>모서리·가운데에 <strong>딱 멈추면 무조건 꺾어요</strong></li>
        <li>빽도는 한 칸 뒤로 (판에 말이 없으면 없어짐)</li>
      </ul>

      <div className="yt-start__row">
        <span className="yt-start__label">말 개수</span>
        <div className="yt-start__counts" role="group" aria-label="말 개수">
          {PIECE_COUNTS.map((n) => (
            <button
              key={n}
              type="button"
              className={`button button--small${record.pieceCount === n ? ' yt-start__count--on' : ''}`}
              aria-pressed={record.pieceCount === n}
              onClick={() => onPieces(n)}
            >
              {n}개
            </button>
          ))}
        </div>
      </div>

      <button type="button" className="button button--primary yt-start__button" onClick={onPvp}>
        친구들이랑 하기 <span>(방 코드로 초대 · {MAX_PLAYERS}명까지 · 말 개수는 방장 기준)</span>
      </button>
      <p className="yt-start__record">
        친구 대전 {record.pvp.games}판 · 우승 {record.pvp.wins}번
      </p>

      <div className="yt-start__bots">
        <span className="yt-start__label">봇이랑 연습</span>
        <div className="yt-start__counts" role="group" aria-label="봇 수">
          {BOT_COUNTS.map((n) => (
            <button
              key={n}
              type="button"
              className={`button button--small${record.bots === n ? ' yt-start__count--on' : ''}`}
              aria-pressed={record.bots === n}
              onClick={() => onBots(n)}
            >
              봇 {n}
            </button>
          ))}
        </div>
        <button type="button" className="button" onClick={onBot}>
          봇 {record.bots}명이랑 시작 (말 {record.pieceCount}개)
        </button>
        <p className="yt-start__record">
          봇 연습 {record.bot.games}판 · 우승 {record.bot.wins}번
        </p>
      </div>
    </section>
  )
}
