import { useState } from 'react'
import { ANIMALS, ANIMAL_EMOJI, ANIMAL_NAMES, type AnimalKind } from '../art3d/animalKinds'
import { loadAvatar, saveAvatar } from '../storage/avatar'

// 내 캐릭터 고르기 (메인 화면). 고른 동물은 기기에 저장되고, 3D 게임(폭탄 돌리기·러시안룰렛)에서 나로 나온다.
// 친구 대전이면 방에 들어갈 때 친구들에게도 알린다.

export function AvatarPicker() {
  const [mine, setMine] = useState<AnimalKind | null>(loadAvatar)
  const [open, setOpen] = useState(false)

  function choose(a: AnimalKind) {
    saveAvatar(a)
    setMine(a)
    setOpen(false)
  }

  return (
    <div className="avatar-pick">
      <button type="button" className="button button--small avatar-pick__toggle" onClick={() => setOpen(!open)} aria-expanded={open}>
        <span className="avatar-pick__emoji" aria-hidden>
          {mine ? ANIMAL_EMOJI[mine] : '❔'}
        </span>
        {mine ? `내 캐릭터: ${ANIMAL_NAMES[mine]}` : '내 캐릭터 고르기'}
      </button>
      {open && (
        <div className="avatar-pick__panel" role="radiogroup" aria-label="내 캐릭터">
          {ANIMALS.map((a) => (
            <button
              key={a}
              type="button"
              role="radio"
              aria-checked={mine === a}
              className={`avatar-pick__item${mine === a ? ' avatar-pick__item--on' : ''}`}
              onClick={() => choose(a)}
            >
              <span className="avatar-pick__emoji" aria-hidden>
                {ANIMAL_EMOJI[a]}
              </span>
              {ANIMAL_NAMES[a]}
            </button>
          ))}
          <p className="avatar-pick__note">폭탄 돌리기·러시안룰렛 3D 화면에서 내 캐릭터로 나와요. 친구와 같은 동물이어도 돼요.</p>
        </div>
      )}
    </div>
  )
}
