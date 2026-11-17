import type { Catch, Iro } from './fish'

// 낚시터: 화면 ↔ 게임 서버 심판(src/server/referees/fishing.ts) 메시지. 위치는 화면이 정하고(서버가 빠르기·물 검사),
// 입질·잡힌 물고기·크기·이로치·도감·어항은 서버가 정한다.

export const FISHING_GAME = 'fishing'
/** 한 낚시터 정원 (차면 다음 낚시터) */
export const FISHING_CAPACITY = 16
/** 낚시터 방 번호 (FISH1, FISH2 …) */
export const fishingRoomCode = (n: number) => `FISH${n}`
export const MAX_ROOMS = 5
/** 입질까지 (ms) */
export const BITE_MIN_MS = 7000
export const BITE_MAX_MS = 16000
/** 입질 뒤 이만큼 안에 눌러야 잡힘 */
export const BITE_WINDOW_MS = 5000
/** 어항 칸 */
export const TANK_MAX = 10
export const CHAT_MAX = 60

export type Fishing = 'none' | 'cast' | 'bite'
export type PlayerPub = { id: string; name: string; avatar?: string; x: number; z: number; r: number; bed: number | null; fishing: Fishing; bob: [number, number] | null }

/** 잡은 것 하나 (k = 고유 번호) */
export type BagItem = { k: string; f: string; i: Iro | null; s: number; at: number }
export type DexEntry = { n: number; best: number; iros: Iro[] }
export type Profile = { dex: Record<string, DexEntry>; bag: BagItem[]; tank: string[] }

export type ClientMsg =
  | { t: 'hi' }
  | { t: 'mv'; x: number; z: number; r: number }
  | { t: 'cast' }
  | { t: 'reel' }
  | { t: 'bed'; i: number }
  | { t: 'chat'; text: string }
  | { t: 'tank'; keys: string[] }
  | { t: 'look'; who: string }
  | { t: 'brag'; key: string }

export type ServerMsg =
  | { t: 'init'; you: string; players: PlayerPub[]; saving: boolean }
  | { t: 'pos'; l: [string, number, number, number][] }
  | { t: 'st'; p: PlayerPub }
  | { t: 'gone'; id: string }
  | { t: 'bite'; id: string }
  | { t: 'escape'; id: string }
  | { t: 'catch'; id: string; name: string; c: Catch; big: boolean; best: boolean }
  | { t: 'chat'; id: string; name: string; text: string }
  | { t: 'profile'; profile: Profile }
  | { t: 'tank'; who: string; name: string; items: BagItem[] }
  | { t: 'brag'; id: string; name: string; item: BagItem }
