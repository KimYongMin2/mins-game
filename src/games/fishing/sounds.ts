import { noise, tone } from '../../shared/audio/synth'

// 낚시터 효과음 (Web Audio 합성)
type Name = 'cast' | 'bite' | 'catch' | 'big' | 'junk' | 'escape' | 'cheer' | 'bonk' | 'whiff'

const RECIPES: Record<Name, () => void> = {
  // 휙 — 낚싯줄 던지기, 퐁 — 찌가 물에
  cast: () => {
    noise({ filter: 'bandpass', freq: 700, to: 2600, q: 1.1, duration: 0.25, gain: 0.18 })
    tone({ freq: 520, to: 260, type: 'sine', duration: 0.12, gain: 0.1, delay: 0.35 })
  },
  // 퐁퐁 — 입질
  bite: () => {
    tone({ freq: 880, to: 440, type: 'sine', duration: 0.1, gain: 0.16 })
    tone({ freq: 880, to: 440, type: 'sine', duration: 0.1, gain: 0.16, delay: 0.16 })
    noise({ filter: 'lowpass', freq: 900, duration: 0.2, gain: 0.12, delay: 0.05 })
  },
  // 첨벙 + 짧은 축하
  catch: () => {
    noise({ filter: 'lowpass', freq: 1400, to: 300, duration: 0.35, gain: 0.25 })
    ;[660, 880].forEach((f, i) => tone({ freq: f, type: 'triangle', duration: 0.14, gain: 0.12, delay: 0.2 + i * 0.1 }))
  },
  big: () => {
    noise({ filter: 'lowpass', freq: 1600, to: 300, duration: 0.4, gain: 0.3 })
    ;[523, 659, 784, 1046].forEach((f, i) => tone({ freq: f, type: 'triangle', duration: 0.22, gain: 0.14, delay: 0.25 + i * 0.12 }))
  },
  junk: () => {
    noise({ filter: 'lowpass', freq: 900, to: 200, duration: 0.3, gain: 0.2 })
    tone({ freq: 300, to: 180, type: 'square', duration: 0.25, gain: 0.06, delay: 0.2 })
  },
  escape: () => tone({ freq: 440, to: 200, type: 'sine', duration: 0.35, gain: 0.12 }),
  // 뿅! (장난감 망치)
  bonk: () => {
    tone({ freq: 380, to: 1100, type: 'square', duration: 0.12, gain: 0.08 })
    tone({ freq: 1100, to: 620, type: 'triangle', duration: 0.16, gain: 0.08, delay: 0.1 })
  },
  // 허공에 휘두름
  whiff: () => noise({ filter: 'bandpass', freq: 1200, to: 500, q: 1.3, duration: 0.14, gain: 0.12 }),
  // 다른 사람이 큰 걸 잡았을 때 작은 팡파르
  cheer: () => [784, 1046].forEach((f, i) => tone({ freq: f, type: 'sine', duration: 0.12, gain: 0.07, delay: i * 0.1 })),
}

export const playSound = (name: Name) => RECIPES[name]()
