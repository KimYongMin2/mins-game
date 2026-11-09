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

describe('꾸미기', () => {
  it('글자로 바꿨다가 되돌리면 같다, 이상한 값은 없음으로', async () => {
    const { decodeLook, encodeLook, assignLooks } = await import('./animalKinds')
    const l = { animal: 'tiger', hat: 'crown', glasses: 'sun', neck: 'bow', fur: 'dark', outfit: 'uniform', tint: 'navy', number: 27 } as const
    expect(decodeLook(encodeLook(l))).toEqual(l)
    expect(decodeLook('cat.hacker.x.y.z')).toEqual({ animal: 'cat', hat: 'none', glasses: 'none', neck: 'none', fur: 'base', outfit: 'shirt', tint: 'red', number: 7 })
    expect(decodeLook('cat.none.none.none.base.uniform.red.500')?.number).toBe(99)
    expect(decodeLook('dragon.cap')).toBeUndefined()
    expect(assignLooks([l, undefined]).map((x) => x.animal)).toEqual(['tiger', 'bear'])
  })
})
