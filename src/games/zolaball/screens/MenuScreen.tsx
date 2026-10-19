import { type ZolaballRecord, formatAverage } from '../records'
import type { Difficulty } from '../rules/judge'

type Props = {
  record: ZolaballRecord
  onStart: (difficulty: Difficulty) => void
  onPractice: () => void
  onRanking: () => void
}

const OPTIONS: { value: Difficulty; label: string; desc: string }[] = [
  { value: 'normal', label: '일반', desc: '판정 구간 넉넉, 봇이 볼에도 잘 속음' },
  { value: 'hard', label: '어려움', desc: '판정 구간 70%, 봇이 카운트를 읽음' },
]

/** 난이도 선택 */
export function MenuScreen({ record, onStart, onPractice, onRanking }: Props) {
  return (
    <section className="zb-menu">
      <p className="subtitle">봇과 3이닝 대결! 선공·후공은 무작위예요.</p>
      <div className="zb-menu__options">
        {OPTIONS.map((o) => {
          const wld = record[o.value]
          return (
            <button key={o.value} type="button" className="button zb-menu__option" onClick={() => onStart(o.value)}>
              <span className="zb-menu__label">{o.label}</span>
              <span className="zb-menu__desc">{o.desc}</span>
              <span className="zb-menu__record">
                {wld.wins}승 {wld.losses}패 {wld.draws}무
              </span>
            </button>
          )
        })}
      </div>
      <p className="zb-menu__career">
        통산 타율 {formatAverage(record.hits, record.atBats)} · 홈런 {record.homeruns}
      </p>
      <div className="zb-menu__sub-buttons">
        <button type="button" className="button" onClick={onRanking}>
          랭킹
        </button>
        <button type="button" className="button" onClick={onPractice}>
          타격 연습
        </button>
      </div>
    </section>
  )
}
