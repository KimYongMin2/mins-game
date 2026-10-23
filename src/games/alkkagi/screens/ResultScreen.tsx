import { DIFFICULTY_LABEL } from '../constants'
import type { MatchSummary } from '../play/matchState'
import { type AlkkagiRecord, winRate } from '../records'

type Props = {
  summary: MatchSummary
  /** 이 경기를 넣은 뒤 기록 */
  record: AlkkagiRecord
  /** 친구 대전이면 상대 이름 */
  peerName?: string
  /** 친구 대전: 방장만 다시 하기, 상대가 나갔는지 */
  isHost?: boolean
  peerGone?: boolean
  onRetry: () => void
  onMenu: () => void
}

const OUTCOME_TEXT: Record<MatchSummary['outcome'], string> = { win: '승리!', lose: '패배', draw: '무승부' }

/** 결과 화면 (봇 대전·친구 대전 같이 씀) */
export function ResultScreen({ summary, record, peerName, isHost = true, peerGone = false, onRetry, onMenu }: Props) {
  const pvp = summary.mode === 'pvp'
  const level = record[summary.difficulty]
  const rate = winRate(level)
  const detail = `${pvp ? `vs ${peerName}` : `봇 ${DIFFICULTY_LABEL[summary.difficulty]}`} · 나 ${summary.stone === 'black' ? '흑' : '백'} · 남은 돌 ${summary.left}개 · ${summary.shots}번 튕김`

  return (
    <section className="ak-result">
      <div className={`ak-result__headline ak-result__headline--${summary.outcome}`}>
        <strong>{OUTCOME_TEXT[summary.outcome]}</strong>
        <span>{detail}</span>
        {!pvp && summary.outcome === 'win' && level.streak > 1 && <span className="ak-result__badge">{level.streak}연승 중!</span>}
      </div>

      <p className="ak-result__career">
        {pvp
          ? `친구 대전 ${record.pvp.wins}승 ${record.pvp.losses}패 ${record.pvp.draws}무 (봇전 기록과 따로)`
          : `${DIFFICULTY_LABEL[summary.difficulty]} ${level.wins}승 ${level.losses}패 ${level.draws}무 · 승률 ${
              rate === null ? '-' : `${Math.round(rate * 100)}%`
            } · 최다 ${level.bestStreak}연승`}
      </p>

      {pvp && (peerGone ? <p className="ak-result__note">{peerName}님이 나갔어요</p> : !isHost && <p className="ak-result__note">방장이 다시 하기를 누르면 바로 시작해요</p>)}

      <div className="ak-result__buttons">
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
