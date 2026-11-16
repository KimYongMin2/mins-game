// 표준국어대사전(국립국어원) 오픈 API로 명사인지 확인 — 끝말잇기 (사용자가 고른 방식, 2026-11-16).
// 키는 민스서버 환경 변수 STDICT_KEY (game-server/.env, 저장소엔 없음). 키가 없거나 사전 서버가 안 되면 null(확인 못 함 → 받아 줌).

const env = (globalThis as { process?: { env: Record<string, string | undefined> } }).process?.env ?? {}
const cache = new Map<string, boolean>()

export async function isNoun(word: string): Promise<boolean | null> {
  const key = env.STDICT_KEY
  if (!key) return null
  const hit = cache.get(word)
  if (hit !== undefined) return hit
  try {
    const url = `https://stdict.korean.go.kr/api/search.do?key=${encodeURIComponent(key)}&q=${encodeURIComponent(word)}&req_type=json&type_search=search&advanced=y&method=exact&pos=1&num=10`
    const ctl = new AbortController()
    const timer = setTimeout(() => ctl.abort(), 3000)
    const res = await fetch(url, { signal: ctl.signal })
    clearTimeout(timer)
    if (!res.ok) return null
    const text = (await res.text()).trim()
    // 결과가 없으면 빈 응답이 온다
    if (!text) return remember(word, false)
    const json = JSON.parse(text) as { channel?: { total?: number | string }; error?: unknown }
    if (json.error) return null
    return remember(word, Number(json.channel?.total ?? 0) > 0)
  } catch {
    return null
  }
}

function remember(word: string, ok: boolean): boolean {
  if (cache.size > 20_000) cache.clear()
  cache.set(word, ok)
  return ok
}
