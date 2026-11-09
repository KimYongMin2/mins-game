import { describe, expect, it } from 'vitest'
import { asAnimal, assignAnimals } from './animalKinds'

describe('동물 정하기', () => {
  it('고른 건 그대로, 안 고른 사람은 남은 동물을 차례로', () => {
    expect(assignAnimals(['fox', undefined, undefined])).toEqual(['fox', 'bear', 'cat'])
    expect(assignAnimals(['cat', 'cat', undefined])).toEqual(['cat', 'cat', 'bear'])
  })
  it('이상한 값은 버린다', () => {
    expect(asAnimal('dragon')).toBeUndefined()
    expect(asAnimal(3)).toBeUndefined()
    expect(asAnimal('panda')).toBe('panda')
  })
})
