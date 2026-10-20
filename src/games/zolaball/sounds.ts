import { noise, tone } from '../../shared/audio/synth'
import type { SoundName } from './match/matchState'

// 야구 효과음 레시피. 모두 Web Audio로 합성한다.
const RECIPES: Record<SoundName, () => void> = {
  // 공이 바람을 가르는 소리
  pitch: () => noise({ filter: 'bandpass', freq: 500, to: 1800, q: 1.2, duration: 0.28, gain: 0.12, attack: 0.04 }),

  // 미트에 꽂히는 둔탁한 소리
  mitt: () => {
    noise({ filter: 'lowpass', freq: 900, duration: 0.09, gain: 0.5 })
    tone({ freq: 150, to: 70, type: 'triangle', duration: 0.12, gain: 0.45 })
  },

  // 딱! 하는 타격음
  hit: () => {
    noise({ filter: 'highpass', freq: 2500, duration: 0.06, gain: 0.55 })
    tone({ freq: 1400, to: 700, type: 'triangle', duration: 0.08, gain: 0.3 })
    tone({ freq: 380, to: 200, type: 'sine', duration: 0.1, gain: 0.25 })
  },

  // 관중 함성
  cheer: () => {
    noise({ filter: 'bandpass', freq: 900, to: 1400, q: 0.6, duration: 2.4, gain: 0.22, attack: 0.35, delay: 0.15 })
    noise({ filter: 'bandpass', freq: 2600, q: 1.5, duration: 1.8, gain: 0.06, attack: 0.4, delay: 0.3 })
  },

  // 삼진: 내려가는 세 음
  strikeout: () => {
    ;[784, 659, 523].forEach((freq, i) =>
      tone({ freq, type: 'square', duration: 0.12, gain: 0.08, delay: i * 0.11 }),
    )
  },

  // 볼넷: 올라가는 두 음
  walk: () => {
    ;[523, 784].forEach((freq, i) => tone({ freq, type: 'sine', duration: 0.16, gain: 0.18, delay: i * 0.13 }))
  },

  // 경기 종료 팡파르
  gameEnd: () => {
    ;[523, 659, 784].forEach((freq, i) =>
      tone({ freq, type: 'triangle', duration: 0.16, gain: 0.2, delay: i * 0.13 }),
    )
    tone({ freq: 1047, type: 'triangle', duration: 0.7, gain: 0.22, delay: 0.42 })
  },
}

export function playSound(name: SoundName) {
  try {
    RECIPES[name]()
  } catch {
    // 오디오를 못 쓰는 환경이면 소리 없이 진행
  }
}
