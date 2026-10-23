import { noise, tone } from '../../shared/audio/synth'
import type { SoundName } from './play/view'

// 러시안룰렛 효과음 레시피. 모두 Web Audio로 합성한다.

const RECIPES: Record<SoundName, () => void> = {
  // 내 차례: 띵
  turn: () => tone({ freq: 880, type: 'triangle', duration: 0.15, gain: 0.15 }),
  // 겨눔: 짧은 딸깍
  aim: () => noise({ filter: 'bandpass', freq: 3000, q: 4, duration: 0.03, gain: 0.25 }),
  // 공이 젖히기 + 탄창 도는 소리
  cock: () => {
    noise({ filter: 'bandpass', freq: 2200, q: 3, duration: 0.05, gain: 0.4 })
    ;[0.12, 0.2, 0.28].forEach((delay) => noise({ filter: 'bandpass', freq: 4000, q: 6, duration: 0.02, gain: 0.2, delay }))
  },
  // 빈 칸: 찰칵
  click: () => {
    noise({ filter: 'bandpass', freq: 2800, q: 5, duration: 0.04, gain: 0.5 })
    tone({ freq: 1200, type: 'square', duration: 0.03, gain: 0.05 })
  },
  // 탕!
  bang: () => {
    noise({ filter: 'lowpass', freq: 2500, duration: 0.45, gain: 0.8 })
    tone({ freq: 140, to: 40, type: 'sine', duration: 0.35, gain: 0.45 })
  },
  // 총알 다시 넣고 탄창 돌리기: 드르륵
  reload: () => {
    noise({ filter: 'bandpass', freq: 1800, q: 3, duration: 0.05, gain: 0.3 })
    for (let k = 0; k < 8; k++) noise({ filter: 'bandpass', freq: 4200, q: 6, duration: 0.015, gain: 0.18, delay: 0.15 + k * 0.045 })
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
