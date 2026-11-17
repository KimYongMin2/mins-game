// 음성·화상 서버(LiveKit) 주소. 입장권은 우리 게임 서버가 '이 방 사람'인지 보고 준다 (room.sfuToken, 2026-11-17).
// 예전엔 Vercel 서버 함수(/api/livekit-token)가 방 확인 없이 줘서 비공개 회의방도 코드를 다 넣어 보면 몰래 들어올 수 있었음 — 없앰.

export const SFU_URL = import.meta.env.VITE_LIVEKIT_URL as string | undefined
