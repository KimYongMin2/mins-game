import type { ReactNode } from 'react'
import { type NavigateFunction, useNavigate } from 'react-router'

// 게임에서 메인으로 돌아가기 (사용자 요청 — 폰 백키가 메인에서 다시 게임·대기실로 가던 문제).
// 메인에서 들어온 게임이면 기록을 하나 되돌아가고(새로 쌓지 않음), 아니면(주소로 바로 들어옴) 지금 기록을 메인으로 바꾼다.
// 그래서 메인에서 백키를 눌러도 방금 나온 게임으로 다시 가지 않는다.

const KEY = 'mins-game:from-home'

/** 메인이 게임으로 보낼 때 표시 (그 게임 주소) */
export function markFromHome(path: string): void {
  try {
    sessionStorage.setItem(KEY, path.split('?')[0])
  } catch {
    // 저장이 안 되면 그냥 메인으로 바꿔 간다
  }
}

export function goHome(navigate: NavigateFunction): void {
  let from: string | null = null
  try {
    from = sessionStorage.getItem(KEY)
    sessionStorage.removeItem(KEY)
  } catch {
    from = null
  }
  // (라우터의 기록 번호는 메인을 처음 연 뒤 0부터라 믿을 수 없어서, 메인이 남긴 표시만 본다)
  if (from === window.location.pathname && window.history.length > 1) navigate(-1)
  else navigate('/', { replace: true })
}

export function HomeLink({ className, children }: { className?: string; children: ReactNode }) {
  const navigate = useNavigate()
  return (
    <a
      href="/"
      className={className}
      onClick={(e) => {
        e.preventDefault()
        goHome(navigate)
      }}
    >
      {children}
    </a>
  )
}
