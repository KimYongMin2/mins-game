import { noise, tone } from '../../shared/audio/synth'
import type { SoundName } from './play/matchState'

// 격투 효과음 레시피. 모두 Web Audio로 합성한다.

const RECIPES: Record<SoundName, () => void> = {
  // 자세를 고를 때 짧은 딸깍
  tick: () => tone({ freq: 880, type: 'square', duration: 0.04, gain: 0.05 }),

  // 기 모으기: 올라가는 웅
  charge: () => tone({ freq: 220, to: 660, type: 'sawtooth', duration: 0.35, gain: 0.08, attack: 0.08 }),

  // 방어만 함: 낮은 쿵
  guard: () => tone({ freq: 140, to: 100, type: 'triangle', duration: 0.12, gain: 0.15 }),

  // 막음: 금속성 챙
  block: () => {
    tone({ freq: 1400, to: 900, type: 'square', duration: 0.12, gain: 0.08 })
    noise({ filter: 'highpass', freq: 3000, duration: 0.08, gain: 0.2 })
  },

  // 명중: 묵직한 퍽
  hit: () => {
    noise({ filter: 'lowpass', freq: 1200, duration: 0.12, gain: 0.6 })
    tone({ freq: 180, to: 60, type: 'triangle', duration: 0.18, gain: 0.4 })
  },

  // 강타: 낮고 길게 울리는 쾅
  smash: () => {
    noise({ filter: 'lowpass', freq: 900, duration: 0.25, gain: 0.7 })
    tone({ freq: 120, to: 40, type: 'triangle', duration: 0.4, gain: 0.5 })
    tone({ freq: 60, to: 30, type: 'sine', duration: 0.5, gain: 0.4, delay: 0.03 })
  },

  // 상쇄: 두 번 부딪히는 소리
  clash: () => {
    noise({ filter: 'bandpass', freq: 2000, q: 2, duration: 0.1, gain: 0.4 })
    noise({ filter: 'bandpass', freq: 1500, q: 2, duration: 0.12, gain: 0.3, delay: 0.06 })
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
