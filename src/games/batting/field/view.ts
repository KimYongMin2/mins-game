import { CELL_HEIGHT, CELL_WIDTH, type Vec3, ZONE } from '../play/pitch'

// 정면 화면의 원근 투영. 포수 뒤(z<0), 심판 눈높이에 카메라를 두고 투수 쪽을 바라본다.
// 화면 좌표는 SVG viewBox(VIEW_W × VIEW_H) 기준, y는 아래가 +.

export const VIEW_W = 360
export const VIEW_H = 400

const CAMERA = { x: 0, y: 1.5, z: -4 }
/** 홈플레이트(z=0)에서 1m가 화면 몇 단위인지. 존이 터치하기 좋은 크기가 되게 정했다 */
const PLATE_SCALE = 300
const FOCAL = PLATE_SCALE * -CAMERA.z
/** 존 가운데가 화면에서 놓이는 높이 */
const ZONE_CENTER_Y = VIEW_H * 0.6
/** 지평선(카메라 높이)의 화면 높이. 존 가운데가 ZONE_CENTER_Y에 오도록 맞춘다 */
export const HORIZON_Y = ZONE_CENTER_Y - (CAMERA.y - (ZONE.top + ZONE.bottom) / 2) * PLATE_SCALE

export type ScreenPoint = { x: number; y: number; scale: number }

/** 3차원 위치 → 화면 위치. scale은 그 거리에서 1m가 몇 화면 단위인지 */
export function project(p: Vec3): ScreenPoint {
  const scale = FOCAL / Math.max(0.1, p.z - CAMERA.z)
  return {
    x: VIEW_W / 2 + (p.x - CAMERA.x) * scale,
    y: HORIZON_Y - (p.y - CAMERA.y) * scale,
    scale,
  }
}

/** 홈플레이트(z=0) 위 존 사각형의 화면 위치 */
export function zoneRect() {
  const tl = project({ x: ZONE.left, y: ZONE.top, z: 0 })
  const br = project({ x: ZONE.right, y: ZONE.bottom, z: 0 })
  return { x: tl.x, y: tl.y, width: br.x - tl.x, height: br.y - tl.y }
}

export const CELL_SIZE = { width: CELL_WIDTH * PLATE_SCALE, height: CELL_HEIGHT * PLATE_SCALE }
