import { useState } from 'react'
import { isMuted, setMuted } from '../audio/synth'

/** 효과음 켜기/끄기 버튼. 설정은 기기에 저장된다. */
export function SoundToggle() {
  const [muted, setMutedState] = useState(isMuted)
  return (
    <button
      type="button"
      className="button button--small"
      aria-pressed={!muted}
      aria-label={muted ? '효과음 켜기' : '효과음 끄기'}
      onClick={() => {
        setMuted(!muted)
        setMutedState(!muted)
      }}
    >
      {muted ? '소리 꺼짐' : '소리 켜짐'}
    </button>
  )
}
