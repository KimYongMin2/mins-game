import type { ReactNode } from 'react'
import { DIFFICULTY_LABEL, EVENT_LABEL } from '../constants'
import type { MatchSummary } from '../play/matchState'
import { type ArmRecord, winRate } from '../records'

type Props = {
  /** 친구 대전 다시 하기 전 준비 (친구 [준비] 버튼 / 방장 쪽 준비 상태). 있으면 '방장이 다시 하기를…' 안내 대신 */
  readySlot?: ReactNode
  /** 방장: 친구가 아직 준비 안 했으면 다시 하기를 못 누름 */
  retryLocked?: boolean
  summary: MatchSummary
  record: ArmRecord
  /** 친구 대전이면 상대 이름 */
  peerName?: string
  /** 친구 대전: 방장만 다시 하기, 상대가 나갔는지 */
  isHost?: boolean
  peerGone?: boolean
  onRetry: () => void
  onMenu: () => void
}

/** 결과 화면 (봇 대전·친구 대전 같이 씀) */
export function ResultScreen({ summary, record, peerName, isHost = true, peerGone = false, onRetry, readySlot, retryLocked = false, onMenu }: Props) {
  const pvp = summary.mode === 'pvp'
  const level = record[summary.event][summary.difficulty]
  const rate = winRate(level)
  const detail = summary.event === 'mash' ? `${summary.taps}번 누름` : `완벽 ${summary.perfects}번`
  return (
    <section className="aw-result">
      <div className={`aw-result__headline aw-result__headline--${summary.outcome}`}>
        <strong>{summary.outcome === 'win' ? '승리!' : '패배'}</strong>
        <span>
          {pvp && `vs ${peerName} · `}
          {EVENT_LABEL[summary.event]} · {summary.wins[0]} : {summary.wins[1]} · {detail}
        </span>
        {!pvp && summary.outcome === 'win' && level.streak > 1 && <span className="aw-result__streak">{level.streak}연승 중!</span>}
      </div>

      <p className="aw-result__career">
        {pvp
          ? `친구 대전 ${record.pvp.wins}승 ${record.pvp.losses}패 (봇전 기록과 따로)`
          : `${EVENT_LABEL[summary.event]} ${DIFFICULTY_LABEL[summary.difficulty]} ${level.wins}승 ${level.losses}패 · 승률 ${
              rate === null ? '-' : `${Math.round(rate * 100)}%`
            } · 최다 ${level.bestStreak}연승`}
      </p>

      {pvp &&
        (peerGone ? (
          <p className="aw-result__note">{peerName}님이 나갔어요</p>
        ) : (
          (readySlot ?? (!isHost && <p className="aw-result__note">방장이 다시 하기를 누르면 바로 시작해요</p>))
        ))}

      <div className="aw-result__buttons">
        {isHost && (
          <button type="button" className="button button--primary" onClick={onRetry} disabled={peerGone || retryLocked}>
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
