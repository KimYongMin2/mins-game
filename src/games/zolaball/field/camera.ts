// 카메라는 월드(미터)의 어느 가로 구간을 화면에 보여줄지 정한다.
// 세로 범위는 화면 비율로 정해지고, 지면은 항상 아래쪽 GROUND_RATIO 위치에 둔다.
export type Camera = {
  centerX: number
  width: number
}

export const FIELD_ASPECT = 16 / 10
const GROUND_RATIO = 0.84

export const CAMERA_PITCH: Camera = { centerX: 9, width: 25 }
export const CAMERA_FULL: Camera = { centerX: 80, width: 176 }

export function viewBoxOf(camera: Camera): string {
  const height = camera.width / FIELD_ASPECT
  const x = camera.centerX - camera.width / 2
  const y = -height * GROUND_RATIO
  return `${x} ${y} ${camera.width} ${height}`
}

/** 줌과 상관없이 화면에서 비슷한 크기로 보이게 할 때 쓰는 단위 (화면 폭의 1%). */
export function screenUnit(camera: Camera): number {
  return camera.width / 100
}
