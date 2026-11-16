import { tone } from '../../shared/audio/synth'

// 그림 맞히기 효과음 (Web Audio 합성)
export type SoundName = 'correct' | 'reveal'

const RECIPES: Record<SoundName, () => void> = {
  // 누가 맞힘: 띵동
  correct: () => {
    tone({ freq: 880, type: 'triangle', duration: 0.12, gain: 0.18 })
    tone({ freq: 1320, type: 'triangle', duration: 0.2, gain: 0.18, delay: 0.1 })
  },
  // 정답 공개: 짧은 팡파르
  reveal: () => [523, 659, 784].forEach((freq, i) => tone({ freq, type: 'square', duration: 0.1, gain: 0.06, delay: i * 0.08 })),
}

export function playSound(name: SoundName) {
  try {
    RECIPES[name]()
  } catch {
    // 오디오를 못 쓰는 환경이면 소리 없이
  }
}
