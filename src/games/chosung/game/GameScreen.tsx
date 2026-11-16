import { useEffect, useReducer, useRef, useState } from 'react'
import type { Member, Room } from '../../../shared/online/room'
import { REFEREE_FROM } from '../../../shared/online/hubProtocol'
import { randomSeed } from '../../../shared/random'
import { loadNickname } from '../../../shared/storage/nickname'
import { CHAT_MAX } from '../constants'
import { createEngine, engineReducer } from '../play/engine'
import type { ChosungMsg } from '../play/pvp'
import { type ChosungView, viewFor } from '../play/view'
import type { GameSummary } from '../records'
import { playSound } from '../sounds'

// 초성 퀴즈 경기 화면. 혼자 하기는 폰에서 심판을 돌리고, 친구 대전은 우리 게임 서버가 심판(정답은 서버만).

type Props =
  | { mode: 'solo'; onFinish: (s: GameSummary) => void; onQuit: () => void }
  | { mode: 'pvp'; room: Room<ChosungMsg>; members: Member[]; onFinish: (s: GameSummary) => void; onQuit: () => void }

function summaryOf(v: ChosungView, myId: string, mode: GameSummary['mode']): GameSummary {
  const me = v.players.findIndex((p) => p.id === myId)
  const ranking = v.players.map((p, i) => ({ name: p.name, score: v.scores[i], rank: v.ranks[i], me: i === me })).sort((a, b) => a.rank - b.rank)
  // 맞힌 문제 수(solved)는 부르는 쪽이 화면을 보며 센 값으로 채운다
  return { mode, rank: v.ranks[me] ?? v.players.length, score: v.scores[me] ?? 0, solved: 0, total: v.total, ranking }
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

export function GameScreen(props: Props) {
  const solo = props.mode === 'solo'
  const room = props.mode === 'pvp' ? props.room : null
  const [serverOk] = useState(() => solo || !!room?.hasReferee?.('chosung'))
  const local = useSolo(solo)
  const [remote, setRemote] = useState<ChosungView | null>(null)
  const [until, setUntil] = useState(0)
  const [now, setNow] = useState(() => performance.now())
  const [text, setText] = useState('')
  const solvedRef = useRef(new Set<number>())
  const myId = solo ? 'me' : room!.myId
  const view: ChosungView | null = solo ? viewFor(local.s, 'me') : remote
  const prevRef = useRef<ChosungView | null>(null)

  // 친구 대전: 방장이 서버에 심판을 맡기고, 모두 서버 화면을 받는다
  useEffect(() => {
    if (!room || !serverOk) return
    if (room.role === 'host' && props.mode === 'pvp') {
      room.startReferee?.('chosung', {
        players: [{ id: room.myId, name: loadNickname() ?? '나' }, ...props.members.map((m) => ({ id: m.id, name: m.nickname }))],
      })
    }
    return room.onMessage((msg, from) => {
      if (msg.t !== 'view' || from !== REFEREE_FROM) return
      setRemote(msg.v)
      setUntil(performance.now() + msg.v.leftMs)
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [room, serverOk])

  useEffect(() => {
    const id = setInterval(() => setNow(performance.now()), 200)
    return () => clearInterval(id)
  }, [])

  // 소리 + 내가 맞힌 문제 세기
  useEffect(() => {
    const prev = prevRef.current
    prevRef.current = view
    if (!view || !prev) return
    const me = view.players.findIndex((p) => p.id === myId)
    const last = view.log.at(-1)
    if (last && last.seq !== prev.log.at(-1)?.seq) {
      if (last.kind === 'correct') playSound('correct')
      else if (last.kind === 'chat' && last.player === me) playSound('wrong')
    }
    if (view.guessed.some((g) => g.player === me)) solvedRef.current.add(view.q)
    if (view.hint && !prev.hint) playSound('hint')
    if (view.phase === 'reveal' && prev.phase !== 'reveal') playSound('reveal')
  })

  const leftMs = solo ? (view?.leftMs ?? 0) : Math.max(0, until - now)
  const finished = useRef(false)
  useEffect(() => {
    if (!view || view.phase !== 'done' || finished.current || leftMs > 0) return
    finished.current = true
    props.onFinish({ ...summaryOf(view, myId, solo ? 'solo' : 'pvp'), solved: solvedRef.current.size })
  })

  if (!serverOk) {
    return (
      <section className="cs-game">
        <p className="cs-notice" role="alert">
          게임 서버를 준비하는 중이에요. 몇 분 뒤에 다시 시작해 주세요.
        </p>
        <button type="button" className="button" onClick={props.onQuit}>
          나가기
        </button>
      </section>
    )
  }

  const me = view ? view.players.findIndex((p) => p.id === myId) : -1
  const left = Math.ceil(leftMs / 1000)
  const nameOf = (i: number | null) => (i === null ? '' : i === me ? '나' : (view?.players[i]?.name ?? ''))

  function submit(e: React.FormEvent) {
    e.preventDefault()
    const t = text.trim()
    if (!t || !view?.canGuess) return
    if (solo) local.dispatch({ type: 'guess', player: 0, text: t })
    else room!.send({ t: 'guess', text: t })
    setText('')
  }

  return (
    <section className="cs-game">
      <div className="cs-top">
        <span>{view && view.phase !== 'intro' ? `${view.q + 1}/${view.total}` : ''}</span>
        <span className={`cs-top__time${left <= 5 && view?.phase === 'ask' ? ' cs-top__time--low' : ''}`}>{view?.phase === 'ask' ? `${left}초` : ''}</span>
      </div>

      {!solo && (
        <ul className="cs-players" aria-label="점수">
          {view?.players.map((p, i) => (
            <li key={p.id} className={`${view.guessed.some((g) => g.player === i) ? 'cs-players__got' : ''}${view.left[i] ? ' cs-players__left' : ''}${i === me ? ' cs-players__me' : ''}`}>
              <span>
                {view.guessed.some((g) => g.player === i) ? '✓ ' : ''}
                {i === me ? '나' : p.name}
              </span>
              <b>{view.scores[i]}</b>
            </li>
          ))}
        </ul>
      )}

      <div className={`cs-card${view?.phase === 'reveal' ? ' cs-card--reveal' : ''}`}>
        {!view || view.phase === 'intro' ? (
          <p className="cs-card__wait">곧 시작해요</p>
        ) : view.phase === 'done' ? (
          <p className="cs-card__wait">끝!</p>
        ) : (
          <>
            <span className="cs-card__group">{view.group}</span>
            <div className="cs-card__tiles" aria-label={`초성 ${view.clue}`}>
              {[...(view.answer && view.phase === 'reveal' ? view.answer : (view.clue ?? ''))].map((ch, i) => (
                <span key={i} className="cs-tile">
                  {ch}
                </span>
              ))}
            </div>
            <span className="cs-card__note">
              {view.phase === 'reveal' ? '정답!' : view.answer ? `맞혔어요: ${view.answer}` : view.hint ? '힌트가 나왔어요 (이제 점수 절반)' : '10초가 지나면 글자 하나를 알려 줘요'}
            </span>
          </>
        )}
      </div>

      <div className="cs-chat">
        <ol className="cs-chat__log" aria-live="polite">
          {view?.log.map((l) => (
            <li key={l.seq} className={`cs-chat__${l.kind}`}>
              {l.kind === 'chat' && <b>{nameOf(l.player)}</b>} {l.text}
            </li>
          ))}
        </ol>
        <form className="cs-chat__form" onSubmit={submit}>
          <input
            className="input"
            value={text}
            maxLength={CHAT_MAX}
            onChange={(e) => setText(e.target.value)}
            placeholder={view?.canGuess ? '정답을 입력하세요' : view?.phase === 'ask' ? '맞혔어요! 다음 문제를 기다려요' : '문제가 나오면 맞혀요'}
            disabled={!view?.canGuess}
            enterKeyHint="send"
            autoComplete="off"
            autoFocus
          />
          <button type="submit" className="button button--primary" disabled={!view?.canGuess || !text.trim()}>
            보내기
          </button>
        </form>
      </div>
    </section>
  )
}
