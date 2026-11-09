import { type Look, decodeLook, encodeLook } from '../art3d/animalKinds'
import { readLocal, writeLocal } from './local'

// 내 캐릭터(동물 + 모자·안경·목 장식·털 색). 안 골랐으면 null — 게임에서 남은 동물을 받는다.
// 저장은 '동물.모자.안경.목.털' 글자 (처음엔 동물 이름만 저장했는데 그것도 그대로 읽힘)

const KEY = 'avatar'

export function loadLook(): Look | null {
  return decodeLook(readLocal(KEY)) ?? null
}

export function saveLook(look: Look): void {
  writeLocal(KEY, encodeLook(look))
}
