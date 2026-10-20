import { DIFFICULTY_LABEL } from '../constants'
import type { MatchSummary } from '../play/matchState'
import { type MemoryRecord, winRate } from '../records'

type Props = {
  summary: MatchSummary
  record: MemoryRecord
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
  return (
    <section className="mm-result">
      <div className={`mm-result__headline mm-result__headline--${summary.outcome}`}>
        <strong>{OUTCOME_TEXT[summary.outcome]}</strong>
        <span>
          {pvp && `vs ${peerName} · `}
          {summary.pairs[0]}쌍 : {summary.pairs[1]}쌍 · {summary.tries}번 시도
        </span>
        {!pvp && summary.outcome === 'win' && level.streak > 1 && <span className="mm-result__streak">{level.streak}연승 중!</span>}
      </div>

      <p className="mm-result__career">
        {pvp
          ? `친구 대전 ${record.pvp.wins}승 ${record.pvp.losses}패 ${record.pvp.draws}무 (봇전 기록과 따로)`
          : `${DIFFICULTY_LABEL[summary.difficulty]} ${level.wins}승 ${level.losses}패 ${level.draws}무 · 승률 ${
              rate === null ? '-' : `${Math.round(rate * 100)}%`
            } · 최다 ${level.bestStreak}연승`}
      </p>

      {pvp && (peerGone ? <p className="mm-result__note">{peerName}님이 나갔어요</p> : !isHost && <p className="mm-result__note">방장이 다시 하기를 누르면 바로 시작해요</p>)}

      <div className="mm-result__buttons">
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
