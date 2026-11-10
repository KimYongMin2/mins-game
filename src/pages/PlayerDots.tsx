// 시그니처: 보드게임 상자 옆면처럼 인원을 사람 점으로 (사용자 요청 — 색 칠한 인원 배지 대신).
// 꼭 있어야 하는 인원은 채운 점, 더 들어올 수 있는 자리는 빈 점. 예) 2인 ●● · 2~8인 ●●○○○○○○
const range = (players: string): [number, number] => {
  const m = /^(\d+)(?:~(\d+))?인$/.exec(players)
  if (!m) return [1, 1]
  const min = Number(m[1])
  return [min, m[2] ? Number(m[2]) : min]
}

export function PlayerDots({ players }: { players: string }) {
  const [min, max] = range(players)
  const label = min === max ? `${min}명` : `${min}–${max}명`
  return (
    <span className="dots" aria-label={`${label}이 해요`}>
      <span className="dots__row" aria-hidden>
        {Array.from({ length: max }, (_, i) => (
          <i key={i} className={i < min ? 'dots__on' : 'dots__off'} />
        ))}
      </span>
      <span className="dots__text">{label}</span>
    </span>
  )
}
