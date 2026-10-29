import { noise, tone } from '../../shared/audio/synth'
import type { SoundName } from './play/view'

// 숫자 잇기 효과음 레시피. 모두 Web Audio로 합성한다.

const clack = (delay = 0, gain = 0.4) => noise({ filter: 'bandpass', freq: 2400, q: 4, duration: 0.035, gain, delay })

const RECIPES: Record<SoundName, () => void> = {
  // 내 차례
  turn: () => tone({ freq: 880, type: 'triangle', duration: 0.12, gain: 0.15 }),
  // 누가 내려놓음: 타일 여러 장 딸깍딸깍
  play: () => {
    for (let i = 0; i < 3; i++) clack(i * 0.06)
    tone({ freq: 660, type: 'triangle', duration: 0.12, gain: 0.12, delay: 0.2 })
  },
  // 1장 가져옴: 스윽
  draw: () => noise({ filter: 'highpass', freq: 1500, duration: 0.15, gain: 0.18 }),
  // 타일 고름: 톡
  pick: () => clack(0, 0.25),
  // 줄에 놓음: 딱
  drop: () => {
    clack(0, 0.45)
    tone({ freq: 420, type: 'triangle', duration: 0.05, gain: 0.12 })
  },
  // 못 냄: 뿌
  nope: () => tone({ freq: 220, to: 160, type: 'square', duration: 0.18, gain: 0.08 }),
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
