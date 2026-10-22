import { DIFFICULTY_LABEL } from '../constants'
import type { MatchSummary } from '../play/matchState'
import { type NumbaseballRecord, soloAverage, soloKey, winRate } from '../records'

type Props = {
  summary: MatchSummary
  /** 이 경기를 넣은 뒤 기록 */
  record: NumbaseballRecord
  /** 이 경기 전 최소 횟수 (혼자 하기 최고 기록 갱신 표시) */
  prevBest?: number | null
  /** 친구 대전이면 상대 이름 */
  peerName?: string
  /** 친구 대전: 방장만 다시 하기, 상대가 나갔는지 */
  isHost?: boolean
  peerGone?: boolean
  onRetry: () => void
  onMenu: () => void
}

const OUTCOME_TEXT: Record<MatchSummary['outcome'], string> = { win: '승리!', lose: '패배', draw: '무승부' }

/** 결과 화면 (봇 대전·친구 대전·혼자 하기 같이 씀) */
export function ResultScreen({ summary, record, prevBest = null, peerName, isHost = true, peerGone = false, onRetry, onMenu }: Props) {
  const { mode } = summary
  const pvp = mode === 'pvp'
  const solo = mode === 'solo'
  const level = record[summary.difficulty]
  const rate = winRate(level)
  const soloRec = record[soloKey(summary.length)]
  const avg = soloAverage(soloRec)
  const newBest = solo && summary.outcome === 'win' && (prevBest === null || summary.tries < prevBest)

  const headline = solo ? (summary.outcome === 'win' ? `${summary.tries}번 만에!` : '실패') : OUTCOME_TEXT[summary.outcome]
  const detail = solo
    ? `${summary.length}자리 · ${summary.outcome === 'win' ? '맞힘' : `${summary.tries}번 안에 못 맞힘`}`
    : `${pvp ? `vs ${peerName} · ` : ''}${summary.length}자리 · 나 ${summary.tries}번 / 상대 ${summary.foeTries}번`

  return (
    <section className="nb-result">
      <div className={`nb-result__headline nb-result__headline--${summary.outcome}`}>
        <strong>{headline}</strong>
        <span>{detail}</span>
        {newBest && <span className="nb-result__badge">최고 기록!</span>}
        {mode === 'bot' && summary.outcome === 'win' && level.streak > 1 && <span className="nb-result__badge">{level.streak}연승 중!</span>}
      </div>

      <p className="nb-result__career">
        {pvp
          ? `친구 대전 ${record.pvp.wins}승 ${record.pvp.losses}패 ${record.pvp.draws}무 (봇전 기록과 따로)`
          : solo
            ? `${summary.length}자리 혼자 하기 · 최소 ${soloRec.best ?? '-'}번 · 평균 ${avg === null ? '-' : avg.toFixed(1)}번 · ${soloRec.games}판`
            : `${DIFFICULTY_LABEL[summary.difficulty]} ${level.wins}승 ${level.losses}패 ${level.draws}무 · 승률 ${
                rate === null ? '-' : `${Math.round(rate * 100)}%`
              } · 최다 ${level.bestStreak}연승`}
      </p>

      {pvp && (peerGone ? <p className="nb-result__note">{peerName}님이 나갔어요</p> : !isHost && <p className="nb-result__note">방장이 다시 하기를 누르면 바로 시작해요</p>)}

      <div className="nb-result__buttons">
        {isHost && (
          <button type="button" className="button button--primary" onClick={onRetry} disabled={peerGone}>
            다시 하기
          </button>
        )}
        <button type="button" className="button" onClick={onMenu}>
          {pvp ? '나가기' : '처음으로'}
        </button>
      </div>
    </section>
  )
}
