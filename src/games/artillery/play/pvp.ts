import type { ArtilleryView, Draft } from "./view";

// 친구 대전 메시지. 방장 기기가 심판: 화면 상태를 모두에게 보내고, 친구들은 자기 차례에 겨눈 것·발사만 보낸다.
// 방 메시지는 모두에게 가므로 친구끼리도 서로의 메시지를 받지만 방장만 쓴다.

export type ArtilleryMsg =
  /** 방장 → 모두: 경기 시작 (화면을 경기로 바꾸고 첫 상태를 기다린다) */
  | { t: "start" }
  /** 방장 → 모두: 지금 화면 */
  | { t: "view"; v: ArtilleryView }
  /** 친구 → 방장: 내 차례에 겨누는 중 (움직임·각도·힘, 시간 초과 때도 이걸로 쏨). turnNo로 옛 차례 것을 버린다 */
  | ({ t: "aim"; from: string; turnNo: number } & Draft)
  | ({ t: "fire"; from: string; turnNo: number } & Draft);
