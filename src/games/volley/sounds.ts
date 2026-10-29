import { noise, tone } from '../../shared/audio/synth'

// 점프 배구 효과음 레시피. 모두 Web Audio로 합성한다.

export type SoundName = 'bump' | 'spike' | 'net' | 'wall' | 'jump' | 'point' | 'lost' | 'whistle' | 'win' | 'lose'

const RECIPES: Record<SoundName, () => void> = {
  // 받기: 퍽
  bump: () => {
    noise({ filter: 'lowpass', freq: 900, duration: 0.08, gain: 0.45 })
    tone({ freq: 260, to: 180, type: 'triangle', duration: 0.08, gain: 0.25 })
  },
  // 스파이크: 팡! (세게)
  spike: () => {
    noise({ filter: 'bandpass', freq: 1800, q: 1.5, duration: 0.12, gain: 0.7 })
    tone({ freq: 180, to: 70, type: 'square', duration: 0.18, gain: 0.18 })
  },
  // 네트: 출렁
  net: () => noise({ filter: 'lowpass', freq: 500, to: 200, duration: 0.25, gain: 0.35 }),
  // 벽: 톡
  wall: () => tone({ freq: 600, type: 'triangle', duration: 0.05, gain: 0.12 }),
  // 점프: 휙
  jump: () => noise({ filter: 'highpass', freq: 2200, to: 3500, duration: 0.1, gain: 0.08 }),
  // 내 점수: 띠링
  point: () => {
    tone({ freq: 784, type: 'triangle', duration: 0.1, gain: 0.2 })
    tone({ freq: 1175, type: 'triangle', duration: 0.22, gain: 0.2, delay: 0.09 })
  },
  // 상대 점수: 뚱
  lost: () => tone({ freq: 330, to: 220, type: 'triangle', duration: 0.25, gain: 0.18 }),
  // 서브 호루라기
  whistle: () => tone({ freq: 2600, to: 2400, type: 'sine', duration: 0.25, gain: 0.1 }),
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
