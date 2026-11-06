import type { RealtimeChannel } from '@supabase/supabase-js'
import { getRealtimeClient } from './supabase'

// 열린 방 목록: DB 없이 Supabase Realtime presence로. 방장이 목록 채널에 자기 방을 올려 두고(advertise),
// 목록 화면은 그 채널을 지켜본다(watch). 방장이 나가면(연결이 끊기면) 목록에서 저절로 사라진다 (1~3초).
// 방 안 내용이나 게임은 모른다: 방 정보(T)는 쓰는 쪽이 정한다.

/** 목록에 보여 줄 방 이름 최대 길이 */
export const ROOM_NAME_MAX = 20
/** 목록에 한 번에 보여 주는 방 수 (가짜 방을 잔뜩 올려도 화면이 넘치지 않게) */
export const MAX_LISTED = 30

/**
 * 목록 정보 검사 (보안): 목록은 누구나 올릴 수 있어서 믿지 않는다. 모양이 이상한 건 버리고, 이름은 자르고,
 * 같은 번호는 하나만, 최대 MAX_LISTED개. read는 한 개를 검사해 맞으면 고친 값, 아니면 null
 */
export function cleanList<T extends { id: string }>(raw: unknown[], read: (x: Record<string, unknown>) => T | null): T[] {
  const seen = new Set<string>()
  const out: T[] = []
  for (const x of raw) {
    if (typeof x !== 'object' || x === null) continue
    const r = read(x as Record<string, unknown>)
    if (!r || seen.has(r.id)) continue
    seen.add(r.id)
    out.push(r)
    if (out.length >= MAX_LISTED) break
  }
  return out
}

/** 방 이름: 글자만, 앞뒤 공백 없이, ROOM_NAME_MAX자까지. 비면 null */
export function cleanName(v: unknown): string | null {
  if (typeof v !== 'string') return null
  // eslint-disable-next-line no-control-regex -- 보이지 않는 제어 문자를 지우려는 것
  const name = [...v.replace(/[\u0000-\u001f\u007f]/g, '').trim()].slice(0, ROOM_NAME_MAX).join('')
  return name || null
}

export const isInt = (v: unknown, min: number, max: number): v is number => typeof v === 'number' && Number.isInteger(v) && v >= min && v <= max

/** 방 번호: 영문 대문자·숫자 4~12자 */
export const cleanId = (v: unknown): string | null => (typeof v === 'string' && /^[A-Z0-9]{4,12}$/.test(v) ? v : null)


async function channelFor(listId: string): Promise<RealtimeChannel> {
  const supabase = await getRealtimeClient()
  const topic = `list:${listId}`
  // 같은 채널이 남아 있으면 Supabase가 그걸 돌려줘서 꼬인다. 먼저 닫는다
  for (const old of supabase.getChannels()) {
    if (old.topic === `realtime:${topic}`) await supabase.removeChannel(old)
  }
  return supabase.channel(topic, { config: { presence: { key: `r-${Math.random().toString(36).slice(2, 10)}` } } })
}

async function close(channel: RealtimeChannel) {
  const supabase = await getRealtimeClient()
  await supabase.removeChannel(channel)
}

export type Advert<T> = {
  /** 방 정보 바꾸기 (사람 수 등) */
  update(info: T): void
  stop(): void
}

/** 내 방을 목록에 올린다. 접속이 늦어도 바로 돌려주고, 붙으면 올라간다 */
export function advertiseRoom<T extends object>(listId: string, info: T): Advert<T> {
  let latest = info
  let stopped = false
  let channel: RealtimeChannel | null = null
  let ready = false
  void channelFor(listId)
    .then((ch) => {
      if (stopped) return close(ch)
      channel = ch
      ch.subscribe((status) => {
        if (status !== 'SUBSCRIBED' || stopped) return
        ready = true
        void ch.track(latest)
      })
    })
    .catch((e) => console.warn('[list] 방 올리기 실패', e))
  return {
    update(next) {
      latest = next
      if (channel && ready) void channel.track(next)
    },
    stop() {
      stopped = true
      if (channel) void close(channel)
    },
  }
}

/** 목록을 지켜본다. 바뀔 때마다 지금 열린 방들. 연결 못 하면 onError. 멈추는 함수를 돌려준다 */
export function watchRooms<T extends object>(listId: string, onRooms: (rooms: T[]) => void, onError: () => void): () => void {
  let stopped = false
  let channel: RealtimeChannel | null = null
  void channelFor(listId)
    .then((ch) => {
      if (stopped) return close(ch)
      channel = ch
      ch.on('presence', { event: 'sync' }, () => {
        if (stopped) return
        onRooms(Object.values(ch.presenceState<T>()).flatMap((metas) => metas.slice(0, 1)))
      })
      ch.subscribe((status) => {
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') console.warn('[list] 목록 접속 재시도', status)
        // 처음 접속 전엔 빈 목록으로 알려 '불러오는 중'을 끝낸다
        if (status === 'SUBSCRIBED' && !stopped) onRooms(Object.values(ch.presenceState<T>()).flatMap((metas) => metas.slice(0, 1)))
      })
    })
    .catch(() => {
      if (!stopped) onError()
    })
  return () => {
    stopped = true
    if (channel) void close(channel)
  }
}
