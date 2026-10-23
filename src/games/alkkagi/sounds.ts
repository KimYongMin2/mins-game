import { noise, tone } from '../../shared/audio/synth'
import type { SoundName } from './play/matchState'

// 알까기 효과음 레시피. 모두 Web Audio로 합성한다.

const RECIPES: Record<SoundName, () => void> = {
  // 카드 뒤집기: 종이 스치는 소리
  flip: () => {
    noise({ filter: 'highpass', freq: 2500, duration: 0.08, gain: 0.25 })
    tone({ freq: 660, type: 'triangle', duration: 0.1, gain: 0.1, delay: 0.06 })
  },

  // 손가락으로 튕김: 짧은 '탁'
  shoot: () => {
    noise({ filter: 'bandpass', freq: 2400, q: 3, duration: 0.04, gain: 0.4 })
    tone({ freq: 500, to: 380, type: 'sine', duration: 0.05, gain: 0.12 })
  },

  // 돌끼리 부딪힘: 높고 단단한 '딱'
  hit: () => {
    noise({ filter: 'bandpass', freq: 3200, q: 5, duration: 0.05, gain: 0.55 })
    tone({ freq: 1250, type: 'triangle', duration: 0.06, gain: 0.14 })
  },

  // 판 밖으로 떨어짐: 바닥에 '툭' 굴러감
  fall: () => {
    tone({ freq: 180, to: 110, type: 'sine', duration: 0.18, gain: 0.25, delay: 0.08 })
    noise({ filter: 'lowpass', freq: 600, duration: 0.12, gain: 0.3, delay: 0.08 })
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
