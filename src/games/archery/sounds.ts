import { noise, tone } from '../../shared/audio/synth'
import type { SoundName } from './play/roundState'

// 양궁 효과음 레시피. 모두 Web Audio로 합성한다.

function thud() {
  noise({ filter: 'lowpass', freq: 700, duration: 0.09, gain: 0.5 })
  tone({ freq: 130, to: 60, type: 'triangle', duration: 0.12, gain: 0.4 })
}

const RECIPES: Record<SoundName, () => void> = {
  // 시위를 당기는 끼익 소리
  draw: () => noise({ filter: 'bandpass', freq: 250, to: 700, q: 5, duration: 0.7, gain: 0.07, attack: 0.25 }),

  // 시위가 튕기는 소리
  release: () => {
    tone({ freq: 240, to: 110, type: 'triangle', duration: 0.22, gain: 0.3 })
    noise({ filter: 'highpass', freq: 3000, duration: 0.05, gain: 0.25 })
  },

  // 과녁에 꽂히는 소리
  hit: thud,

  // 10점: 꽂히는 소리 + 맑은 종소리
  ten: () => {
    thud()
    tone({ freq: 1320, type: 'sine', duration: 0.35, gain: 0.12, delay: 0.05 })
  },

  // X: 꽂히는 소리 + 올라가는 세 음
  x: () => {
    thud()
    ;[1047, 1319, 1568].forEach((freq, i) =>
      tone({ freq, type: 'triangle', duration: 0.18, gain: 0.16, delay: 0.06 + i * 0.09 }),
    )
  },

  // 빗나감: 바닥에 떨어지는 둔한 소리
  miss: () => {
    noise({ filter: 'lowpass', freq: 400, duration: 0.15, gain: 0.25 })
    tone({ freq: 200, to: 110, type: 'sine', duration: 0.22, gain: 0.1 })
  },

  // 경기 종료 팡파르
  end: () => {
    ;[523, 659, 784].forEach((freq, i) => tone({ freq, type: 'triangle', duration: 0.16, gain: 0.2, delay: i * 0.13 }))
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
