import { TEAM_COLORS, TEAM_NAMES, type Team, type TeamOutcome } from '../team/teams'

// 팀전 결과: 이겼는지 + 두 팀 사람 목록 (이긴 팀 먼저). 게임마다 결과 화면에서 순위표 대신 쓴다.

export function TeamResult({ outcome, detail }: { outcome: TeamOutcome; detail?: string }) {
  const { winner, myTeam, members } = outcome
  const won = winner === myTeam
  const order: Team[] = winner === 1 ? [1, 0] : [0, 1]
  return (
    <div className="team-result">
      <div className={`team-result__headline${won ? ' team-result__headline--win' : ''}`}>
        <strong>{winner === null ? '무승부' : won ? '우리 팀 승리!' : '우리 팀 패배'}</strong>
        <span>
          {winner === null ? '' : `${TEAM_NAMES[winner]} 승리`}
          {detail ? `${winner === null ? '' : ' · '}${detail}` : ''}
        </span>
      </div>
      <div className="team-result__teams">
        {order.map((t) => (
          <div key={t} className={`team-result__team${t === winner ? ' team-result__team--win' : ''}`} style={{ borderColor: TEAM_COLORS[t] }}>
            <strong style={{ color: TEAM_COLORS[t] }}>
              {TEAM_NAMES[t]}
              {t === winner ? ' · 승리' : ''}
            </strong>
            <ul>
              {members
                .filter((m) => m.team === t)
                .map((m, i) => (
                  <li key={`${m.name}-${i}`} className={m.me ? 'team-result__me' : ''}>
                    {m.name}
                    {m.me ? ' (나)' : ''}
                  </li>
                ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  )
}

/** 경기 화면에서 이름 옆에 붙이는 작은 팀 표시 */
export function TeamDot({ team }: { team: Team }) {
  return <span className="team-dot" style={{ background: TEAM_COLORS[team] }} aria-label={TEAM_NAMES[team]} />
}
