import { noise, tone } from '../../shared/audio/synth'

// 동물 섬 대작전 효과음 (Web Audio 합성, 음원 파일 없음)
export type SoundName = 'throw' | 'boom' | 'bigBoom' | 'pop' | 'splash' | 'bounce' | 'boing' | 'whiff' | 'land' | 'ouch' | 'turn' | 'reel' | 'gull' | 'jump' | 'dig' | 'win' | 'lose'

const RECIPES: Record<SoundName, () => void> = {
  throw: () => noise({ filter: 'bandpass', freq: 1400, to: 380, q: 1.4, duration: 0.22, gain: 0.18 }),
  boom: () => {
    noise({ filter: 'lowpass', freq: 1200, to: 80, duration: 0.6, gain: 0.45 })
    tone({ freq: 110, to: 38, duration: 0.4, gain: 0.35 })
  },
  bigBoom: () => {
    noise({ filter: 'lowpass', freq: 1200, to: 70, duration: 0.9, gain: 0.6 })
    tone({ freq: 100, to: 34, duration: 0.6, gain: 0.4 })
    noise({ filter: 'highpass', freq: 2500, to: 1200, duration: 0.25, gain: 0.12 })
  },
  pop: () => {
    noise({ filter: 'lowpass', freq: 1500, to: 200, duration: 0.3, gain: 0.28 })
    tone({ freq: 220, to: 90, type: 'triangle', duration: 0.15, gain: 0.12 })
  },
  splash: () => {
    noise({ filter: 'highpass', freq: 1800, to: 600, duration: 0.55, gain: 0.22 })
    noise({ filter: 'lowpass', freq: 700, to: 200, duration: 0.4, gain: 0.18 })
  },
  bounce: () => tone({ freq: 330, to: 210, type: 'triangle', duration: 0.07, gain: 0.12 }),
  boing: () => {
    tone({ freq: 520, to: 180, duration: 0.32, gain: 0.22 })
    tone({ freq: 1040, to: 360, type: 'triangle', duration: 0.18, gain: 0.06 })
  },
  whiff: () => noise({ filter: 'bandpass', freq: 900, to: 400, duration: 0.15, gain: 0.1 }),
  land: () => noise({ filter: 'lowpass', freq: 500, to: 150, duration: 0.12, gain: 0.12 }),
  ouch: () => tone({ freq: 640, to: 380, type: 'square', duration: 0.16, gain: 0.05 }),
  turn: () => {
    tone({ freq: 660, type: 'triangle', duration: 0.09, gain: 0.1 })
    tone({ freq: 990, type: 'triangle', duration: 0.12, gain: 0.1, delay: 0.09 })
  },
  reel: () => noise({ filter: 'bandpass', freq: 2400, to: 3200, q: 6, duration: 0.35, gain: 0.06 }),
  gull: () => {
    tone({ freq: 900, to: 1200, type: 'triangle', duration: 0.12, gain: 0.08 })
    tone({ freq: 1100, to: 1400, type: 'triangle', duration: 0.12, gain: 0.08, delay: 0.15 })
  },
  jump: () => noise({ filter: 'bandpass', freq: 700, to: 1400, duration: 0.1, gain: 0.08 }),
  dig: () => noise({ filter: 'lowpass', freq: 600, to: 200, duration: 0.09, gain: 0.12 }),
  win: () => [523, 659, 784, 1046].forEach((freq, i) => tone({ freq, type: 'triangle', duration: 0.25, gain: 0.12, delay: i * 0.12 })),
  lose: () => [392, 330, 262].forEach((freq, i) => tone({ freq, type: 'triangle', duration: 0.3, gain: 0.1, delay: i * 0.16 })),
}

export function playSound(name: SoundName) {
  try {
    RECIPES[name]()
  } catch {
    // 오디오를 못 쓰는 환경이면 소리 없이
  }
}
