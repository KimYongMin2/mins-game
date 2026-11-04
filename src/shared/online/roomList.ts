import type { RealtimeChannel } from '@supabase/supabase-js'
import { getRealtimeClient } from './supabase'

// 열린 방 목록: DB 없이 Supabase Realtime presence로. 방장이 목록 채널에 자기 방을 올려 두고(advertise),
// 목록 화면은 그 채널을 지켜본다(watch). 방장이 나가면(연결이 끊기면) 목록에서 저절로 사라진다 (1~3초).
// 방 안 내용이나 게임은 모른다: 방 정보(T)는 쓰는 쪽이 정한다.

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
