import type { RefereeFactory } from '../hub'
import { armwrestleReferee } from './armwrestle'
import { artilleryReferee } from './artillery'
import { bombReferee } from './bomb'
import { chosungReferee } from './chosung'
import { doodleReferee } from './doodle'
import { fightReferee } from './fight'
import { fishingRefereeFactory } from './fishing'
import { memoryReferee } from './memory'
import { nunchiReferee } from './nunchi'
import { omokReferee } from './omok'
import { numbaseballReferee } from './numbaseball'
import { rouletteReferee } from './roulette'
import { survivalReferee } from './survival'
import { tilesReferee } from './tiles'
import { volleyReferee } from './volley'
import { wordchainReferee } from './wordchain'
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
  fight: fightReferee,
  omok: omokReferee,
  doodle: doodleReferee,
  chosung: chosungReferee,
  wordchain: wordchainReferee,
  armwrestle: armwrestleReferee,
  volley: volleyReferee,
  fishing: fishingRefereeFactory,
}
