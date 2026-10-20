import { noise, tone } from '../../shared/audio/synth'
import type { SoundName } from './play/matchState'

// 팔씨름 효과음 레시피. 모두 Web Audio로 합성한다.

const RECIPES: Record<SoundName, () => void> = {
  // 3·2·1 삑
  count: () => tone({ freq: 660, type: 'square', duration: 0.08, gain: 0.06 }),
  // 시작: 높은 삑
  go: () => tone({ freq: 1320, type: 'square', duration: 0.18, gain: 0.07 }),
  // 연타: 아주 짧은 딱 (많이 나므로 작게)
  tap: () => noise({ filter: 'bandpass', freq: 1800, q: 2, duration: 0.025, gain: 0.12 }),

  // 타이밍 판정
  perfect: () => {
    tone({ freq: 880, type: 'triangle', duration: 0.08, gain: 0.2 })
    tone({ freq: 1320, type: 'triangle', duration: 0.14, gain: 0.2, delay: 0.06 })
  },
  great: () => tone({ freq: 880, type: 'triangle', duration: 0.12, gain: 0.18 }),
  good: () => tone({ freq: 587, type: 'triangle', duration: 0.1, gain: 0.15 }),
  miss: () => tone({ freq: 220, to: 160, type: 'square', duration: 0.12, gain: 0.05 }),

  // 판 결과: 탁자에 쿵
  roundWin: () => {
    noise({ filter: 'lowpass', freq: 600, duration: 0.15, gain: 0.5 })
    tone({ freq: 523, type: 'triangle', duration: 0.12, gain: 0.18, delay: 0.1 })
    tone({ freq: 784, type: 'triangle', duration: 0.2, gain: 0.18, delay: 0.2 })
  },
  roundLose: () => {
    noise({ filter: 'lowpass', freq: 600, duration: 0.15, gain: 0.5 })
    tone({ freq: 330, to: 220, type: 'triangle', duration: 0.3, gain: 0.16, delay: 0.1 })
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
