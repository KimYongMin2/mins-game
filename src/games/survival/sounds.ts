import { noise, tone } from '../../shared/audio/synth'
import type { SoundName } from './play/view'

// 서바이벌 효과음 레시피. 모두 Web Audio로 합성한다.

const RECIPES: Record<SoundName, () => void> = {
  count: () => tone({ freq: 660, type: 'square', duration: 0.1, gain: 0.06 }),
  // 맵이 줄어듦: 내려가는 웅 소리
  shrink: () => {
    tone({ freq: 420, to: 160, type: 'sawtooth', duration: 0.7, gain: 0.05 })
    noise({ filter: 'lowpass', freq: 600, duration: 0.6, gain: 0.15 })
  },
  go: () => tone({ freq: 1320, type: 'square', duration: 0.15, gain: 0.06 }),
  place: () => tone({ freq: 900, type: 'triangle', duration: 0.05, gain: 0.15 }),
  // 확정: 철컥 (장전)
  lock: () => {
    noise({ filter: 'bandpass', freq: 2500, q: 3, duration: 0.04, gain: 0.35 })
    noise({ filter: 'bandpass', freq: 1600, q: 3, duration: 0.05, gain: 0.35, delay: 0.08 })
  },
  reveal: () => noise({ filter: 'highpass', freq: 1500, duration: 0.08, gain: 0.35 }),
  // 탕!
  shot: () => {
    noise({ filter: 'lowpass', freq: 1800, duration: 0.25, gain: 0.6 })
    tone({ freq: 160, to: 50, type: 'sine', duration: 0.2, gain: 0.3 })
  },
  hit: () => tone({ freq: 300, to: 120, type: 'square', duration: 0.35, gain: 0.07 }),
  win: () => {
    ;[523, 659, 784].forEach((freq, i) => tone({ freq, type: 'triangle', duration: 0.16, gain: 0.2, delay: i * 0.12 }))
    tone({ freq: 1047, type: 'triangle', duration: 0.6, gain: 0.22, delay: 0.38 })
  },
  lose: () => {
    ;[392, 330, 262].forEach((freq, i) => tone({ freq, type: 'triangle', duration: 0.22, gain: 0.18, delay: i * 0.18 }))
  },
}

export function playSound(name: SoundName) {
  try {
    RECIPES[name]()
  } catch {
    // 오디오를 못 쓰는 환경이면 소리 없이 진행
  }
}
