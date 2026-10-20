import { type UploadStatus, lastUploadError } from '../../../shared/online/uploadQueue'
import { DIFFICULTY_LABEL } from '../constants'
import type { MatchSummary } from '../play/matchState'
import { type FightRecord, winRate } from '../records'

type Props = {
  summary: MatchSummary
  record: FightRecord
  upload: UploadStatus
  onRetry: () => void
  onRanking: () => void
  onMenu: () => void
}

const OUTCOME_TEXT: Record<MatchSummary['outcome'], string> = { win: '승리!', lose: '패배', draw: '무승부' }

const UPLOAD_TEXT: Record<UploadStatus, string> = {
  saving: '랭킹에 기록을 올리는 중…',
  saved: '랭킹에 기록을 올렸어요',
  queued: '지금은 올리지 못했어요. 다음에 접속할 때 다시 올릴게요',
  rejected: '서버가 이 기록을 받지 않았어요',
}

export function ResultScreen({ summary, record, upload, onRetry, onRanking, onMenu }: Props) {
  const level = record[summary.difficulty]
  const rate = winRate(level)
  return (
    <section className="ft-result">
      <div className={`ft-result__headline ft-result__headline--${summary.outcome}`}>
        <strong>{OUTCOME_TEXT[summary.outcome]}</strong>
        <span>
          {summary.turns}턴 · 남은 생명력 {summary.life[0]} : {summary.life[1]} · 명중 {summary.strikes}번
        </span>
        {summary.outcome === 'win' && level.streak > 1 && <span className="ft-result__streak">{level.streak}연승 중!</span>}
      </div>

      <p className="ft-result__career">
        {DIFFICULTY_LABEL[summary.difficulty]} {level.wins}승 {level.losses}패 {level.draws}무 · 승률{' '}
        {rate === null ? '-' : `${Math.round(rate * 100)}%`} · 최다 {level.bestStreak}연승
      </p>

      <p className={`ft-result__upload ft-result__upload--${upload}`} aria-live="polite">
        {UPLOAD_TEXT[upload]}
        {upload !== 'saved' && upload !== 'saving' && lastUploadError() && <span className="upload-error"> ({lastUploadError()})</span>}
      </p>

      <div className="ft-result__buttons">
        <button type="button" className="button button--primary" onClick={onRetry}>
          다시 하기
        </button>
        <button type="button" className="button" onClick={onRanking}>
          랭킹
        </button>
        <button type="button" className="button" onClick={onMenu}>
          처음으로
        </button>
      </div>
    </section>
  )
}
