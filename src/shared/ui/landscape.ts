import { useEffect, useState } from 'react'

// 폰 가로 화면 (낚시터·동물 섬 대작전): 전체 화면 + 가로 고정은 안드로이드만 되고, 아이폰은 돌려 달라는 안내만.

export const isTouch = () => typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches
export const isPortrait = () => typeof window !== 'undefined' && window.innerHeight > window.innerWidth

/** 누르는 순간(사용자 입력 안)에 불러야 함 */
export async function goLandscape() {
  if (!isTouch()) return
  try {
    if (!document.fullscreenElement) await document.documentElement.requestFullscreen?.()
    await (screen.orientation as ScreenOrientation & { lock?: (o: string) => Promise<void> }).lock?.('landscape')
  } catch {
    /* 안 되는 브라우저는 안내만 */
  }
}

export function exitLandscape() {
  try {
    ;(screen.orientation as ScreenOrientation & { unlock?: () => void }).unlock?.()
  } catch {
    /* 없음 */
  }
  if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {})
}

/** 폰이 세로로 서 있는지 (돌리면 바로 바뀜) */
export function usePortraitTouch() {
  const [portrait, setPortrait] = useState(() => isTouch() && isPortrait())
  useEffect(() => {
    const on = () => setPortrait(isTouch() && isPortrait())
    window.addEventListener('resize', on)
    window.addEventListener('orientationchange', on)
    return () => {
      window.removeEventListener('resize', on)
      window.removeEventListener('orientationchange', on)
    }
  }, [])
  return portrait
}
