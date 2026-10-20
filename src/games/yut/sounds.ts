import { noise, tone } from '../../shared/audio/synth'
import type { SoundName } from './play/view'

// 윷놀이 효과음 레시피. 모두 Web Audio로 합성한다.

const RECIPES: Record<SoundName, () => void> = {
  // 내 차례
  turn: () => tone({ freq: 880, type: 'triangle', duration: 0.12, gain: 0.15 }),
  // 윷가락 떨어지는 딱딱딱
  throw: () => {
    for (let i = 0; i < 4; i++) noise({ filter: 'bandpass', freq: 1800 + i * 200, q: 3, duration: 0.04, gain: 0.35, delay: i * 0.05 })
  },
  // 윷·모: 딱딱딱 + 올라가는 소리
  bonus: () => {
    for (let i = 0; i < 4; i++) noise({ filter: 'bandpass', freq: 1800 + i * 200, q: 3, duration: 0.04, gain: 0.35, delay: i * 0.05 })
    ;[660, 880, 1100].forEach((freq, i) => tone({ freq, type: 'triangle', duration: 0.1, gain: 0.18, delay: 0.25 + i * 0.08 }))
  },
  // 말 옮김: 톡
  move: () => tone({ freq: 520, type: 'triangle', duration: 0.08, gain: 0.18 }),
  // 잡음: 쾅
  capture: () => {
    noise({ filter: 'lowpass', freq: 900, duration: 0.2, gain: 0.6 })
    tone({ freq: 200, to: 80, type: 'triangle', duration: 0.25, gain: 0.35 })
  },
  // 말이 나감: 띠링
  out: () => {
    tone({ freq: 784, type: 'triangle', duration: 0.1, gain: 0.18 })
    tone({ freq: 1175, type: 'triangle', duration: 0.18, gain: 0.18, delay: 0.08 })
  },
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
