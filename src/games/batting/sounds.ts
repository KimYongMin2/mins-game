import { noise, tone } from '../../shared/audio/synth'
import type { SoundName } from './play/session'

// 배팅 효과음 레시피. 모두 Web Audio로 합성한다.

const RECIPES: Record<SoundName, () => void> = {
  // 투구: 공이 공기를 가르는 소리
  pitch: () => noise({ filter: 'bandpass', freq: 1200, to: 2400, q: 2, duration: 0.35, gain: 0.08, attack: 0.15 }),

  // 미트에 꽂히는 소리
  mitt: () => {
    noise({ filter: 'lowpass', freq: 900, duration: 0.07, gain: 0.5 })
    tone({ freq: 160, to: 80, type: 'triangle', duration: 0.09, gain: 0.3 })
  },

  // 정타: 맑고 날카로운 딱
  hit: () => {
    noise({ filter: 'highpass', freq: 1800, duration: 0.06, gain: 0.5 })
    tone({ freq: 1100, to: 700, type: 'triangle', duration: 0.12, gain: 0.3 })
  },

  // 빗맞음: 둔한 퍽
  weak: () => {
    noise({ filter: 'bandpass', freq: 600, q: 1.5, duration: 0.08, gain: 0.45 })
    tone({ freq: 300, to: 180, type: 'triangle', duration: 0.1, gain: 0.2 })
  },

  // 헛스윙: 배트가 바람을 가르는 휙
  whiff: () => noise({ filter: 'bandpass', freq: 500, to: 1500, q: 3, duration: 0.18, gain: 0.18, attack: 0.04 }),

  // 홈런: 관중 함성 + 올라가는 음
  homerun: () => {
    noise({ filter: 'bandpass', freq: 900, q: 0.7, duration: 1.8, gain: 0.16, attack: 0.3, delay: 0.1 })
    ;[523, 659, 784, 1047].forEach((freq, i) =>
      tone({ freq, type: 'triangle', duration: 0.18, gain: 0.15, delay: 0.15 + i * 0.1 }),
    )
  },

  // 경기 종료
  end: () => {
    ;[784, 659, 523].forEach((freq, i) => tone({ freq, type: 'triangle', duration: 0.16, gain: 0.2, delay: i * 0.13 }))
    tone({ freq: 784, type: 'triangle', duration: 0.6, gain: 0.2, delay: 0.42 })
  },
}

export function playSound(name: SoundName) {
  try {
    RECIPES[name]()
  } catch {
    // 오디오를 못 쓰는 환경이면 소리 없이 진행
  }
}
