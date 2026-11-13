import { type ReactNode, useEffect, useState } from 'react'

// 게임 페이지 머리말 (2026-11-13 경기 화면 개편, '오락기 캐비닛' 시안):
// 경기 밖(시작·대기실·결과)은 예전처럼 제목 + 버튼들(소리·나가기), 경기 중엔 왼쪽 위 [메뉴] 버튼 하나로 접고
// 누르면 창이 떠서 그 안에 같은 버튼들(소리·그만하기)을 보여 준다. 메뉴를 열어도 경기는 멈추지 않는다(게임 진행은 그대로).
type Props = {
  className: string
  title: ReactNode
  /** 경기 중이면 메뉴 버튼으로 접음 */
  playing: boolean
  /** 소리 켜기·그만하기/나가기 버튼들 */
  children: ReactNode
}

export function PlayHeader({ className, title, playing, children }: Props) {
  const [open, setOpen] = useState(false)
  const shown = open && playing
  useEffect(() => {
    if (!shown) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [shown])

  if (!playing) {
    return (
      <header className={className}>
        <h1 className="title">{title}</h1>
        {children}
      </header>
    )
  }
  return (
    <header className={`${className} play-bar`}>
      <button type="button" className="play-bar__menu" aria-label="메뉴 열기" aria-expanded={shown} onClick={() => setOpen(true)}>
        <i />
        <i />
        <i />
      </button>
      <h1 className="play-bar__title">{title}</h1>
      {shown && (
        <div className="play-menu" role="dialog" aria-modal="true" aria-label="메뉴" onClick={(e) => e.target === e.currentTarget && setOpen(false)}>
          <div className="play-menu__panel">
            <strong className="play-menu__title">메뉴</strong>
            <p className="play-menu__note">메뉴를 열어 둔 동안에도 경기는 계속돼요.</p>
            <button type="button" className="button button--primary play-menu__back" onClick={() => setOpen(false)} autoFocus>
              경기로 돌아가기
            </button>
            <div className="play-menu__items">{children}</div>
          </div>
        </div>
      )}
    </header>
  )
}
