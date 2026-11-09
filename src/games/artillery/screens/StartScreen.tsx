import type { BotLevel } from "../bot/artilleryBot";
import { MAX_PLAYERS, MIN_PLAYERS, TURN_MS } from "../constants";
import type { ArtilleryRecord } from "../records";

type Props = {
  record: ArtilleryRecord;
  onBots: (n: number) => void;
  onLevel: (level: BotLevel) => void;
  onBot: () => void;
  onPvp: () => void;
};

const BOT_COUNTS = [1, 2, 3];
const LEVELS: { id: BotLevel; label: string }[] = [
  { id: "normal", label: "일반" },
  { id: "hard", label: "어려움" },
];

/** 시작 화면: 규칙, 친구 대전(방), 봇 연습 */
export function StartScreen({ record, onBots, onLevel, onBot, onPvp }: Props) {
  const t = record.bot[record.level];
  return (
    <section className="at-start">
      <p className="subtitle">
        각도와 힘을 정해 쏘고, 바람을 읽어라! ({MIN_PLAYERS}~{MAX_PLAYERS}명)
      </p>

      <ul className="at-start__rules">
        <li>
          차례가 되면 <strong>조금 움직이고</strong>, <strong>각도·힘</strong>을
          정해 발사 ({TURN_MS / 1000}초)
        </li>
        <li>
          <strong>바람</strong>이 차례마다 바뀌어요. 화살표를 보고 계산하세요
        </li>
        <li>포탄이 떨어진 자리는 땅이 파이고, 가까이 있으면 다쳐요 (나도!)</li>
        <li>발밑이 꺼지면 떨어져서 더 다치고, 바닥까지 떨어지면 탈락</li>
        <li>체력 100이 다 닳으면 탈락, 마지막까지 남은 사람이 승리</li>
      </ul>

      <button
        type="button"
        className="button button--primary at-start__button"
        onClick={onPvp}
      >
        친구들이랑 하기 <span>(방 목록 · {MAX_PLAYERS}명까지)</span>
      </button>
      <p className="at-start__record">
        친구 대전 {record.pvp.games}판 · 우승 {record.pvp.wins}번 ·{" "}
        {record.pvp.kills}킬
      </p>

      <div className="at-start__bots">
        <span className="at-start__label">봇이랑 연습</span>
        <div className="at-start__counts" role="group" aria-label="난이도">
          {LEVELS.map((l) => (
            <button
              key={l.id}
              type="button"
              className={`button button--small${record.level === l.id ? " at-start__count--on" : ""}`}
              aria-pressed={record.level === l.id}
              onClick={() => onLevel(l.id)}
            >
              {l.label}
            </button>
          ))}
        </div>
        <div className="at-start__counts" role="group" aria-label="봇 수">
          {BOT_COUNTS.map((n) => (
            <button
              key={n}
              type="button"
              className={`button button--small${record.bots === n ? " at-start__count--on" : ""}`}
              aria-pressed={record.bots === n}
              onClick={() => onBots(n)}
            >
              봇 {n}
            </button>
          ))}
        </div>
        <button type="button" className="button" onClick={onBot}>
          봇 {record.bots}명이랑 시작 (
          {LEVELS.find((l) => l.id === record.level)?.label})
        </button>
        <p className="at-start__record">
          봇 연습({LEVELS.find((l) => l.id === record.level)?.label}) {t.games}
          판 · 우승 {t.wins}번 · {t.kills}킬
        </p>
      </div>
    </section>
  );
}
