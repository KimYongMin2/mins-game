/**
 * 이벤트가 실제로 일어난 시각. 렌더링이나 핸들러 지연과 상관없이 정확한 판정을 위해 쓴다.
 * 최신 브라우저에서 event.timeStamp는 performance.now()와 같은 기준이지만, 아닌 경우를 대비한다.
 */
export function eventTime(e: { timeStamp: number }): number {
  const now = performance.now()
  const t = e.timeStamp
  return t > 0 && t <= now && now - t < 1000 ? t : now
}
