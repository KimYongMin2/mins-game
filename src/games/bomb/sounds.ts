import { noise, tone } from '../../shared/audio/synth'
import type { SoundName } from './play/view'

// 폭탄 돌리기 효과음 레시피. 모두 Web Audio로 합성한다.

const RECIPES: Record<SoundName, () => void> = {
  count: () => tone({ freq: 660, type: 'square', duration: 0.08, gain: 0.06 }),
  go: () => tone({ freq: 1320, type: 'square', duration: 0.18, gain: 0.07 }),
  // 째깍: 짧고 높은 딸깍
  tick: () => tone({ freq: 1800, type: 'square', duration: 0.02, gain: 0.04 }),
  // 던짐: 휙
  throw: () => noise({ filter: 'bandpass', freq: 900, to: 2400, q: 1.2, duration: 0.18, gain: 0.25 }),
  // 받음: 툭
  catch: () => tone({ freq: 220, to: 140, type: 'triangle', duration: 0.08, gain: 0.2 }),
  // 펑: 낮고 긴 폭발
  boom: () => {
    noise({ filter: 'lowpass', freq: 1200, to: 200, duration: 0.8, gain: 0.9 })
    tone({ freq: 90, to: 30, type: 'sine', duration: 0.7, gain: 0.6 })
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
