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
/** 뿅망치가 닿는 거리 (m)와 다시 휘두를 수 있는 간격 */
export const BONK_REACH = 1.9
export const BONK_MS = 700

export type Fishing = 'none' | 'cast' | 'bite'
export type PlayerPub = {
  id: string
  name: string
  avatar?: string
  x: number
  z: number
  r: number
  bed: number | null
  fishing: Fishing
  bob: [number, number] | null
  /** 타고 있는 배 번호 (BOATS) · 올라가 있는 사다리 번호 (LADDERS) */
  ride: number | null
  up: number | null
  /** 앉기·눕기 (아무 데서나, 움직이면 풀림 — 사용자 요청 2026-11-18) */
  act: Act
}
export type Act = 'sit' | 'lie' | null
/** 배 하나: 자리·방향·탄 사람 */
export type BoatPub = [number, number, number, string | null]

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
  /** 뿅망치 (동물의 숲처럼 장난으로 때리기 — 맞아도 낚시는 안 끊김) */
  | { t: 'bonk' }
  /** 배 타기·내리기, 사다리 오르기·내려가기 (사용자 요청 2026-11-18) */
  | { t: 'board'; i: number }
  | { t: 'unboard' }
  | { t: 'climb'; i: number }
  | { t: 'down' }
  | { t: 'pose'; p: Act }

export type ServerMsg =
  | { t: 'init'; you: string; players: PlayerPub[]; saving: boolean; boats: BoatPub[] }
  | { t: 'boats'; l: BoatPub[] }
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
  /** 누가 뿅망치를 휘두름 (to = 맞은 사람, 없으면 허공) */
  | { t: 'bonk'; id: string; to: string | null }
