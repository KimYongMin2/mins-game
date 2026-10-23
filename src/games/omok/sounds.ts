import { noise, tone } from '../../shared/audio/synth'
import type { SoundName } from './play/matchState'

// 오목 효과음 레시피. 모두 Web Audio로 합성한다.

const RECIPES: Record<SoundName, () => void> = {
  // 카드 뒤집기: 종이 스치는 소리
  flip: () => {
    noise({ filter: 'highpass', freq: 2500, duration: 0.08, gain: 0.25 })
    tone({ freq: 660, type: 'triangle', duration: 0.1, gain: 0.1, delay: 0.06 })
  },

  // 돌 놓기: 나무판에 '딱'
  place: () => {
    noise({ filter: 'bandpass', freq: 1800, q: 3, duration: 0.05, gain: 0.5 })
    tone({ freq: 320, to: 260, type: 'sine', duration: 0.07, gain: 0.2 })
  },

  win: () => {
    ;[523, 659, 784].forEach((freq, i) => tone({ freq, type: 'triangle', duration: 0.16, gain: 0.2, delay: i * 0.12 }))
    tone({ freq: 1047, type: 'triangle', duration: 0.6, gain: 0.22, delay: 0.38 })
  },

  lose: () => {
    ;[392, 330, 262].forEach((freq, i) => tone({ freq, type: 'triangle', duration: 0.22, gain: 0.18, delay: i * 0.18 }))
  },

  draw: () => {
    ;[440, 440].forEach((freq, i) => tone({ freq, type: 'triangle', duration: 0.18, gain: 0.16, delay: i * 0.22 }))
  },
}

export function playSound(name: SoundName) {
  try {
    RECIPES[name]()
  } catch {
    // 오디오를 못 쓰는 환경이면 소리 없이 진행
  }
}
