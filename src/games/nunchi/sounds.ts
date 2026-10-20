import { noise, tone } from '../../shared/audio/synth'
import type { SoundName } from './play/view'

// 눈치게임 효과음 레시피. 모두 Web Audio로 합성한다.

const RECIPES: Record<SoundName, () => void> = {
  count: () => tone({ freq: 660, type: 'square', duration: 0.08, gain: 0.06 }),
  go: () => tone({ freq: 1320, type: 'square', duration: 0.18, gain: 0.07 }),
  // 누군가 외침: 짧은 뿅
  call: () => tone({ freq: 700, to: 1100, type: 'triangle', duration: 0.1, gain: 0.18 }),
  // 동시에 누름: 부딪히는 소리
  clash: () => {
    noise({ filter: 'bandpass', freq: 2000, q: 2, duration: 0.1, gain: 0.4 })
    noise({ filter: 'bandpass', freq: 1500, q: 2, duration: 0.12, gain: 0.3, delay: 0.06 })
  },
  // 탈락자 발표: 낮은 땡
  out: () => tone({ freq: 220, to: 150, type: 'square', duration: 0.3, gain: 0.07 }),
  // 가위바위보 공개: 짝
  reveal: () => noise({ filter: 'highpass', freq: 1500, duration: 0.08, gain: 0.4 }),
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
