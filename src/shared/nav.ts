import type { ListedRoom } from './online/room'

// 메인 화면에서 게임으로 바로 들어갈 때 쓰는 주소 꼬리 (게임 규칙은 모른다). 사용자 요청 — 방 목록을 메인 게임 창으로 꺼냄:
//   ?mode=pvp                         시작 화면을 건너뛰고 친구 대전(방 목록)으로
//   ?mode=pvp&create=1&name=..&pin=.. 메인에서 고른 대로 바로 방 만들기
//   ?mode=pvp&join=<방id>&name=..&pin=.. 메인에서 고른 방에 바로 들어가기
// 들어온 뒤엔 주소에서 지워서(새로 고침·뒤로 가기 때 다시 방에 들어가지 않게) 한 번만 쓴다.

export type PvpEntry = { kind: 'list' } | { kind: 'create'; name: string; pin: string | null; /** 정해진 방 번호 (게임 바꾸기 — 친구들이 같은 번호로 따라옴) */ id?: string } | { kind: 'join'; room: Pick<ListedRoom, 'id' | 'name'>; pin: string | null }

const params = () => (typeof window === 'undefined' ? new URLSearchParams() : new URLSearchParams(window.location.search))

/** 메인에서 [친구랑 하기]로 들어왔는지 (시작 화면을 건너뛸지) */
export const wantsPvp = (): boolean => params().get('mode') === 'pvp'

const clean = (x: string | null, max: number) => (x ?? '').replace(/[\u0000-\u001f]/g, '').slice(0, max)

/** 주소에 담긴 방 만들기·들어가기 (없으면 목록). 읽기만 한다 */
export function readPvpEntry(): PvpEntry | null {
  return parsePvpEntry(params())
}

/** 주소 꼬리 → 할 일 (테스트용으로 따로) */
export function parsePvpEntry(q: URLSearchParams): PvpEntry | null {
  if (q.get('mode') !== 'pvp') return null
  const pin = /^\d{4}$/.test(q.get('pin') ?? '') ? q.get('pin') : null
  if (q.get('create') === '1') {
    const id = clean(q.get('id'), 12)
    return { kind: 'create', name: clean(q.get('name'), 20) || '방', pin, ...(/^[A-Z0-9]{4,12}$/.test(id) ? { id } : {}) }
  }
  const id = clean(q.get('join'), 16)
  if (id) return { kind: 'join', room: { id, name: clean(q.get('name'), 20) }, pin }
  return { kind: 'list' }
}

/** 주소 꼬리를 지운다 (한 번 쓴 뒤) */
export function clearPvpEntry(): void {
  if (typeof window === 'undefined' || !window.location.search) return
  window.history.replaceState(window.history.state, '', window.location.pathname)
}

/** 메인 게임 창에서 고른 것 → 게임 주소 */
export function pvpLink(path: string, entry: PvpEntry): string {
  const q = new URLSearchParams({ mode: 'pvp' })
  if (entry.kind === 'create') {
    q.set('create', '1')
    q.set('name', entry.name)
    if (entry.id) q.set('id', entry.id)
  } else if (entry.kind === 'join') {
    q.set('join', entry.room.id)
    q.set('name', entry.room.name)
  }
  if (entry.kind !== 'list' && entry.pin) q.set('pin', entry.pin)
  return `${path}?${q.toString()}`
}

/** 대기실 '게임 바꾸기'에서 고를 수 있는 게임들 (메인 목록이 넣어 줌 — shared는 게임을 몰라서) */
export type SwitchTarget = { id: string; title: string; path: string; min: number; max: number }
let targets: SwitchTarget[] = []
export function setSwitchTargets(list: SwitchTarget[]): void {
  targets = list
}
export const switchTargets = (): SwitchTarget[] => targets
