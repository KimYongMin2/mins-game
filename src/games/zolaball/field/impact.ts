import type { Point } from '../play/pitch'

// 배트에 맞은 순간 효과 정보와 화면 흔들림 계산.

export type ImpactPower = 'weak' | 'strong' | 'homerun'

export type Impact = { ms: number; at: Point; power: ImpactPower }

/** 화면 흔들림 (장타·홈런): 맞은 직후 잠깐 */
export function shakeOf(impact: Impact | null | undefined, unit: number): { x: number; y: number } {
  if (!impact || impact.power === 'weak' || impact.ms < 0 || impact.ms > 350) return { x: 0, y: 0 }
  const amp = unit * (impact.power === 'homerun' ? 1.1 : 0.55) * (1 - impact.ms / 350)
  return { x: Math.sin(impact.ms * 0.11) * amp, y: Math.cos(impact.ms * 0.17) * amp }
}
