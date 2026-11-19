import { useEffect, useMemo, useState } from 'react'
import { DEX_FISH, IRO, RARITY, fishById, isBig } from '../play/fish'
import { type BagItem, type Profile, TANK_MAX } from '../play/protocol'
import { fishSvg } from '../field/fishArt'
import { DEX_BUGS, HABITAT_NAME, TIME_NAME, isBugId } from '../play/bugs'

// 도감 · 내 어항 · 남의 어항 · 자랑하기 창 (낚시터 위에 아래에서 올라옴)

function Sheet({ title, sub, onClose, children }: { title: string; sub?: string; onClose: () => void; children: React.ReactNode }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])
  return (
    <div className="fs-sheet" role="dialog" aria-modal="true" aria-label={title} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="fs-sheet__panel">
        <div className="fs-sheet__head">
          <h2>{title}</h2>
          {sub && <small>{sub}</small>}
          <button type="button" className="fs-key" onClick={onClose}>
            닫기
          </button>
        </div>
        <div className="fs-sheet__body">{children}</div>
      </div>
    </div>
  )
}

const Art = ({ id, iro = null, silhouette = false, bg }: { id: string; iro?: BagItem['i']; silhouette?: boolean; bg?: 'sea' | 'fresh' | 'forest' | 'meadow' }) => (
  <span className="fs-art" dangerouslySetInnerHTML={{ __html: fishSvg(id, iro, { silhouette, bg: bg ?? null }) }} />
)

const itemName = (it: BagItem) => `${it.i ? `${IRO.find((x) => x.id === it.i)?.name} ` : ''}${fishById(it.f)?.name ?? ''}`
/** 자랑할 만한 것 먼저, 그다음 최근 것 */
const sortBag = (bag: BagItem[]) => [...bag].sort((a, b) => Number(isBig({ fish: b.f, iro: b.i, size: b.s })) - Number(isBig({ fish: a.f, iro: a.i, size: a.s })) || b.at - a.at)

export function DexSheet({ profile, onClose }: { profile: Profile | null; onClose: () => void }) {
  const dex = profile?.dex ?? {}
  // 물고기 / 곤충 탭 (곤충 채집 — 사용자 요청 2026-11-19)
  const [tab, setTab] = useState<'fish' | 'bug'>('fish')
  const list = tab === 'fish' ? DEX_FISH : DEX_BUGS
  const caught = list.filter((f) => dex[f.id]).length
  const iros = list.reduce((a, f) => a + (dex[f.id]?.iros.length ?? 0), 0)
  return (
    <Sheet title="도감" sub={`${caught}/${list.length}종 · 이로치 ${iros}개`} onClose={onClose}>
      <div className="fs-dex__tabs" role="tablist">
        {(['fish', 'bug'] as const).map((k) => (
          <button key={k} type="button" role="tab" className="fs-key" aria-selected={tab === k} onClick={() => setTab(k)}>
            {k === 'fish' ? `물고기 ${DEX_FISH.filter((f) => dex[f.id]).length}/${DEX_FISH.length}` : `곤충 ${DEX_BUGS.filter((f) => dex[f.id]).length}/${DEX_BUGS.length}`}
          </button>
        ))}
      </div>
      <ul className="fs-dex">
        {list.map((f) => {
          const e = dex[f.id]
          const r = RARITY[f.rarity]
          const bug = 'bug' in f ? f : null
          const where = bug ? `${bug.zone === 'both' ? '' : HABITAT_NAME[bug.zone]} · ${TIME_NAME[bug.time]}` : f.zone === 'fresh' ? '민물' : '바다'
          return (
            <li key={f.id} className={`fs-dex__item${e ? '' : ' fs-dex__item--none'}`}>
              <Art id={f.id} silhouette={!e} bg={bug ? (bug.zone === 'meadow' ? 'meadow' : 'forest') : f.zone === 'fresh' ? 'fresh' : 'sea'} />
              <div className="fs-dex__info">
                <b>{e ? f.name : '???'}</b>
                <span className="fs-chip" style={{ background: r.color }}>
                  {r.name}
                </span>
              </div>
              <small>{e ? `${e.n}마리 · 최고 ${e.best}cm` : where}</small>
              {e && e.iros.length > 0 && (
                <span className="fs-dex__iros">
                  {e.iros.map((i) => (
                    <i key={i} title={IRO.find((x) => x.id === i)?.name} style={{ background: IRO.find((x) => x.id === i)?.color }} />
                  ))}
                </span>
              )}
            </li>
          )
        })}
      </ul>
    </Sheet>
  )
}

/** 어항 그림: 물고기가 천천히 헤엄침 */
export function TankView({ items }: { items: BagItem[] }) {
  return (
    <div className="fs-tank">
      {items.length === 0 && <p className="fs-tank__empty">아직 어항이 비어 있어요</p>}
      {items.map((it, i) => (
        <div
          key={it.k}
          className="fs-tank__fish"
          style={{
            left: `${8 + ((i * 37) % 70)}%`,
            top: `${10 + ((i * 23) % 62)}%`,
            animationDuration: `${7 + (i % 4) * 1.7}s`,
            animationDelay: `${-i * 1.3}s`,
          }}
          title={`${itemName(it)} ${it.s ? `${it.s}cm` : ''}`}
        >
          <Art id={it.f} iro={it.i} />
        </div>
      ))}
      <span className="fs-tank__sand" />
    </div>
  )
}

export function MyTankSheet({ profile, onSave, onClose }: { profile: Profile | null; onSave: (keys: string[]) => void; onClose: () => void }) {
  const bag = useMemo(() => sortBag(profile?.bag ?? []).filter((x) => !isBugId(x.f)), [profile])
  const [pick, setPick] = useState<string[]>(() => profile?.tank ?? [])
  const byKey = new Map(bag.map((x) => [x.k, x]))
  const toggle = (k: string) => setPick((p) => (p.includes(k) ? p.filter((x) => x !== k) : p.length >= TANK_MAX ? p : [...p, k]))
  return (
    <Sheet title="내 어항" sub={`${pick.length}/${TANK_MAX}마리 · 다른 사람이 나를 누르면 이 어항을 봐요`} onClose={onClose}>
      <TankView items={pick.map((k) => byKey.get(k)).filter((x): x is BagItem => !!x)} />
      <h3 className="fs-sheet__label">잡은 물고기에서 고르기</h3>
      {bag.length === 0 ? (
        <p className="fs-sheet__hint">아직 잡은 물고기가 없어요. 물가에서 던져 보세요</p>
      ) : (
        <ul className="fs-bag">
          {bag.filter((x) => fishById(x.f)?.rarity !== 'junk').map((it) => (
            <li key={it.k}>
              <button type="button" className="fs-bag__item" aria-pressed={pick.includes(it.k)} onClick={() => toggle(it.k)}>
                <Art id={it.f} iro={it.i} />
                <b>{itemName(it)}</b>
                <small>{it.s}cm</small>
              </button>
            </li>
          ))}
        </ul>
      )}
      <button type="button" className="fs-key fs-key--primary fs-sheet__save" onClick={() => onSave(pick)}>
        어항에 넣기
      </button>
    </Sheet>
  )
}

export function OtherTankSheet({ name, items, onClose }: { name: string; items: BagItem[]; onClose: () => void }) {
  return (
    <Sheet title={`${name}님의 어항`} sub={`${items.length}마리`} onClose={onClose}>
      <TankView items={items} />
      <ul className="fs-tank__list">
        {items.map((it) => (
          <li key={it.k}>
            {itemName(it)} {it.s ? `${it.s}cm` : ''}
          </li>
        ))}
      </ul>
    </Sheet>
  )
}

export function BragSheet({ profile, onBrag, onClose }: { profile: Profile | null; onBrag: (key: string) => void; onClose: () => void }) {
  const bag = useMemo(() => sortBag(profile?.bag ?? []).filter((x) => fishById(x.f)?.rarity !== 'junk'), [profile])
  return (
    <Sheet title="자랑하기" sub="고르면 낚시터 모두에게 보여요" onClose={onClose}>
      {bag.length === 0 ? (
        <p className="fs-sheet__hint">아직 자랑할 물고기·곤충이 없어요</p>
      ) : (
        <ul className="fs-bag">
          {bag.map((it) => (
            <li key={it.k}>
              <button type="button" className="fs-bag__item" onClick={() => onBrag(it.k)}>
                <Art id={it.f} iro={it.i} />
                <b>{itemName(it)}</b>
                <small>{it.s}cm</small>
              </button>
            </li>
          ))}
        </ul>
      )}
    </Sheet>
  )
}
