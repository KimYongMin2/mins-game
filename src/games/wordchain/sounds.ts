import { tone } from '../../shared/audio/synth'

// 끝말잇기 효과음 (Web Audio 합성)
export type SoundName = 'ok' | 'bad' | 'out' | 'turn'

const RECIPES: Record<SoundName, () => void> = {
  ok: () => tone({ freq: 880, type: 'triangle', duration: 0.1, gain: 0.15 }),
  bad: () => tone({ freq: 220, to: 160, type: 'square', duration: 0.12, gain: 0.05 }),
  out: () => [392, 330, 262].forEach((freq, i) => tone({ freq, type: 'triangle', duration: 0.15, gain: 0.15, delay: i * 0.12 })),
  turn: () => tone({ freq: 660, type: 'sine', duration: 0.12, gain: 0.12 }),
}

export function playSound(name: SoundName) {
  try {
    RECIPES[name]()
  } catch {
    // 오디오를 못 쓰는 환경이면 소리 없이
  }
}
