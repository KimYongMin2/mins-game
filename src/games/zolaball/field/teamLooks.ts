import { type Look, decodeLook, opponentLook, plainLook } from '../../../shared/art3d/animalKinds'
import { loadLook } from '../../../shared/storage/avatar'

// 야구 동물 선수 모습: 고른 동물에 팀 색 유니폼·야구모자(다른 모자를 골랐으면 그대로)

function playerLook(base: Look, tint: Look['tint'], number: number): Look {
  return { ...base, outfit: 'uniform', tint, hat: base.hat === 'none' ? 'cap' : base.hat, number }
}

/** 나(파랑, 꾸미기 등번호) / 상대(빨강) — 친구 대전이면 친구가 고른 캐릭터, 봇이면 겹치지 않는 동물 */
export function teamLooks(peerAvatar?: string): { me: Look; opp: Look } {
  const mine = loadLook() ?? plainLook('bear')
  const opp = opponentLook(mine.animal, peerAvatar)
  const oppChose = !!decodeLook(peerAvatar)
  return {
    me: playerLook(mine, 'blue', mine.outfit === 'uniform' ? mine.number : 7),
    opp: playerLook(opp, 'red', oppChose && opp.outfit === 'uniform' ? opp.number : 11),
  }
}
