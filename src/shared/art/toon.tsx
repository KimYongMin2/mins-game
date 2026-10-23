// 만화풍 그림 도구 (여러 게임이 같이 씀). 굵은 선 팔다리에 진한 외곽선, 번쩍 별 모양.
// 좌표 단위는 쓰는 쪽 SVG 단위 그대로 (미터든 픽셀이든), 외곽선 두께도 그 단위로 넘긴다.

import { TOON_OUTLINE } from './shapes'

/** 굵은 팔다리: 외곽선 먼저, 그 위에 색. outline은 한쪽 외곽선 두께 */
export function Bone({ d, w, color, outline }: { d: string; w: number; color: string; outline: number }) {
  return (
    <>
      <path d={d} fill="none" stroke={TOON_OUTLINE} strokeWidth={w + outline * 2} strokeLinecap="round" strokeLinejoin="round" />
      <path d={d} fill="none" stroke={color} strokeWidth={w} strokeLinecap="round" strokeLinejoin="round" />
    </>
  )
}
