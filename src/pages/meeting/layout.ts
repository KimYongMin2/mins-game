// 회의방 보기 방식 (Zoom·Google Meet처럼 사람마다 고름, 사용자 요청 2026-11-17).
// 바둑판 = 모두 같은 크기 · 크게 보기 = 한 사람 크게 + 나머지 작은 줄 · 한 명만 = 한 사람만.
// 크게 볼 사람: 고정한 사람 → 마지막으로 말한 사람 → 카메라 켠 사람 → 다른 사람 아무나 → 나.

export type Layout = 'grid' | 'focus' | 'spotlight'

export const LAYOUTS: { id: Layout; label: string; note: string }[] = [
  { id: 'grid', label: '바둑판', note: '모두 같은 크기로' },
  { id: 'focus', label: '크게 보기', note: '한 사람 크게, 나머지는 작게' },
  { id: 'spotlight', label: '한 명만', note: '말하는 사람(또는 고정한 사람)만' },
]

export const isLayout = (x: unknown): x is Layout => x === 'grid' || x === 'focus' || x === 'spotlight'

/** 나를 가리키는 칸 번호 (다른 사람은 방 접속 번호) */
export const ME = 'me'

export type Arrange = {
  layout: Layout
  /** 나 포함 모든 칸 (나 = ME, 맨 앞) */
  ids: string[]
  /** 카메라를 켠 칸 */
  camera: Set<string>
  pinned: string | null
  /** 마지막으로 말한 사람 (나 빼고) */
  active: string | null
  /** 카메라 끈 사람 숨기기 */
  hideNoCamera: boolean
}

/** 큰 칸(main)과 나머지 칸(rest). 바둑판은 main 없음 */
export function arrange({ layout, ids, camera, pinned, active, hideNoCamera }: Arrange): { main: string | null; rest: string[] } {
  // 숨기기를 켜도 고정한 사람·나는 남긴다 (아무도 안 보이면 이상해서)
  const shown = hideNoCamera ? ids.filter((id) => camera.has(id) || id === pinned || id === ME) : ids
  if (layout === 'grid') return { main: null, rest: shown }
  const others = ids.filter((id) => id !== ME)
  const has = (id: string | null): id is string => !!id && ids.includes(id)
  const main = has(pinned) ? pinned : has(active) ? active : (others.find((id) => camera.has(id)) ?? others[0] ?? ME)
  return { main, rest: layout === 'spotlight' ? [] : shown.filter((id) => id !== main) }
}
