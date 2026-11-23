import { useEffect, useMemo, useReducer, useRef, useState } from 'react'
import type { Member, Room } from '../../../shared/online/room'
import { REFEREE_FROM } from '../../../shared/online/hubProtocol'
import { randomSeed } from '../../../shared/random'
import { loadNickname } from '../../../shared/storage/nickname'
import { ASK_MS, LOCK_MS } from '../constants'
import { createEngine, engineReducer } from '../play/engine'
import type { SpotMsg } from '../play/pvp'
import { H, W, hitDiff, sceneOf, sceneSvg } from '../play/scene'
import { type SpotView, viewFor } from '../play/view'
import { type GameSummary, formatMs } from '../records'
import { playSound } from '../sounds'

// 다른 그림 찾기 경기 화면. 혼자 하기는 폰에서 심판, 친구 대전은 우리 게임 서버가 심판(누른 곳·시간을 서버가 판정).
// 친구 대전은 누르는 즉시 내 폰에서도 같은 코드로 판정해 바로 보여 주고(기다림 없이), 서버 화면이 오면 그걸 따른다.

type Props =
  | { mode: 'solo'; onFinish: (s: GameSummary) => void; onQuit: () => void }
  | { mode: 'pvp'; room: Room<SpotMsg>; members: Member[]; onFinish: (s: GameSummary) => void; onQuit: () => void }

type Pending = { q: number; i: number; at: number }
type MissMark = { id: number; side: 'A' | 'B'; x: number; y: number }

function summaryOf(v: SpotView, mode: GameSummary['mode']): GameSummary {
  const me = v.me
  const my = v.my
  const results = my?.results ?? []
  return {
    mode,
    rank: v.ranks[me] ?? v.players.length,
    score: my?.score ?? 0,
    ms: v.rows[me]?.doneMs ?? 0,
    found: results.reduce((a, r) => a + r.found, 0),
    total: v.total * 7,
    ranking: v.players
      .map((p, i) => ({ name: p.name, ms: v.rows[i].doneMs, rank: v.ranks[i], me: i === me, left: v.left[i] }))
      .sort((a, b) => a.rank - b.rank),
  }
}

/** 혼자 하기: 폰에서 심판 */
function useSolo(enabled: boolean) {
  const [s, dispatch] = useReducer(engineReducer, undefined, () => createEngine({ now: performance.now(), seed: randomSeed(), players: [{ id: 'me', name: loadNickname() ?? '나' }] }))
  useEffect(() => {
    if (!enabled) return
    const id = setInterval(() => dispatch({ type: 'tick', now: performance.now() }), 100)
    return () => clearInterval(id)
  }, [enabled])
  return { s, dispatch }
}

function Board({ side, svg, onTap, children, locked }: { side: 'A' | 'B'; svg: string; onTap: (side: 'A' | 'B', x: number, y: number) => void; children: React.ReactNode; locked: number }) {
  return (
    <div
      className="sd-board"
      onPointerDown={(e) => {
        if (e.button !== 0) return
        const rect = e.currentTarget.getBoundingClientRect()
        onTap(side, ((e.clientX - rect.left) / rect.width) * W, ((e.clientY - rect.top) / rect.height) * H)
      }}
      onContextMenu={(e) => e.preventDefault()}
    >
      <div className="sd-board__pic" dangerouslySetInnerHTML={{ __html: svg }} />
      <svg className="sd-board__marks" viewBox={`0 0 ${W} ${H}`} aria-hidden="true">
        {children}
      </svg>
      <span className="sd-board__tag">{side}</span>
      {locked > 0 && <div className="sd-board__lock">{Math.ceil(locked / 1000)}초 쉬어요</div>}
    </div>
  )
}

export function GameScreen(props: Props) {
  const solo = props.mode === 'solo'
  const room = props.mode === 'pvp' ? props.room : null
  const [serverOk] = useState(() => solo || !!room?.hasReferee?.('spotdiff'))
  const local = useSolo(solo)
  const [remote, setRemote] = useState<{ v: SpotView; at: number } | null>(null)
  const [now, setNow] = useState(() => performance.now())
  const [pending, setPending] = useState<Pending[]>([])
  const [lockUntil, setLockUntil] = useState(0)
  const [misses, setMisses] = useState<MissMark[]>([])
  const missId = useRef(0)

  const view: SpotView | null = solo ? viewFor(local.s, 'me') : (remote?.v ?? null)
  /** 서버 화면을 받은 뒤 흐른 시간 (혼자 하기는 늘 지금 화면이라 0) */
  // now는 0.1초마다 바뀌어서 화면을 막 받았을 땐 받은 시각보다 이를 수 있음 → 0 밑으로 안 내려가게 (음수면 '쉬는 중'으로 잘못 봐 누른 걸 버렸음)
  const since = solo || !remote ? 0 : Math.max(0, now - remote.at)

  // 친구 대전: 방장이 서버에 심판을 맡기고, 모두 서버 화면을 받는다
  useEffect(() => {
    if (!room || !serverOk) return
    if (room.role === 'host' && props.mode === 'pvp') {
      room.startReferee?.('spotdiff', {
        players: [{ id: room.myId, name: loadNickname() ?? '나' }, ...props.members.map((m) => ({ id: m.id, name: m.nickname }))],
      })
    }
    return room.onMessage((msg, from) => {
      if (msg.t !== 'view' || from !== REFEREE_FROM) return
      setRemote({ v: msg.v, at: performance.now() })
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [room, serverOk])

  useEffect(() => {
    const id = setInterval(() => setNow(performance.now()), 100)
    return () => clearInterval(id)
  }, [])

  const my = view?.my ?? null
  const scene = useMemo(() => (my ? sceneOf(my.seed) : null), [my?.seed]) // eslint-disable-line react-hooks/exhaustive-deps
  const svgs = useMemo(() => (scene && my ? { A: sceneSvg(scene, 'A', `sd${my.seed}`), B: sceneSvg(scene, 'B', `sd${my.seed}`) } : null), [scene]) // eslint-disable-line react-hooks/exhaustive-deps

  // 내가 찾은 곳 = 서버(심판)가 센 것 + 방금 눌러 아직 서버가 안 알려 준 것(2초 안 오면 버림)
  const found = useMemo(() => {
    if (!my) return []
    const extra = solo ? [] : pending.filter((p) => p.q === my.q && !my.found.includes(p.i) && now - p.at < 2000).map((p) => p.i)
    return [...my.found, ...extra]
  }, [my, pending, now, solo])

  const paused = !!my && my.pauseLeftMs - since > 0
  const qLeft = my ? Math.max(0, my.qLeftMs - since) : 0
  const lockLeft = Math.max(my ? my.lockLeftMs - since : 0, lockUntil - now)
  const total = scene?.diffs.length ?? 7
  const lastResult = my?.results.at(-1)
  const revealing = paused && lastResult && !lastResult.cleared && my?.results.length === my.q + 1

  // 소리: 시간 끝
  const resultCount = my?.results.length ?? 0
  const prevResults = useRef(resultCount)
  useEffect(() => {
    if (resultCount > prevResults.current && my?.results.at(-1)?.cleared === false) playSound('timeout')
    prevResults.current = resultCount
  }, [resultCount]) // eslint-disable-line react-hooks/exhaustive-deps

  // 문제가 바뀌면 방금 누른 것·틀림 표시 비우기
  const q = my?.q
  useEffect(() => {
    setPending([])
    setLockUntil(0)
    setMisses([])
  }, [q])

  // 끝: '끝!'을 잠깐 보여 주고 결과로 (마지막으로 받은 화면으로 요약)
  const lastView = useRef(view)
  lastView.current = view
  const isDone = view?.phase === 'done'
  useEffect(() => {
    if (!isDone) return
    const t = setTimeout(() => lastView.current && props.onFinish(summaryOf(lastView.current, solo ? 'solo' : 'pvp')), 1200)
    return () => clearTimeout(t)
  }, [isDone]) // eslint-disable-line react-hooks/exhaustive-deps

  function tap(side: 'A' | 'B', x: number, y: number) {
    if (!view || view.phase !== 'play' || !my || !scene || my.done || paused || lockLeft > 0) return
    const i = hitDiff(scene.diffs, found, x, y)
    if (solo) local.dispatch({ type: 'tap', player: 0, q: my.q, x, y })
    else room!.send({ t: 'tap', q: my.q, x, y })
    if (i >= 0) {
      if (!solo) setPending((ps) => [...ps, { q: my.q, i, at: performance.now() }])
      playSound(found.length + 1 === total ? 'clear' : 'hit')
    } else {
      if (!solo) setLockUntil(performance.now() + LOCK_MS)
      playSound('miss')
      const id = ++missId.current
      setMisses((ms) => [...ms, { id, side, x, y }])
      setTimeout(() => setMisses((ms) => ms.filter((m) => m.id !== id)), 900)
    }
  }

  if (!serverOk) {
    return (
      <section className="sd-game">
        <p className="sd-notice" role="alert">
          게임 서버를 준비하는 중이에요. 몇 분 뒤에 다시 시작해 주세요.
        </p>
        <button type="button" className="button" onClick={props.onQuit}>
          나가기
        </button>
      </section>
    )
  }

  const marks = (side: 'A' | 'B') => (
    <>
      {scene?.diffs.map((d, i) => {
        const got = found.includes(i)
        if (!got && !revealing) return null
        const r = Math.max(d.r, 14) + 2
        return (
          <g key={i} className="sd-mark">
            <circle cx={d.x} cy={d.y} r={r + 2} fill="none" stroke="#1c1748" strokeWidth={2} />
            <circle cx={d.x} cy={d.y} r={r} fill="none" stroke={got ? '#ffd23f' : '#ff5a4e'} strokeWidth={3.5} strokeDasharray={got ? undefined : '6 4'} />
          </g>
        )
      })}
      {misses
        .filter((m) => m.side === side)
        .map((m) => (
          <g key={m.id} className="sd-mark" transform={`translate(${m.x} ${m.y})`}>
            <circle r={11} fill="#ff5a4e" stroke="#1c1748" strokeWidth={2} />
            <path d="M-5 -5 L5 5 M5 -5 L-5 5" stroke="#fff" strokeWidth={2.6} strokeLinecap="round" />
          </g>
        ))}
    </>
  )

  const live = my ? my.liveMs + (view?.phase === 'play' && !paused && !my.done ? since : 0) : 0
  const lowTime = qLeft <= 10_000

  return (
    <section className="sd-game">
      <div className="sd-top">
        <span className="sd-top__q">{my ? `문제 ${Math.min(my.q + 1, view!.total)}/${view!.total}` : ''}</span>
        <span className="sd-dots" aria-label={`${found.length}곳 찾음`}>
          {Array.from({ length: total }, (_, i) => (
            <i key={i} className={i < found.length ? 'on' : ''} />
          ))}
        </span>
        <span className="sd-top__grow" />
        <span className="sd-top__stat">{solo ? `${my?.score ?? 0}점` : `총 ${formatMs(live)}`}</span>
        <span className={`sd-top__time${lowTime && !paused ? ' sd-top__time--low' : ''}`}>{my && !my.done && !paused ? `${Math.ceil(qLeft / 1000)}초` : ''}</span>
      </div>
      <div className="sd-timer" aria-hidden>
        <div className={`sd-timer__fill${lowTime ? ' sd-timer__fill--low' : ''}`} style={{ width: `${(paused ? 0 : qLeft / ASK_MS) * 100}%` }} />
      </div>

      <div className="sd-stage">
        {!view || view.phase === 'intro' || !svgs ? (
          <p className="sd-wait">{view?.phase === 'intro' ? `곧 시작해요 ${Math.ceil(Math.max(0, view.introLeftMs - since) / 1000)}` : '곧 시작해요'}</p>
        ) : my?.done ? (
          <div className="sd-wait">
            <p>{view.phase === 'done' ? '끝!' : '다 풀었어요! 친구들을 기다려요'}</p>
            <p className="sd-wait__sub">내 시간 {formatMs(view.rows[view.me].doneMs)}</p>
          </div>
        ) : (
          <div className="sd-boards" data-seed={my?.seed}>
            <Board side="A" svg={svgs.A} onTap={tap} locked={lockLeft}>
              {marks('A')}
            </Board>
            <Board side="B" svg={svgs.B} onTap={tap} locked={lockLeft}>
              {marks('B')}
            </Board>
            {paused && lastResult && (
              <div className="sd-banner">
                <strong>{lastResult.cleared ? '다 찾았어요!' : '시간 끝!'}</strong>
                <span>
                  {lastResult.cleared
                    ? `${formatMs(lastResult.ms)}`
                    : solo
                      ? `${lastResult.found}곳 찾음 · 빨간 점선이 못 찾은 곳`
                      : `${lastResult.found}곳 찾음 · 못 찾은 ${total - lastResult.found}곳 × 10초 더해요`}
                </span>
              </div>
            )}
          </div>
        )}
      </div>

      {!solo && view && (
        <ul className="sd-players" aria-label="친구들 진행">
          {view.players.map((p, i) => {
            const r = view.rows[i]
            return (
              <li key={p.id} className={`${r.done ? 'sd-players__done' : ''}${view.left[i] ? ' sd-players__left' : ''}${i === view.me ? ' sd-players__me' : ''}`}>
                <span>{i === view.me ? '나' : p.name}</span>
                <b>{view.left[i] ? '나감' : r.done ? formatMs(r.doneMs) : `${r.q + 1}번 · ${r.found}곳`}</b>
              </li>
            )
          })}
        </ul>
      )}
      <p className="sd-help">{solo ? '두 그림 중 아무 데나 다른 곳을 눌러요 · 틀리면 3초 쉬어요' : '빨리 다 찾을수록 1등 · 틀리면 3초 쉬어요 · 못 찾은 곳은 하나에 10초씩 더해요'}</p>
    </section>
  )
}
