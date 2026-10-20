import { noise, tone } from '../../shared/audio/synth'
import type { SoundName } from './play/matchState'

// 짝맞추기 효과음 레시피. 모두 Web Audio로 합성한다.

const RECIPES: Record<SoundName, () => void> = {
  // 카드 뒤집기: 짧은 종이 소리
  flip: () => noise({ filter: 'bandpass', freq: 2500, q: 1.5, duration: 0.06, gain: 0.25 }),

  // 짝 맞음: 올라가는 띵동
  match: () => {
    tone({ freq: 660, type: 'triangle', duration: 0.12, gain: 0.2, delay: 0.05 })
    tone({ freq: 990, type: 'triangle', duration: 0.2, gain: 0.2, delay: 0.15 })
  },

  // 틀림: 낮게 내려가는 뿅
  miss: () => tone({ freq: 300, to: 180, type: 'square', duration: 0.18, gain: 0.06, delay: 0.05 }),

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
