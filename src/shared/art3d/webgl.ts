// three.js를 안 불러오고 WebGL만 확인 (three는 3D 화면을 열 때만 따로 불러오려고 파일을 나눔)

/** WebGL을 쓸 수 있는지 (안 되면 2D 그림으로) */
export function canWebGL(): boolean {
  try {
    const c = document.createElement('canvas')
    return !!(c.getContext('webgl2') || c.getContext('webgl'))
  } catch {
    return false
  }
}
