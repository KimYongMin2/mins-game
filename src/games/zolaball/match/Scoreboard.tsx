import { type Bases, type GameState, type Side, totalRuns } from '../rules/game'

type Props = {
  game: GameState
  userSide: Side
}

function Dots({ count, max, label }: { count: number; max: number; label: string }) {
  return (
    <span className="zb-count" aria-label={`${label} ${count}`}>
      <span className="zb-count__label" aria-hidden="true">
        {label}
      </span>
      {Array.from({ length: max }, (_, i) => (
        <span key={i} className={`zb-dot${i < count ? ' zb-dot--on' : ''}`} aria-hidden="true" />
      ))}
    </span>
  )
}

/** 주자 다이아몬드: 위 2루, 오른쪽 1루, 왼쪽 3루 */
function BaseDiamond({ bases }: { bases: Bases }) {
  const label = ['1루', '2루', '3루'].filter((_, i) => bases[i]).join(', ') || '주자 없음'
  const positions = [
    { x: 26, y: 16 }, // 1루
    { x: 16, y: 6 }, // 2루
    { x: 6, y: 16 }, // 3루
  ]
  return (
    <svg className="zb-bases" viewBox="0 0 32 26" role="img" aria-label={label}>
      {positions.map((p, i) => (
        <rect
          key={i}
          x={p.x - 4.5}
          y={p.y - 4.5}
          width={9}
          height={9}
          transform={`rotate(45 ${p.x} ${p.y})`}
          className={bases[i] ? 'zb-base zb-base--on' : 'zb-base'}
        />
      ))}
    </svg>
  )
}

export function Scoreboard({ game, userSide }: Props) {
  const botSide: Side = userSide === 'away' ? 'home' : 'away'
  const userBatting = (game.half === 'top') === (userSide === 'away')

  return (
    <div className="zb-scoreboard">
      <div className="zb-scoreboard__inning">
        <strong>{game.inning}회</strong>
        <span>{game.half === 'top' ? '초 ▲' : '말 ▼'}</span>
      </div>

      <div className="zb-scoreboard__score" aria-label={`나 ${totalRuns(game, userSide)}점, 봇 ${totalRuns(game, botSide)}점`}>
        <span className={userBatting ? 'zb-team zb-team--batting' : 'zb-team'}>나</span>
        <strong className="zb-runs">{totalRuns(game, userSide)}</strong>
        <span className="zb-colon">:</span>
        <strong className="zb-runs">{totalRuns(game, botSide)}</strong>
        <span className={userBatting ? 'zb-team' : 'zb-team zb-team--batting'}>봇</span>
      </div>

      <div className="zb-scoreboard__count">
        <Dots label="B" count={game.balls} max={3} />
        <Dots label="S" count={game.strikes} max={2} />
        <Dots label="O" count={game.outs} max={2} />
      </div>

      <BaseDiamond bases={game.bases} />
    </div>
  )
}
