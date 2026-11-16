import { useEffect, useRef, useState } from 'react'
import type { Member, Room } from '../../../shared/online/room'
import { REFEREE_FROM } from '../../../shared/online/hubProtocol'
import type { InkOp } from '../play/ink'
import type { DoodleMsg } from '../play/pvp'
import type { VoteView } from '../play/voteEngine'
import type { GameSummary } from '../records'
import { playSound } from '../sounds'
import { ServerNotReady, startDoodle, summaryOf } from './GameScreen'
import { type SketchHandle, Sketchpad, Thumb } from './Sketchpad'

// '다 같이 그리기'(투표) 경기 화면 — 사용자 요청 2026-11-16.
// 판마다: 제시어 → 60초 동안 각자 그림(내 그림은 서버에만, 남의 건 안 보임) → 그림을 나란히(누가 그렸는지 숨김) 보고 자기 것 빼고 하나 투표
// → 누가 그렸는지·받은 표 공개. 3판 합계 1등이 우승.

type Props = {
  room: Room<DoodleMsg>
  members: Member[]
  onFinish: (s: GameSummary) => void
  onQuit: () => void
}

export function VoteScreen({ room, members, onFinish, onQuit }: Props) {
  const [serverOk] = useState(() => !!room.hasReferee?.('doodle'))
  const [view, setView] = useState<VoteView | null>(null)
  const [until, setUntil] = useState(0)
  const [now, setNow] = useState(() => performance.now())
  const [gallery, setGallery] = useState<{ round: number; drawings: InkOp[][] } | null>(null)
  const padRef = useRef<SketchHandle>(null)
  const viewRef = useRef<VoteView | null>(null)
  const myId = room.myId

  useEffect(() => {
    if (serverOk && room.role === 'host') startDoodle(room, members, 'vote')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    let synced = false
    return room.onMessage((msg, from) => {
      if (from !== REFEREE_FROM) return
      if (msg.t === 'vview') {
        const v = msg.v
        const prev = viewRef.current
        // 새 판이면 내 그림판 비움
        if (prev && prev.round !== v.round) padRef.current?.load([])
        if (prev && prev.phase !== v.phase && v.phase === 'result') playSound('reveal')
        if (!synced) {
          synced = true
          room.send({ t: 'inkSync' })
        }
        viewRef.current = v
        setView(v)
        setUntil(performance.now() + v.leftMs)
      } else if (msg.t === 'inkAll' && msg.turn === viewRef.current?.round) {
        // 그리는 중 다시 붙음: 내 그림 되돌려 받기
        padRef.current?.load(msg.ops)
      } else if (msg.t === 'gallery') {
        setGallery({ round: msg.round, drawings: msg.drawings })
      }
    })
  }, [room])

  useEffect(() => {
    const id = setInterval(() => setNow(performance.now()), 200)
    return () => clearInterval(id)
  }, [])

  const finished = useRef(false)
  useEffect(() => {
    if (!view || view.phase !== 'done' || finished.current || now < until) return
    finished.current = true
    onFinish(summaryOf(view, myId))
  }, [view, now, until, onFinish, myId])

  if (!serverOk) return <ServerNotReady onQuit={onQuit} />

  const me = view ? view.players.findIndex((p) => p.id === myId) : -1
  const left = Math.ceil(Math.max(0, until - now) / 1000)
  const drawing = view?.phase === 'draw' && !view.left[me]
  const shown = view && (view.phase === 'vote' || view.phase === 'result') && gallery?.round === view.round ? gallery.drawings : null
  const top = view?.gallery ? Math.max(...view.gallery.map((g) => g.votes ?? 0)) : 0

  const headline = (() => {
    if (!view) return '연결하는 중…'
    switch (view.phase) {
      case 'intro':
        return '곧 시작해요'
      case 'word':
        return `이번 제시어: ${view.word}`
      case 'draw':
        return `${view.word} 그리기`
      case 'vote':
        return view.myVote === null ? '제일 잘 그린 그림에 투표! (내 것 빼고)' : '투표했어요. 다른 사람을 기다려요'
      case 'result':
        return `'${view.word}' 결과`
      case 'done':
        return '끝!'
    }
  })()

  return (
    <section className="dd-game">
      <div className="dd-top">
        <span className="dd-top__turn">{view ? `${view.round}/${view.rounds}판` : ''}</span>
        <strong className="dd-top__word">{headline}</strong>
        <span className={`dd-top__time${left <= 10 && view?.phase === 'draw' ? ' dd-top__time--low' : ''}`}>{view && view.phase !== 'done' ? `${left}초` : ''}</span>
      </div>

      <ul className="dd-players" aria-label="점수">
        {view?.players.map((p, i) => (
          <li key={p.id} className={`${view.left[i] ? 'dd-players__left' : ''}${i === me ? ' dd-players__me' : ''}`}>
            <span>{i === me ? '나' : p.name}</span>
            <b>{view.scores[i]}</b>
          </li>
        ))}
      </ul>

      {/* 그리는 동안(과 제시어 보여줄 때)은 내 그림판 */}
      <div hidden={!!shown}>
        <Sketchpad padRef={padRef} drawing={!!drawing} onSend={(ops) => viewRef.current && room.send({ t: 'ink', turn: viewRef.current.round, ops })}>
          {view?.phase === 'word' && (
            <div className="dd-choose">
              <p>모두 같은 제시어를 그려요</p>
              <strong className="dd-bigword">{view.word}</strong>
            </div>
          )}
        </Sketchpad>
      </div>

      {shown && view?.gallery && (
        <ol className="dd-gallery" aria-label="그림들">
          {view.gallery.map((g, k) => {
            const owner = g.owner !== null ? (g.owner === me ? '나' : view.players[g.owner]?.name) : null
            const best = view.phase === 'result' && (g.votes ?? 0) > 0 && g.votes === top
            return (
              <li key={k} className={`dd-gallery__item${view.myVote === k ? ' dd-gallery__item--picked' : ''}${best ? ' dd-gallery__item--best' : ''}`}>
                <Thumb ops={shown[k] ?? []} label={`${k + 1}번 그림`} />
                <div className="dd-gallery__foot">
                  {view.phase === 'vote' ? (
                    g.mine ? (
                      <span className="dd-gallery__mine">내 그림</span>
                    ) : (
                      <button type="button" className="button button--small button--primary" disabled={view.myVote !== null} onClick={() => room.send({ t: 'vote', index: k })}>
                        {view.myVote === k ? '투표함' : `${k + 1}번에 투표`}
                      </button>
                    )
                  ) : (
                    <span>
                      {best ? '👑 ' : ''}
                      {owner} · {g.votes}표
                    </span>
                  )}
                </div>
              </li>
            )
          })}
        </ol>
      )}

      {view?.phase === 'draw' && <p className="dd-hint">남의 그림은 투표할 때 보여요. 시간이 끝나면 지금 그림으로 내요.</p>}
    </section>
  )
}
