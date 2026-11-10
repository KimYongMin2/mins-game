import { useEffect, useState } from 'react'
import { ANIMAL_EMOJI, type Look, encodeLook } from '../art3d/animalKinds'
import { canWebGL } from '../art3d/webgl'
import { readLocal, writeLocal } from '../storage/local'

// 내 캐릭터 얼굴 (메인 맨 위 칩). 3D로 한 번 그린 그림을 기기에 기억해 두고 쓴다(모습이 바뀌면 다시 그림).
// WebGL이 안 되거나 그리는 동안은 동물 그림 글자.

const KEY = 'face-v2'

function cached(code: string): string | null {
  try {
    const saved = JSON.parse(readLocal(KEY) ?? 'null') as { code: string; url: string } | null
    return saved && saved.code === code ? saved.url : null
  } catch {
    return null
  }
}

export function AvatarFace({ look, size = 28 }: { look: Look | null; size?: number }) {
  const code = look ? encodeLook(look) : ''
  const [drawn, setDrawn] = useState<{ code: string; url: string } | null>(null)
  const url = drawn?.code === code ? drawn.url : cached(code)

  useEffect(() => {
    if (!look || url || !canWebGL()) return
    let alive = true
    void import('../art3d/snapshot').then(({ snapshotFace }) => {
      const next = snapshotFace(look)
      if (!alive || !next) return
      setDrawn({ code, url: next })
      writeLocal(KEY, JSON.stringify({ code, url: next }))
    })
    return () => {
      alive = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code])

  if (url) return <img className="avatar-face" src={url} width={size} height={size} alt="" />
  return (
    <span className="avatar-face avatar-face--emoji" style={{ width: size, height: size, fontSize: size * 0.7 }} aria-hidden>
      {look ? ANIMAL_EMOJI[look.animal] : '🐻'}
    </span>
  )
}
