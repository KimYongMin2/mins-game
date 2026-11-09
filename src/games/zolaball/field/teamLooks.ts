import { ANIMALS, type Look, plainLook } from '../../../shared/art3d/animalKinds'
import { loadLook } from '../../../shared/storage/avatar'

// 야구 동물 선수 모습: 고른 동물에 팀 색 유니폼·야구모자(다른 모자를 골랐으면 그대로)

function playerLook(base: Look, tint: Look['tint'], number: number): Look {
  return { ...base, outfit: 'uniform', tint, hat: base.hat === 'none' ? 'cap' : base.hat, number }
}

/** 나(파랑, 꾸미기 등번호) / 상대(빨강) — 동물이 겹치지 않게 */
export function teamLooks(): { me: Look; opp: Look } {
  const mine = loadLook() ?? plainLook('bear')
  const others = ANIMALS.filter((a) => a !== mine.animal)
  return {
    me: playerLook(mine, 'blue', mine.outfit === 'uniform' ? mine.number : 7),
    opp: playerLook(plainLook(others[0]), 'red', 11),
  }
}
