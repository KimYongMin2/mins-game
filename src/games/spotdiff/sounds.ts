import { tone } from '../../shared/audio/synth'

// 다른 그림 찾기 효과음 (Web Audio 합성)
export type SoundName = 'hit' | 'miss' | 'clear' | 'timeout'

const RECIPES: Record<SoundName, () => void> = {
  hit: () => {
    tone({ freq: 880, type: 'triangle', duration: 0.1, gain: 0.16 })
    tone({ freq: 1320, type: 'triangle', duration: 0.18, gain: 0.16, delay: 0.08 })
  },
  miss: () => tone({ freq: 160, to: 110, type: 'square', duration: 0.2, gain: 0.06 }),
  clear: () => [660, 880, 1100, 1320].forEach((freq, i) => tone({ freq, type: 'square', duration: 0.12, gain: 0.06, delay: i * 0.08 })),
  timeout: () => tone({ freq: 330, to: 180, type: 'triangle', duration: 0.5, gain: 0.12 }),
}

export function playSound(name: SoundName) {
  try {
    RECIPES[name]()
  } catch {
    // 오디오를 못 쓰는 환경이면 소리 없이
  }
}
