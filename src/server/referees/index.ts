import type { RefereeFactory } from '../hub'
import { artilleryReferee } from './artillery'
import { bombReferee } from './bomb'
import { memoryReferee } from './memory'
import { nunchiReferee } from './nunchi'
import { numbaseballReferee } from './numbaseball'
import { rouletteReferee } from './roulette'
import { survivalReferee } from './survival'
import { tilesReferee } from './tiles'
import { yutReferee } from './yut'

// 서버가 심판을 맡는 게임들 (조작 막기 3단계). 예전에 방장 폰이 돌리던 규칙 코드를 서버에서 그대로 돌린다.
export const REFEREES: Record<string, RefereeFactory> = {
  roulette: rouletteReferee,
  bomb: bombReferee,
  nunchi: nunchiReferee,
  survival: survivalReferee,
  yut: yutReferee,
  tiles: tilesReferee,
  artillery: artilleryReferee,
  numbaseball: numbaseballReferee,
  memory: memoryReferee,
}
