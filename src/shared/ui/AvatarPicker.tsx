import { Suspense, lazy, useState } from 'react'
import {
  ANIMALS,
  ANIMAL_EMOJI,
  ANIMAL_NAMES,
  FURS,
  FUR_NAMES,
  GLASSES,
  GLASSES_NAMES,
  HATS,
  HAT_NAMES,
  type Look,
  NECKS,
  NECK_NAMES,
  plainLook,
} from '../art3d/animalKinds'
import { canWebGL } from '../art3d/webgl'
import { loadLook, saveLook } from '../storage/avatar'

// 내 캐릭터 고르기·꾸미기 (메인 화면): 동물 + 모자·안경·목 장식·털 색. 기기에 저장되고 3D 게임에서 나로 나온다.
// 친구 대전이면 방에 들어갈 때 친구들에게도 알린다. 미리 보기는 3D(three.js)라 창을 열 때만 불러온다.

const AvatarPreview3D = lazy(() => import('./AvatarPreview3D').then((m) => ({ default: m.AvatarPreview3D })))

type Opt<T extends string> = { list: readonly T[]; names: Record<T, string> }

function Row<T extends string>({ label, value, opt, onPick }: { label: string; value: T; opt: Opt<T>; onPick: (v: T) => void }) {
  return (
    <div className="avatar-pick__row" role="radiogroup" aria-label={label}>
      <span className="avatar-pick__label">{label}</span>
      <div className="avatar-pick__chips">
        {opt.list.map((v) => (
          <button key={v} type="button" role="radio" aria-checked={value === v} className={`avatar-pick__chip${value === v ? ' avatar-pick__chip--on' : ''}`} onClick={() => onPick(v)}>
            {opt.names[v]}
          </button>
        ))}
      </div>
    </div>
  )
}

export function AvatarPicker() {
  const [mine, setMine] = useState<Look | null>(loadLook)
  const [open, setOpen] = useState(false)
  const [use3D] = useState(canWebGL)
  const look = mine ?? plainLook('bear')

  function update(next: Look) {
    saveLook(next)
    setMine(next)
  }

  return (
    <div className="avatar-pick">
      <button type="button" className="button button--small avatar-pick__toggle" onClick={() => setOpen(!open)} aria-expanded={open}>
        <span className="avatar-pick__emoji" aria-hidden>
          {mine ? ANIMAL_EMOJI[mine.animal] : '❔'}
        </span>
        {mine ? `내 캐릭터: ${ANIMAL_NAMES[mine.animal]}` : '내 캐릭터 고르기'}
      </button>
      {open && (
        <div className="avatar-pick__panel">
          {use3D && (
            <Suspense fallback={<div className="avatar-preview" />}>
              <AvatarPreview3D look={look} />
            </Suspense>
          )}
          <div className="avatar-pick__animals" role="radiogroup" aria-label="동물">
            {ANIMALS.map((a) => (
              <button
                key={a}
                type="button"
                role="radio"
                aria-checked={mine?.animal === a}
                className={`avatar-pick__item${mine?.animal === a ? ' avatar-pick__item--on' : ''}`}
                onClick={() => update({ ...look, animal: a })}
              >
                <span className="avatar-pick__emoji" aria-hidden>
                  {ANIMAL_EMOJI[a]}
                </span>
                {ANIMAL_NAMES[a]}
              </button>
            ))}
          </div>
          <Row label="모자" value={look.hat} opt={{ list: HATS, names: HAT_NAMES }} onPick={(hat) => update({ ...look, hat })} />
          <Row label="안경" value={look.glasses} opt={{ list: GLASSES, names: GLASSES_NAMES }} onPick={(glasses) => update({ ...look, glasses })} />
          <Row label="목" value={look.neck} opt={{ list: NECKS, names: NECK_NAMES }} onPick={(neck) => update({ ...look, neck })} />
          <Row label="털 색" value={look.fur} opt={{ list: FURS, names: FUR_NAMES }} onPick={(fur) => update({ ...look, fur })} />
          <p className="avatar-pick__note">폭탄 돌리기·러시안룰렛 3D 화면에서 내 캐릭터로 나와요. 친구와 같은 동물이어도 돼요.</p>
          <button type="button" className="button button--small" onClick={() => setOpen(false)}>
            다 했어요
          </button>
        </div>
      )}
    </div>
  )
}
