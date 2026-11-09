import { type AnimalKind, asAnimal } from '../art3d/animalKinds'
import { readLocal, writeLocal } from './local'

// 내가 고른 동물 캐릭터 (3D 게임에서 나로 나옴). 안 골랐으면 null — 게임에서 남은 동물을 받는다

const KEY = 'avatar'

export function loadAvatar(): AnimalKind | null {
  return asAnimal(readLocal(KEY)) ?? null
}

export function saveAvatar(animal: AnimalKind): void {
  writeLocal(KEY, animal)
}
