import { tone } from '../../shared/audio/synth'

// 초성 퀴즈 효과음 (Web Audio 합성)
export type SoundName = 'correct' | 'wrong' | 'hint' | 'reveal'

const RECIPES: Record<SoundName, () => void> = {
  correct: () => {
    tone({ freq: 880, type: 'triangle', duration: 0.12, gain: 0.18 })
    tone({ freq: 1320, type: 'triangle', duration: 0.2, gain: 0.18, delay: 0.1 })
  },
  wrong: () => tone({ freq: 220, to: 160, type: 'square', duration: 0.12, gain: 0.05 }),
  hint: () => tone({ freq: 660, type: 'sine', duration: 0.15, gain: 0.12 }),
  reveal: () => [523, 659, 784].forEach((freq, i) => tone({ freq, type: 'square', duration: 0.1, gain: 0.06, delay: i * 0.08 })),
}

export function playSound(name: SoundName) {
  try {
    RECIPES[name]()
  } catch {
    // 오디오를 못 쓰는 환경이면 소리 없이
  }
}
