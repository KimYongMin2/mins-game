import { useEffect, useRef, useState } from 'react'
import type { Member, Room } from '../../../shared/online/room'
import { REFEREE_FROM } from '../../../shared/online/hubProtocol'
import { loadNickname } from '../../../shared/storage/nickname'
import { TURN_MS, WORD_MAX } from '../constants'
import type { WordchainMsg } from '../play/pvp'
import type { WordchainView } from '../play/view'
import { playSound } from '../sounds'

// 끝말잇기 경기 화면. 심판은 우리 게임 서버 (규칙 검사·사전 확인·탈락)
export type GameSummary = { rank: number; words: number; total: number; ranking: { name: string; rank: number; me: boolean }[] }

type Props = { room: Room<WordchainMsg>; members: Member[]; onFinish: (s: GameSummary) => void; onQuit: () => void }

export function GameScreen({ room, members, onFinish, onQuit }: Props) {
  const [serverOk] = useState(() => !!room.hasReferee?.('wordchain'))
  const [view, setView] = useState<WordchainView | null>(null)
  const [until, setUntil] = useState(0)
  const [now, setNow] = useState(() => performance.now())
  const [text, setText] = useState('')
  const prevRef = useRef<WordchainView | null>(null)
  const myId = room.myId

  useEffect(() => {
    if (!serverOk) return
    if (room.role === 'host') {
      room.startReferee?.('wordchain', { players: [{ id: room.myId, name: loadNickname() ?? '나' }, ...members.map((m) => ({ id: m.id, name: m.nickname }))] })
    }
    return room.onMessage((msg, from) => {
      if (msg.t !== 'view' || from !== REFEREE_FROM) return
      setView(msg.v)
      setUntil(performance.now() + msg.v.leftMs)
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [room, serverOk])

  useEffect(() => {
    const id = setInterval(() => setNow(performance.now()), 100)
    return () => clearInterval(id)
  }, [])

  const me = view ? view.players.findIndex((p) => p.id === myId) : -1
  // 소리: 이어짐 · 틀림 · 탈락 · 내 차례
  useEffect(() => {
    const prev = prevRef.current
    prevRef.current = view
    if (!view || !prev) return
    if (view.count > prev.count) playSound('ok')
    const last = view.log.at(-1)
    if (last && last.seq !== prev.log.at(-1)?.seq) playSound(last.kind === 'out' ? 'out' : 'bad')
    if (view.turn === me && prev.turn !== me) playSound('turn')
  }, [view, me])

  const leftMs = Math.max(0, until - now)
  const finished = useRef(false)
  useEffect(() => {
    if (!view || view.phase !== 'done' || finished.current || leftMs > 0) return
    finished.current = true
    const ranking = view.players.map((p, i) => ({ name: p.name, rank: view.ranks[i], me: i === me })).sort((a, b) => a.rank - b.rank)
    onFinish({ rank: view.ranks[me] ?? view.players.length, words: view.chain.filter((l) => l.player === me).length, total: view.count, ranking })
  })

  if (!serverOk) {
    return (
      <section className="wc-game">
        <p className="wc-notice" role="alert">
          게임 서버를 준비하는 중이에요. 몇 분 뒤에 다시 시작해 주세요.
        </p>
        <button type="button" className="button" onClick={onQuit}>
          나가기
        </button>
      </section>
    )
  }

  const myTurn = view?.phase === 'turn' && view.turn === me
  const nameOf = (i: number | null) => (i === null ? '' : i === me ? '나' : (view?.players[i]?.name ?? ''))

  function submit(e: React.FormEvent) {
    e.preventDefault()
    const w = text.trim()
    if (!w || !myTurn || view?.checking) return
    room.send({ t: 'say', word: w })
    setText('')
  }

  return (
    <section className="wc-game">
      <ul className="wc-players" aria-label="사람들">
        {view?.players.map((p, i) => (
          <li key={p.id} className={`${view.turn === i ? 'wc-players__turn' : ''}${view.out.includes(i) || view.left[i] ? ' wc-players__out' : ''}${i === me ? ' wc-players__me' : ''}`}>
            {view.turn === i ? '▶ ' : ''}
            {i === me ? '나' : p.name}
          </li>
        ))}
      </ul>

      <ol className="wc-chain" aria-label="이은 낱말">
        {view?.chain.map((l, k) => (
          <li key={`${l.word}-${k}`} className={k === view.chain.length - 1 ? 'wc-chain__last' : ''}>
            <b>{l.word}</b>
            <span>{l.player === null ? '시작' : nameOf(l.player)}</span>
          </li>
        ))}
      </ol>

      <div className={`wc-now${myTurn ? ' wc-now--mine' : ''}`}>
        {!view || view.phase === 'intro' ? (
          <strong>곧 시작해요</strong>
        ) : view.phase === 'done' ? (
          <strong>끝! {view.count}개 이었어요</strong>
        ) : (
          <>
            <strong>
              {myTurn ? '내 차례! ' : `${nameOf(view.turn)} 차례 · `}'{view.starts.join("' 또는 '")}'(으)로 시작
            </strong>
            <div className="wc-timer" aria-hidden>
              <span style={{ width: `${view.checking ? 100 : Math.min(100, (leftMs / TURN_MS) * 100)}%` }} />
            </div>
            {view.checking && <span className="wc-now__check">'{view.checking}' 사전 확인 중…</span>}
          </>
        )}
      </div>

      <ol className="wc-log" aria-live="polite">
        {view?.log.map((l) => (
          <li key={l.seq} className={`wc-log__${l.kind}`}>
            {l.kind === 'bad' && <b>{nameOf(l.player)}</b>} {l.text}
          </li>
        ))}
      </ol>

      <form className="wc-form" onSubmit={submit}>
        <input
          className="input"
          value={text}
          maxLength={WORD_MAX}
          onChange={(e) => setText(e.target.value)}
          placeholder={myTurn ? `'${view?.starts[0]}'(으)로 시작하는 낱말` : '내 차례를 기다려요'}
          disabled={!myTurn || !!view?.checking}
          enterKeyHint="send"
          autoComplete="off"
          autoFocus
        />
        <button type="submit" className="button button--primary" disabled={!myTurn || !!view?.checking || !text.trim()}>
          내기
        </button>
      </form>
    </section>
  )
}
