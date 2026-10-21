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

  // 배트를 휘두르는 '휙': 걸러낸 잡음이 올라갔다 내려가며 커졌다 작아짐
  swing: () => {
    noise({ filter: 'bandpass', freq: 350, to: 1600, q: 1.1, duration: 0.24, gain: 0.32, attack: 0.11 })
    noise({ filter: 'bandpass', freq: 1800, to: 700, q: 2, duration: 0.2, gain: 0.08, attack: 0.09, delay: 0.06 })
  },

  // 파울: 빗맞은 '틱' (짧고 가볍게)
  foul: () => {
    noise({ filter: 'highpass', freq: 2200, duration: 0.03, gain: 0.45 })
    noise({ filter: 'bandpass', freq: 1700, q: 7, duration: 0.07, gain: 0.35 })
    tone({ freq: 260, to: 160, type: 'sine', duration: 0.05, gain: 0.15 })
  },

  // 범타·안타: 나무 배트 '딱' — 날카로운 첫 소리 + 나무가 울리는 소리 + 묵직한 울림
  hit: () => {
    noise({ filter: 'highpass', freq: 1500, duration: 0.025, gain: 0.8 })
    noise({ filter: 'bandpass', freq: 1150, q: 12, duration: 0.14, gain: 0.7 })
    tone({ freq: 2300, to: 1800, type: 'triangle', duration: 0.05, gain: 0.18 })
    tone({ freq: 140, to: 60, type: 'sine', duration: 0.09, gain: 0.4 })
  },

  // 2루타·홈런: 제대로 맞은 '빡!' — 더 크고 길게 울리고 구장에 메아리
  crack: () => {
    noise({ filter: 'highpass', freq: 1200, duration: 0.03, gain: 0.7 })
    noise({ filter: 'bandpass', freq: 1050, q: 14, duration: 0.26, gain: 0.9 })
    noise({ filter: 'bandpass', freq: 2400, q: 10, duration: 0.14, gain: 0.35 })
    tone({ freq: 2100, to: 1600, type: 'triangle', duration: 0.07, gain: 0.22 })
    tone({ freq: 120, to: 50, type: 'sine', duration: 0.14, gain: 0.55 })
    // 메아리
    noise({ filter: 'bandpass', freq: 1000, q: 8, duration: 0.2, gain: 0.12, delay: 0.22 })
    noise({ filter: 'bandpass', freq: 950, q: 8, duration: 0.2, gain: 0.05, delay: 0.42 })
  },

  // 홈런 타구가 멀어지는 '쉬이익': 바람 소리가 높은 데서 낮게, 점점 작게
  fly: () => {
    noise({ filter: 'bandpass', freq: 2400, to: 500, q: 1.4, duration: 1.7, gain: 0.16, attack: 0.08, delay: 0.05 })
    tone({ freq: 1100, to: 420, type: 'sine', duration: 1.5, gain: 0.035, attack: 0.1, delay: 0.05 })
  },

  // 관중 함성: 공이 날아가는 동안 차오르고, 박수가 섞인다
  cheer: () => {
    noise({ filter: 'bandpass', freq: 700, to: 1300, q: 0.6, duration: 3.2, gain: 0.26, attack: 0.9, delay: 0.35 })
    noise({ filter: 'bandpass', freq: 2600, q: 1.5, duration: 2.4, gain: 0.07, attack: 0.8, delay: 0.6 })
    for (let i = 0; i < 26; i++) {
      noise({ filter: 'bandpass', freq: 1500 + Math.random() * 1500, q: 1.5, duration: 0.04, gain: 0.05 + Math.random() * 0.05, delay: 0.9 + Math.random() * 2.2 })
    }
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
