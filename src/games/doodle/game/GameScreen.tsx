import { useEffect, useRef, useState } from 'react'
import type { Member, Room } from '../../../shared/online/room'
import { REFEREE_FROM } from '../../../shared/online/hubProtocol'
import { decodeLook } from '../../../shared/art3d/animalKinds'
import { loadLook } from '../../../shared/storage/avatar'
import { loadNickname } from '../../../shared/storage/nickname'
import { CANVAS_H, CANVAS_W, CHAT_MAX } from '../constants'
import { ERASER, type InkOp, PEN_COLORS, PEN_WIDTHS, type Stroke, applyOps } from '../play/ink'
import type { DoodleMsg } from '../play/pvp'
import type { DoodleView } from '../play/view'
import type { GameSummary } from '../records'
import { playSound } from '../sounds'

// 경기 화면. 심판은 우리 게임 서버: 사람마다 화면(view)을 받고, 고르기·답·보기를 서버에 보낸다.
// 그림은 그리는 사람이 0.04초마다 묶어 보내고(서버를 거쳐 모두에게), 받는 쪽은 바뀐 선만 바로 그린다.

type Props = {
  room: Room<DoodleMsg>
  /** 방장: 시작할 때 방에 있던 친구들 */
  members: Member[]
  onFinish: (s: GameSummary) => void
  onQuit: () => void
}

/** 그림 묶어 보내는 간격 */
const SEND_MS = 40

function drawStroke(ctx: CanvasRenderingContext2D, s: Stroke, from = 0) {
  ctx.strokeStyle = s.c
  ctx.fillStyle = s.c
  ctx.lineWidth = s.w
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  const p = s.p
  if (p.length === 2) {
    ctx.beginPath()
    ctx.arc(p[0], p[1], s.w / 2, 0, Math.PI * 2)
    ctx.fill()
    return
  }
  ctx.beginPath()
  const start = Math.max(0, from - 2)
  ctx.moveTo(p[start], p[start + 1])
  for (let i = start + 2; i < p.length; i += 2) ctx.lineTo(p[i], p[i + 1])
  ctx.stroke()
}

function summaryOf(v: DoodleView, myId: string): GameSummary {
  const me = v.players.findIndex((p) => p.id === myId)
  const ranking = v.players
    .map((p, i) => ({ name: p.name, score: v.scores[i], rank: v.ranks[i], me: i === me }))
    .sort((a, b) => a.rank - b.rank)
  return { rank: v.ranks[me] ?? v.players.length, score: v.scores[me] ?? 0, ranking }
}

export function GameScreen({ room, members, onFinish, onQuit }: Props) {
  const [serverOk] = useState(() => !!room.hasReferee?.('doodle'))
  const [view, setView] = useState<DoodleView | null>(null)
  const [until, setUntil] = useState(0)
  const [now, setNow] = useState(() => performance.now())
  const [color, setColor] = useState<string>(PEN_COLORS[0])
  const [width, setWidth] = useState<number>(PEN_WIDTHS[1])
  const [text, setText] = useState('')
  const myId = room.myId

  const canvasRef = useRef<HTMLCanvasElement>(null)
  const strokesRef = useRef<Stroke[]>([])
  const turnRef = useRef(-1)
  const viewRef = useRef<DoodleView | null>(null)
  const pendingRef = useRef<InkOp[]>([])
  const penRef = useRef<{ id: number; last: [number, number] } | null>(null)

  const redraw = () => {
    const ctx = canvasRef.current?.getContext('2d')
    if (!ctx) return
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H)
    for (const s of strokesRef.current) drawStroke(ctx, s)
  }

  /** 바뀐 그림 넣기: 선 시작·이어 그리기는 그 부분만, 지우기는 다시 그림 */
  const apply = (ops: readonly InkOp[]) => {
    const before = strokesRef.current
    strokesRef.current = applyOps(before, ops)
    const ctx = canvasRef.current?.getContext('2d')
    if (!ctx || ops.some((o) => o.op === 'u' || o.op === 'x')) return redraw()
    for (const o of ops) {
      if (o.op !== 's' && o.op !== 'a') continue
      const s = strokesRef.current.find((x) => x.id === o.id)
      if (!s) continue
      if (o.op === 's') drawStroke(ctx, s)
      else if (o.op === 'a') drawStroke(ctx, s, s.p.length - o.p.length)
    }
  }

  // 방장: 서버에 심판을 맡김 (씨앗값·제시어는 서버가)
  useEffect(() => {
    if (!serverOk || room.role !== 'host') return
    room.startReferee?.('doodle', {
      players: [
        { id: room.myId, name: loadNickname() ?? '나', avatar: loadLook() ?? undefined },
        ...members.map((m) => ({ id: m.id, name: m.nickname, avatar: decodeLook(m.avatar) })),
      ],
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // 메시지: 화면·그림 전부는 서버가 보낸 것만, 그림 조각은 지금 그리는 사람 것만
  useEffect(() => {
    let synced = false
    const off = room.onMessage((msg, from) => {
      if (msg.t === 'view' && from === REFEREE_FROM) {
        const v = msg.v
        if (v.turnNo !== turnRef.current) {
          turnRef.current = v.turnNo
          strokesRef.current = []
          redraw()
        }
        // 처음 받은 화면이면 지금까지 그림을 달라고 (중간에 들어왔거나 다시 붙었을 때)
        if (!synced) {
          synced = true
          room.send({ t: 'inkSync' })
        }
        const prev = viewRef.current
        if (prev && v.log.length && prev.log.at(-1)?.seq !== v.log.at(-1)?.seq && v.log.at(-1)?.kind === 'correct') playSound('correct')
        if (prev && prev.phase !== v.phase && v.phase === 'reveal') playSound('reveal')
        viewRef.current = v
        setView(v)
        setUntil(performance.now() + v.leftMs)
      } else if (msg.t === 'inkAll' && from === REFEREE_FROM && msg.turn === turnRef.current) {
        strokesRef.current = []
        apply(msg.ops)
        if (!msg.ops.length) redraw()
      } else if (msg.t === 'ink') {
        const v = viewRef.current
        if (!v || v.drawer === null || v.players[v.drawer]?.id !== from || msg.turn !== v.turnNo) return
        apply(msg.ops)
      }
    })
    return off
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [room])

  // 남은 시간 표시용 시계
  useEffect(() => {
    const id = setInterval(() => setNow(performance.now()), 200)
    return () => clearInterval(id)
  }, [])

  // 그리는 사람: 모아 둔 그림을 0.04초마다 보냄
  useEffect(() => {
    const id = setInterval(() => {
      const ops = pendingRef.current
      if (!ops.length || !viewRef.current) return
      pendingRef.current = []
      room.send({ t: 'ink', turn: viewRef.current.turnNo, ops })
    }, SEND_MS)
    return () => clearInterval(id)
  }, [room])

  useEffect(redraw, [])

  // 끝나면 결과로
  const finished = useRef(false)
  useEffect(() => {
    if (!view || view.phase !== 'done' || finished.current || now < until) return
    finished.current = true
    onFinish(summaryOf(view, myId))
  }, [view, now, until, onFinish, myId])

  const me = view ? view.players.findIndex((p) => p.id === myId) : -1
  const drawing = !!view && view.phase === 'draw' && view.drawer === me
  const left = Math.ceil(Math.max(0, until - now) / 1000)

  const queue = (ops: InkOp[]) => {
    apply(ops)
    pendingRef.current.push(...ops)
  }

  function pointOf(e: React.PointerEvent<HTMLCanvasElement>): [number, number] {
    const r = e.currentTarget.getBoundingClientRect()
    const x = Math.round(((e.clientX - r.left) / r.width) * CANVAS_W)
    const y = Math.round(((e.clientY - r.top) / r.height) * CANVAS_H)
    return [Math.min(CANVAS_W, Math.max(0, x)), Math.min(CANVAS_H, Math.max(0, y))]
  }

  function down(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawing) return
    e.currentTarget.setPointerCapture(e.pointerId)
    const p = pointOf(e)
    const id = (Date.now() % 1e8) * 10 + Math.floor(Math.random() * 10)
    penRef.current = { id, last: p }
    queue([{ op: 's', id, c: color, w: width, p }])
  }

  function move(e: React.PointerEvent<HTMLCanvasElement>) {
    const pen = penRef.current
    if (!drawing || !pen) return
    const p = pointOf(e)
    // 너무 가까운 점은 건너뜀 (보낼 양 줄이기)
    if (Math.hypot(p[0] - pen.last[0], p[1] - pen.last[1]) < 3) return
    pen.last = p
    queue([{ op: 'a', id: pen.id, p }])
  }

  const up = () => {
    penRef.current = null
  }

  function submit(e: React.FormEvent) {
    e.preventDefault()
    const t = text.trim()
    if (!t || !view?.canGuess) return
    room.send({ t: 'guess', text: t })
    setText('')
  }

  if (!serverOk) {
    return (
      <section className="dd-game">
        <p className="dd-notice" role="alert">
          게임 서버를 준비하는 중이에요. 몇 분 뒤에 다시 시작해 주세요.
        </p>
        <button type="button" className="button" onClick={onQuit}>
          나가기
        </button>
      </section>
    )
  }

  const nameOf = (i: number | null) => (i === null ? '' : i === me ? '나' : (view?.players[i]?.name ?? ''))
  const wordLine = (() => {
    if (!view) return '연결하는 중…'
    if (view.phase === 'intro') return '곧 시작해요'
    if (view.phase === 'choose') return view.options ? '그릴 제시어를 골라요' : `${nameOf(view.drawer)}님이 제시어를 고르는 중`
    if (view.phase === 'draw') return view.word ? `제시어: ${view.word}` : `${'○'.repeat(view.wordLength ?? 0)} (${view.wordLength}글자)`
    if (view.phase === 'reveal') return `정답: ${view.word}`
    return '끝!'
  })()

  return (
    <section className="dd-game">
      <div className="dd-top">
        <span className="dd-top__turn">
          {view ? `${view.turnNo + 1}/${view.turns}` : ''} {view?.drawer !== null && view ? `· ${nameOf(view.drawer)} 그림` : ''}
        </span>
        <strong className={`dd-top__word${view?.phase === 'reveal' ? ' dd-top__word--reveal' : ''}`}>{wordLine}</strong>
        <span className={`dd-top__time${left <= 10 && view?.phase === 'draw' ? ' dd-top__time--low' : ''}`}>{view && view.phase !== 'done' ? `${left}초` : ''}</span>
      </div>

      <ul className="dd-players" aria-label="점수">
        {view?.players.map((p, i) => (
          <li key={p.id} className={`${i === view.drawer ? 'dd-players__drawer' : ''}${view.guessed.some((g) => g.player === i) ? ' dd-players__got' : ''}${view.left[i] ? ' dd-players__left' : ''}${i === me ? ' dd-players__me' : ''}`}>
            <span>
              {i === view.drawer ? '✏️ ' : view.guessed.some((g) => g.player === i) ? '✓ ' : ''}
              {i === me ? '나' : p.name}
            </span>
            <b>{view.scores[i]}</b>
          </li>
        ))}
      </ul>

      <div className="dd-board">
        <canvas
          ref={canvasRef}
          className={`dd-canvas${drawing ? ' dd-canvas--drawing' : ''}`}
          width={CANVAS_W}
          height={CANVAS_H}
          onPointerDown={down}
          onPointerMove={move}
          onPointerUp={up}
          onPointerCancel={up}
          aria-label="그림판"
        />
        {view?.phase === 'choose' && view.options && (
          <div className="dd-choose">
            <p>무엇을 그릴까요?</p>
            {view.options.map((w, i) => (
              <button key={w} type="button" className="button button--primary" onClick={() => room.send({ t: 'choose', index: i })}>
                {w}
              </button>
            ))}
          </div>
        )}
      </div>

      {drawing && (
        <div className="dd-tools" role="group" aria-label="그리기 도구">
          <div className="dd-tools__colors">
            {PEN_COLORS.map((c) => (
              <button key={c} type="button" className={`dd-swatch${color === c ? ' dd-swatch--on' : ''}`} style={{ background: c }} aria-label={`색 ${c}`} aria-pressed={color === c} onClick={() => setColor(c)} />
            ))}
            <button type="button" className={`dd-swatch dd-swatch--eraser${color === ERASER ? ' dd-swatch--on' : ''}`} aria-label="지우개" aria-pressed={color === ERASER} onClick={() => setColor(ERASER)}>
              지우개
            </button>
          </div>
          <div className="dd-tools__row">
            {PEN_WIDTHS.map((w) => (
              <button key={w} type="button" className={`dd-width${width === w ? ' dd-width--on' : ''}`} aria-label={`굵기 ${w}`} aria-pressed={width === w} onClick={() => setWidth(w)}>
                <span style={{ width: Math.min(22, w), height: Math.min(22, w) }} />
              </button>
            ))}
            <button type="button" className="button button--small" onClick={() => queue([{ op: 'u' }])}>
              되돌리기
            </button>
            <button type="button" className="button button--small" onClick={() => queue([{ op: 'x' }])}>
              다 지우기
            </button>
          </div>
        </div>
      )}

      {view?.choices && !view.choiceTried && (
        <div className="dd-choices" role="group" aria-label="보기">
          <p>보기로 맞히기 (한 번만 · 점수 절반)</p>
          {view.choices.map((c, i) => (
            <button key={c} type="button" className="button" onClick={() => room.send({ t: 'pick', index: i })}>
              {c}
            </button>
          ))}
        </div>
      )}

      <div className="dd-chat">
        <ol className="dd-chat__log" aria-live="polite">
          {view?.log.map((l) => (
            <li key={l.seq} className={`dd-chat__${l.kind}`}>
              {l.kind === 'chat' && <b>{nameOf(l.player)}</b>} {l.text}
            </li>
          ))}
        </ol>
        {!drawing && (
          <form className="dd-chat__form" onSubmit={submit}>
            <input
              className="input"
              value={text}
              maxLength={CHAT_MAX}
              onChange={(e) => setText(e.target.value)}
              placeholder={view?.canGuess ? '정답을 입력하세요' : view?.phase === 'draw' ? '맞혔어요! 기다려요' : '그림이 시작되면 맞혀요'}
              disabled={!view?.canGuess}
              enterKeyHint="send"
              autoComplete="off"
            />
            <button type="submit" className="button button--primary" disabled={!view?.canGuess || !text.trim()}>
              보내기
            </button>
          </form>
        )}
      </div>

    </section>
  )
}
