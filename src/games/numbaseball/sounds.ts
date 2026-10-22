import { noise, tone } from '../../shared/audio/synth'
import type { SoundName } from './play/matchState'

// 숫자야구 효과음 레시피. 모두 Web Audio로 합성한다.

const RECIPES: Record<SoundName, () => void> = {
  // 내 숫자 정함: 자물쇠 잠그는 딸깍
  lock: () => {
    noise({ filter: 'bandpass', freq: 3000, q: 4, duration: 0.04, gain: 0.3 })
    tone({ freq: 880, type: 'triangle', duration: 0.08, gain: 0.12, delay: 0.05 })
  },

  // 아웃: 낮게 툭
  out: () => tone({ freq: 220, to: 150, type: 'square', duration: 0.2, gain: 0.07 }),

  // 스트라이크·볼이 있음: 짧게 띵
  hit: () => {
    noise({ filter: 'bandpass', freq: 1800, q: 2, duration: 0.05, gain: 0.25 })
    tone({ freq: 740, type: 'triangle', duration: 0.15, gain: 0.18, delay: 0.03 })
  },

  // 맞힘: 야구 '딱!' 뒤로 올라가는 팡파르
  solve: () => {
    noise({ filter: 'highpass', freq: 1500, duration: 0.07, gain: 0.5 })
    ;[523, 659, 784, 1047].forEach((freq, i) => tone({ freq, type: 'triangle', duration: 0.14, gain: 0.18, delay: 0.08 + i * 0.09 }))
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
