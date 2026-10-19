import type { Point } from '../play/pitch'
import { CAMERA_FULL, CAMERA_PITCH, type Camera } from './camera'

/**
 * 타구를 따라가는 카메라. 공이 멀리·높이 갈수록 넓게 보여주고, 공은 화면 오른쪽 부분에 둔다.
 * 공이 홈플레이트에 있을 때는 투수-타자 시점과 똑같아서 전환이 끊기지 않는다.
 */
export function followCamera(ball: Point): Camera {
  const width = Math.min(
    Math.max(
      CAMERA_PITCH.width,
      ball.y * 2.4, // 높이 뜬 공이 화면 위로 나가지 않게
      ball.x * 0.95 + CAMERA_PITCH.width,
      ball.x < 0 ? 2 * (CAMERA_PITCH.centerX + 2 - ball.x) : 0, // 뒤로 간 파울
    ),
    CAMERA_FULL.width,
  )
  return {
    width,
    centerX: Math.max(CAMERA_PITCH.centerX, ball.x - width * 0.3),
  }
}
