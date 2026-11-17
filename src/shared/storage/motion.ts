import { readLocal, writeLocal } from './local'

// 화면 흔들림 (사용자 요청 2026-11-17 — 3D 게임에서 멀미가 심함). 기본은 끔.
// 끄면: 3D 손카메라 살랑임 · 부딪힐 때 카메라 당김(시야 줌)·흔들림 · 게임마다 넣은 화면 흔들림(폭탄·눈치·러시안룰렛·격투·야구·배구·탱크)을 모두 안 함.
// 캐릭터·물건이 떨리는 건(팔씨름 힘주기, 윷가락, 총 떨림 등) 화면이 아니라서 그대로. 양궁 조준 흔들림은 게임 규칙이라 그대로.
// 내 정보 창에서 켤 수 있고 기기에 기억. <html data-shake='on'|'off'>로 CSS 흔들림도 끈다.

const KEY = 'screen-shake'
let on = readLocal(KEY) === 'on'

/** 화면 흔들림을 쓰는지 */
export const screenShakeOn = (): boolean => on

/** 흔들림 크기에 곱할 값 (켜면 1, 끄면 0) */
export const shakeScale = (): number => (on ? 1 : 0)

export function applyScreenShake(): void {
  document.documentElement.dataset.shake = on ? 'on' : 'off'
}

export function saveScreenShake(value: boolean): void {
  on = value
  writeLocal(KEY, value ? 'on' : 'off')
  applyScreenShake()
}
