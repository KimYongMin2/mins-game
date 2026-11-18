import { useEffect, useRef, useState } from 'react'
import type { Member, Room } from '../../../shared/online/room'
import { REFEREE_FROM } from '../../../shared/online/hubProtocol'
import { decodeLook } from '../../../shared/art3d/animalKinds'
import { loadLook } from '../../../shared/storage/avatar'
import { loadNickname } from '../../../shared/storage/nickname'
import { CHAT_MAX } from '../constants'
import type { DoodleMsg } from '../play/pvp'
import type { DoodleView } from '../play/view'
import type { GameSummary } from '../records'
import { playSound } from '../sounds'
import { type SketchHandle, Sketchpad } from './Sketchpad'

// 맞히기 경기 화면. 심판은 우리 게임 서버: 사람마다 화면(view)을 받고, 고르기·답·보기를 서버에 보낸다.
// 그림은 그리는 사람이 0.04초마다 묶어 보내고(서버를 거쳐 모두에게), 받는 쪽은 바뀐 선만 바로 그린다.

type Props = {
  room: Room<DoodleMsg>
  /** 방장: 시작할 때 방에 있던 친구들 */
  members: Member[]
  onFinish: (s: GameSummary) => void
  onQuit: () => void
}

function summaryOf(v: { players: { id: string; name: string }[]; scores: number[]; ranks: number[] }, myId: string): GameSummary {
  const me = v.players.findIndex((p) => p.id === myId)
  const ranking = v.players.map((p, i) => ({ name: p.name, score: v.scores[i], rank: v.ranks[i], me: i === me })).sort((a, b) => a.rank - b.rank)
  return { rank: v.ranks[me] ?? v.players.length, score: v.scores[me] ?? 0, ranking }
}
export { summaryOf }

/** 방장: 서버에 심판을 맡김 (씨앗값·제시어는 서버가) */
export function startDoodle(room: Room<DoodleMsg>, members: Member[], mode: 'guess' | 'vote') {
  room.startReferee?.('doodle', {
    mode,
    players: [
      { id: room.myId, name: loadNickname() ?? '나', avatar: loadLook() ?? undefined },
      ...members.map((m) => ({ id: m.id, name: m.nickname, avatar: decodeLook(m.avatar) })),
    ],
  })
}

export function ServerNotReady({ onQuit }: { onQuit: () => void }) {
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

export function GameScreen({ room, members, onFinish, onQuit }: Props) {
  const [serverOk] = useState(() => !!room.hasReferee?.('doodle'))
  const [view, setView] = useState<DoodleView | null>(null)
  const [until, setUntil] = useState(0)
  const [now, setNow] = useState(() => performance.now())
  const [text, setText] = useState('')
  const myId = room.myId
  const padRef = useRef<SketchHandle>(null)
  const turnRef = useRef(-1)
  const viewRef = useRef<DoodleView | null>(null)

  useEffect(() => {
    if (serverOk && room.role === 'host') startDoodle(room, members, 'guess')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // 메시지: 화면·그림 전부는 서버가 보낸 것만, 그림 조각은 지금 그리는 사람 것만
  useEffect(() => {
    let synced = false
    return room.onMessage((msg, from) => {
      if (msg.t === 'view' && from === REFEREE_FROM) {
        const v = msg.v
        if (v.turnNo !== turnRef.current) {
          turnRef.current = v.turnNo
          padRef.current?.load([])
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
        padRef.current?.load(msg.ops)
      } else if (msg.t === 'ink') {
        const v = viewRef.current
        if (!v || v.drawer === null || v.players[v.drawer]?.id !== from || msg.turn !== v.turnNo) return
        padRef.current?.apply(msg.ops)
      }
    })
  }, [room])

  // 남은 시간 표시용 시계
  useEffect(() => {
    const id = setInterval(() => setNow(performance.now()), 200)
    return () => clearInterval(id)
  }, [])

  // 끝나면 결과로
  const finished = useRef(false)
  useEffect(() => {
    if (!view || view.phase !== 'done' || finished.current || now < until) return
    finished.current = true
    onFinish(summaryOf(view, myId))
  }, [view, now, until, onFinish, myId])

  if (!serverOk) return <ServerNotReady onQuit={onQuit} />

  const me = view ? view.players.findIndex((p) => p.id === myId) : -1
  const drawing = !!view && view.phase === 'draw' && view.drawer === me
  const left = Math.ceil(Math.max(0, until - now) / 1000)

  function submit(e: React.FormEvent) {
    e.preventDefault()
    const t = text.trim()
    if (!t || !view?.canChat) return
    room.send({ t: 'guess', text: t })
    setText('')
  }

  const nameOf = (i: number | null) => (i === null ? '' : i === me ? '나' : (view?.players[i]?.name ?? ''))
  const wordLine = (() => {
    if (!view) return '연결하는 중…'
    if (view.phase === 'intro') return '곧 시작해요'
    if (view.phase === 'choose') return view.options ? '그릴 제시어를 골라요' : `${nameOf(view.drawer)}님이 제시어를 고르는 중`
    if (view.phase === 'draw')
      return view.word ? `제시어: ${view.word}` : '그림을 보고 맞혀요'
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

      <Sketchpad padRef={padRef} drawing={drawing} onSend={(ops) => viewRef.current && room.send({ t: 'ink', turn: viewRef.current.turnNo, ops })}>
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
      </Sketchpad>

      <div className="dd-chat">
        <ol className="dd-chat__log" aria-live="polite">
          {view?.log.map((l) => (
            <li key={l.seq} className={`dd-chat__${l.kind}${l.secret !== undefined ? ' dd-chat__secret' : ''}`}>
              {l.secret !== undefined && <small>정답 들어감 · 맞힌 사람만 보여요</small>}
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
              placeholder={view?.canGuess ? '정답을 입력하세요' : view?.phase === 'draw' ? '채팅 (정답을 쓰면 못 맞힌 사람에겐 안 보여요)' : view?.canChat ? '채팅' : '제시어를 고르는 중이에요'}
              disabled={!view?.canChat}
              enterKeyHint="send"
              autoComplete="off"
            />
            <button type="submit" className="button button--primary" disabled={!view?.canChat || !text.trim()}>
              보내기
            </button>
          </form>
        )}
      </div>
    </section>
  )
}
