import type { ReactNode } from 'react'
import type { MatchSummary } from '../match/matchState'
import type { WinLossDraw } from '../records'

type Props = {
  /** 친구 대전 다시 하기 전 준비 (친구 [준비] 버튼 / 방장 쪽 준비 상태). 있으면 '방장이 다시 하기를…' 안내 대신 */
  readySlot?: ReactNode
  /** 방장: 친구가 아직 준비 안 했으면 다시 하기를 못 누름 */
  retryLocked?: boolean
  summary: MatchSummary
  record: WinLossDraw
  peerName: string
  isHost: boolean
  peerGone: boolean
  onRetry: () => void
  onLeave: () => void
}

const OUTCOME_TEXT: Record<MatchSummary['outcome'], string> = { win: '승리!', lose: '패배', draw: '무승부' }

/** 친구 대전 결과. 다시 하기는 방장만 누를 수 있고, 친구는 기다린다 */
export function PvpResultScreen({ summary, record, peerName, isHost, peerGone, onRetry, readySlot, retryLocked = false, onLeave }: Props) {
  return (
    <section className="zb-pvp-result">
      <div className={`zb-pvp-result__headline zb-pvp-result__headline--${summary.outcome}`}>
        <strong>{OUTCOME_TEXT[summary.outcome]}</strong>
        <span className="zb-pvp-result__score">
          나 {summary.userRuns} : {summary.botRuns} {peerName}
        </span>
        <span className="zb-pvp-result__note">
          {summary.userStats.atBats}타수 {summary.userStats.hits}안타 · 홈런 {summary.userStats.homeruns}
        </span>
      </div>

      <p className="zb-pvp-result__note">
        친구 대전 {record.wins}승 {record.losses}패 {record.draws}무 (봇전 기록과 따로)
      </p>
      {peerGone ? (
        <p className="zb-pvp-result__note">{peerName}님이 나갔어요</p>
      ) : (
        (readySlot ?? (!isHost && <p className="zb-pvp-result__note">방장이 다시 하기를 누르면 바로 시작해요</p>))
      )}

      <div className="zb-pvp-result__buttons">
        {isHost && (
          <button type="button" className="button button--primary" onClick={onRetry} disabled={peerGone || retryLocked}>
            다시 하기
          </button>
        )}
        <button type="button" className="button" onClick={onLeave}>
          나가기
        </button>
      </div>
    </section>
  )
}
