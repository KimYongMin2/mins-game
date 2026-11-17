import { tone } from '../../shared/audio/synth'

// 회의방 알림음 (Web Audio 합성). 사이트 소리를 끄면 같이 꺼진다.

/** 누가 들어옴: 낮은 음 → 높은 음 */
export function playJoin() {
  tone({ freq: 587, type: 'triangle', duration: 0.12, gain: 0.12 })
  tone({ freq: 880, type: 'triangle', duration: 0.18, gain: 0.12, delay: 0.09 })
}

/** 누가 나감: 높은 음 → 낮은 음 */
export function playLeave() {
  tone({ freq: 660, type: 'triangle', duration: 0.12, gain: 0.1 })
  tone({ freq: 440, type: 'triangle', duration: 0.2, gain: 0.1, delay: 0.09 })
}

/** 채팅 왔음: 짧은 톡 */
export function playChat() {
  tone({ freq: 1180, type: 'sine', duration: 0.07, gain: 0.06 })
}
