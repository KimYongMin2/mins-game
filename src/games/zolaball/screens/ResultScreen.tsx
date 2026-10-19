import type { MatchSummary } from '../match/matchState'
import type { UploadStatus } from '../ranking/online'
import { type ZolaballRecord, formatAverage, formatEra, formatInnings } from '../records'
import { INNINGS, type Side } from '../rules/game'

type Props = {
  summary: MatchSummary
  record: ZolaballRecord
  upload: UploadStatus
  onRematch: () => void
  onRanking: () => void
  onMenu: () => void
}

const UPLOAD_TEXT: Record<UploadStatus, string> = {
  saving: '랭킹에 기록을 올리는 중…',
  saved: '랭킹에 기록을 올렸어요',
  queued: '지금은 올리지 못했어요. 다음에 접속할 때 다시 올릴게요',
}

const HEADLINE = { win: '승리!', lose: '패배', draw: '무승부' } as const
const DIFFICULTY_TEXT = { normal: '일반', hard: '어려움' } as const

export function ResultScreen({ summary, record, upload, onRematch, onRanking, onMenu }: Props) {
  const { userSide, difficulty } = summary.config
  const { linescore, userStats, userPitching } = summary
  // 선공이 위 줄
  const rows: { side: Side; name: string; runs: number }[] = (['away', 'home'] as const).map((side) => ({
    side,
    name: side === userSide ? '나' : '봇',
    runs: side === userSide ? summary.userRuns : summary.botRuns,
  }))
  const wld = record[difficulty]

  return (
    <section className="zb-result">
      <div className={`zb-result__headline zb-result__headline--${summary.outcome}`}>
        <strong>{HEADLINE[summary.outcome]}</strong>
        <span>
          나 {summary.userRuns} : {summary.botRuns} 봇 · {DIFFICULTY_TEXT[difficulty]}
        </span>
      </div>

      <table className="zb-linescore">
        <caption className="zb-visually-hidden">이닝별 점수</caption>
        <thead>
          <tr>
            <th scope="col" />
            {Array.from({ length: INNINGS }, (_, i) => (
              <th key={i} scope="col">
                {i + 1}
              </th>
            ))}
            <th scope="col">R</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.side} className={row.side === userSide ? 'zb-linescore__me' : undefined}>
              <th scope="row">{row.name}</th>
              {Array.from({ length: INNINGS }, (_, i) => (
                // 하지 않은 마지막 이닝 말 공격은 X
                <td key={i}>{linescore[row.side][i] ?? 'X'}</td>
              ))}
              <td className="zb-linescore__total">{row.runs}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <dl className="zb-stats">
        <div>
          <dt>타율</dt>
          <dd>{formatAverage(userStats.hits, userStats.atBats)}</dd>
          <span className="zb-stats__sub">
            {userStats.atBats}타수 {userStats.hits}안타
          </span>
        </div>
        <div>
          <dt>타점</dt>
          <dd>{userStats.rbi}</dd>
          <span className="zb-stats__sub">홈런 {userStats.homeruns}</span>
        </div>
        <div>
          <dt>투구</dt>
          <dd>{formatInnings(userPitching.outs)}이닝</dd>
          <span className="zb-stats__sub">{userPitching.runsAllowed}실점</span>
        </div>
        <div>
          <dt>평균자책점</dt>
          <dd>{formatEra(userPitching.runsAllowed, userPitching.outs)}</dd>
          <span className="zb-stats__sub">
            삼진 {userStats.strikeouts} · 볼넷 {userStats.walks} (타격)
          </span>
        </div>
      </dl>

      <p className="zb-result__career">
        {DIFFICULTY_TEXT[difficulty]} 통산 {wld.wins}승 {wld.losses}패 {wld.draws}무 · 통산 타율{' '}
        {formatAverage(record.hits, record.atBats)} · 홈런 {record.homeruns}
      </p>

      <p className={`zb-result__upload zb-result__upload--${upload}`} aria-live="polite">
        {UPLOAD_TEXT[upload]}
      </p>

      <div className="zb-result__buttons">
        <button type="button" className="button button--primary" onClick={onRematch}>
          다시 하기
        </button>
        <button type="button" className="button" onClick={onRanking}>
          랭킹
        </button>
        <button type="button" className="button" onClick={onMenu}>
          난이도 선택
        </button>
      </div>
    </section>
  )
}
