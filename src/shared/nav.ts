// 메인 화면에서 게임으로 바로 들어갈 때 쓰는 주소 꼬리 (게임 규칙은 모른다).
// ?mode=pvp 로 열면 시작 화면을 건너뛰고 바로 친구 대전 방 목록으로 (사용자 요청 — 메인에서 [친구랑 하기] 한 번에)

export const wantsPvp = (): boolean => typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('mode') === 'pvp'
