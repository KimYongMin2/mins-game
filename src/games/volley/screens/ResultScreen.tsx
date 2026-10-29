import { type GameSummary, LEVEL_LABEL, type VolleyRecord, tallyText } from '../records'

type Props = {
  summary: GameSummary
  /** 이 경기를 넣은 뒤 기록 */
  record: VolleyRecord
  /** 친구 대전: 방장만 다시 하기, 상대가 나갔는지 */
  isHost?: boolean
  peerGone?: boolean
  onRetry: () => void
  onMenu: () => void
}

/** 결과: 승패, 점수, 스파이크 수, 전적 */
export function ResultScreen({ summary, record, isHost = true, peerGone = false, onRetry, onMenu }: Props) {
  const pvp = summary.mode === 'pvp'
  const t = pvp ? record.pvp : record.bot[summary.level]
  return (
    <section className="vb-result">
      <div className={`vb-result__headline${summary.won ? ' vb-result__headline--win' : ''}`}>
        <strong>{summary.won ? '승리!' : '패배'}</strong>
        <span className="vb-result__score">
          {summary.score[0]} : {summary.score[1]}
        </span>
        <span>
          vs {summary.foeName}
          {pvp ? '' : ` (${LEVEL_LABEL[summary.level]})`} · 스파이크 {summary.spikes[0]} : {summary.spikes[1]}
        </span>
        {summary.won && t.streak > 1 && <span className="vb-result__badge">{t.streak}연승 중!</span>}
      </div>

      <p className="vb-result__career">{pvp ? `친구 대전 ${tallyText(t)} (봇전 기록과 따로)` : `봇전 ${LEVEL_LABEL[summary.level]} ${tallyText(t)}`}</p>
      {pvp && (peerGone ? <p className="vb-result__note">상대가 나갔어요</p> : !isHost && <p className="vb-result__note">방장이 다시 하기를 누르면 바로 시작해요</p>)}

      <div className="vb-result__buttons">
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
