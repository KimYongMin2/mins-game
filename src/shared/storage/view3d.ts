import { readLocal, writeLocal } from './local'

// 3D 시야 설정 (사용자 요청 2026-11-19 — 낚시터에서 멀미가 아직 남): 시야각과 화면 가운데 점.
// 시야각이 좁으면 조금만 돌려도 화면이 휙 지나가 어지럽고, 가운데 고정된 점은 눈이 기준을 잡게 해 줌.
// 내 정보 창·낚시터 [시야]에서 바꾸고 기기에 기억. 3D 화면이 매 프레임 읽어 바로 반영.

const FOV_KEY = 'view-fov'
const DOT_KEY = 'view-dot'
export const FOV_MIN = 45
export const FOV_MAX = 90
export const FOV_DEFAULT = 62

const clampFov = (v: number) => Math.round(Math.min(FOV_MAX, Math.max(FOV_MIN, v)))
let fov = clampFov(Number(readLocal(FOV_KEY) ?? FOV_DEFAULT) || FOV_DEFAULT)
let dot = readLocal(DOT_KEY) !== 'off'
const subs = new Set<() => void>()

/** 3인칭 시야각 (도). 1인칭은 여기에 +14 */
export const viewFov = (): number => fov
/** 화면 가운데 점을 보일지 (기본 켬) */
export const viewDot = (): boolean => dot

export function saveViewFov(v: number): void {
  fov = clampFov(v)
  writeLocal(FOV_KEY, String(fov))
  subs.forEach((f) => f())
}
export function saveViewDot(v: boolean): void {
  dot = v
  writeLocal(DOT_KEY, v ? 'on' : 'off')
  subs.forEach((f) => f())
}
/** 바뀌면 알림 (화면 다시 그리기용) */
export function onViewChange(f: () => void): () => void {
  subs.add(f)
  return () => subs.delete(f)
}
