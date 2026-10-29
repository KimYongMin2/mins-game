import type { BotLevel } from '../bot/volleyBot'
import { WIN_SCORE } from '../constants'
import { LEVEL_LABEL, type VolleyRecord, tallyText } from '../records'

type Props = {
  record: VolleyRecord
  onLevel: (l: BotLevel) => void
  onBot: () => void
  onPvp: () => void
}

const LEVEL_DESC: Record<BotLevel, string> = {
  normal: '가끔 공을 놓치고 스파이크를 덜 씀',
  hard: '떨어질 자리를 정확히 읽고 세게 때림',
}

const LEVELS: readonly BotLevel[] = ['normal', 'hard']

/** 시작 화면: 규칙·조작, 난이도, 전적 */
export function StartScreen({ record, onLevel, onBot, onPvp }: Props) {
  return (
    <section className="vb-start">
      <p className="subtitle">공을 상대 코트 바닥에 떨어뜨리면 1점! {WIN_SCORE}점 먼저 (14:14부터는 2점 차)</p>

      <ul className="vb-start__rules">
        <li>
          <strong>이동</strong> ← → · <strong>점프</strong> ↑ · <strong>치기</strong> 스페이스 (폰은 아래 버튼)
        </li>
        <li>
          공중에서 치기 = <strong>스파이크</strong>. 앞 방향키면 낮고 빠르게, 뒤면 높이 넘기기
        </li>
        <li>
          땅에서 치기 = <strong>몸 날리기</strong>. 멀리 떨어지는 낮은 공 살리기
        </li>
        <li>몸에 맞으면 저절로 받아 넘겨요. 달리면서 받으면 더 멀리 · 점수 낸 쪽이 서브</li>
      </ul>

      <div className="vb-start__options" role="group" aria-label="난이도">
        {LEVELS.map((l) => (
          <button
            key={l}
            type="button"
            className={`button vb-start__option${record.level === l ? ' vb-start__option--on' : ''}`}
            aria-pressed={record.level === l}
            onClick={() => onLevel(l)}
          >
            <span className="vb-start__name">{LEVEL_LABEL[l]}</span>
            <span className="vb-start__desc">{LEVEL_DESC[l]}</span>
          </button>
        ))}
      </div>

      <p className="vb-start__record">
        봇전 {LEVEL_LABEL[record.level]} {tallyText(record.bot[record.level])} · 친구 대전 {record.pvp.wins}승 {record.pvp.losses}패
      </p>

      <button type="button" className="button button--primary vb-start__button" onClick={onBot}>
        봇과 대결
      </button>
      <button type="button" className="button vb-start__sub" onClick={onPvp}>
        친구 대전 <span>(방 코드로 초대 · 1:1)</span>
      </button>
    </section>
  )
}
