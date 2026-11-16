import type { WordchainView } from './view'

// 친구 대전 메시지. 심판은 우리 게임 서버 (사전 확인도 서버가)
export type WordchainMsg = { t: 'start' } | { t: 'view'; v: WordchainView } | { t: 'say'; word: string }
