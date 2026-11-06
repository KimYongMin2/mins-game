import { useEffect, useState } from 'react'
import { isDirectRoom } from '../online/directLink'
import type { Room } from '../online/room'

// 친구 대전 연결 상태 표시: 기기끼리 직접 이어졌는지(⚡) 서버를 거치는지. 게임 화면 구석에 작게 (부모가 position: relative).
// 여럿이 하는 게임의 방장은 친구 몇 명과 직접 이어졌는지. 직접 연결로 감싼 방이 아니면 아무것도 안 그린다.

export function LinkBadge<M>({ room }: { room: Room<M> }) {
  const direct = isDirectRoom(room) ? room : null
  const [count, setCount] = useState(() => direct?.linkCount() ?? { direct: 0, total: 0 })
  useEffect(() => {
    if (!direct) return
    return direct.onStatus(() => setCount(direct.linkCount()))
  }, [direct])
  if (!direct || count.total === 0) return null
  const all = count.direct === count.total
  const text = all ? '⚡ 직접 연결' : count.direct === 0 ? '서버 경유' : `⚡ 직접 ${count.direct}/${count.total}명`
  return (
    <span className={`link-badge${all ? ' link-badge--direct' : ''}`} title={all ? '기기끼리 직접 이어져 빨라요' : '일부 또는 전부 서버를 거쳐요 (막힌 망)'}>
      {text}
    </span>
  )
}
