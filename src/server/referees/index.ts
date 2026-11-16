import type { RefereeFactory } from '../hub'
import { rouletteReferee } from './roulette'

// 서버가 심판을 맡는 게임들 (조작 막기 3단계). 게임 하나씩 늘린다.
export const REFEREES: Record<string, RefereeFactory> = {
  roulette: rouletteReferee,
}
