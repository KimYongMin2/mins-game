import { Person } from '../../../shared/art/Person'
import type { Hand, OutReason } from '../play/engine'
import { type ScreenState, myIndex } from '../play/view'

// 둥근 나무 탁자에 둘러앉은 만화풍 사람들 (처음엔 졸라맨). 나는 항상 맨 아래. 외친 사람 머리 위에 숫자, 동시에 누르면 '겹침!'.

export const HAND_LABEL: Record<Hand, string> = { rock: '✊ 바위', paper: '✋ 보', scissors: '✌️ 가위' }

const REASON_LABEL: Record<OutReason, string> = {
  collide: '겹침!',
  last: '꼴찌!',
  timeout: '시간 초과',
  final: '결승 패배',
  left: '나감',
}

/** 자리 위치(%): 나를 맨 아래에 두고 시계 방향으로 고르게 */
function seatAt(seat: number, count: number): { x: number; y: number } {
  const a = Math.PI / 2 + (seat / count) * Math.PI * 2
  return { x: 50 + Math.cos(a) * 38, y: 50 + Math.sin(a) * 34 }
}

export function Table({ screen }: { screen: ScreenState }) {
  const v = screen.view
  if (!v) return <div className="nc-table nc-table--empty">시작하는 중…</div>
  const me = myIndex(screen)
  const n = v.players.length
  const seatOf = (i: number) => (me < 0 ? i : (i - me + n) % n)

  return (
    <div className="nc-table">
      <div className="nc-table__top" />
      {v.players.map((p, i) => {
        const pos = seatAt(seatOf(i), n)
        const press = v.presses.find((x) => x.player === i)
        const lost = v.losers.find((l) => l.player === i)
        const out = !v.alive[i]
        const hand = v.hands[i]
        const finalist = (v.phase === 'rps' || v.phase === 'reveal') && v.alive[i]
        return (
          <div
            key={p.id}
            className={[
              'nc-seat',
              i === me && 'nc-seat--me',
              out && 'nc-seat--out',
              lost && 'nc-seat--lost',
              v.winner === i && 'nc-seat--win',
            ]
              .filter(Boolean)
              .join(' ')}
            style={{ left: `${pos.x}%`, top: `${pos.y}%` }}
          >
            {press && (
              <span className={`nc-bubble${press.collided ? ' nc-bubble--clash' : ''}`}>{press.collided ? '겹침!' : press.n}</span>
            )}
            {lost && !press?.collided && <span className="nc-bubble nc-bubble--clash">{REASON_LABEL[lost.reason]}</span>}
            {finalist && v.phase === 'rps' && <span className="nc-bubble nc-bubble--wait">{v.picked.includes(i) ? '골랐음' : '…'}</span>}
            {hand && <span className="nc-bubble nc-bubble--hand">{HAND_LABEL[hand]}</span>}
            {/* 외치면 손을 번쩍, 겹치거나 탈락하면 ✕, 우승은 만세 */}
            <Person
              className="nc-stick"
              shirt={i}
              out={out}
              pose={v.winner === i ? 'cheer' : press && !press.collided ? 'raise' : lost ? 'scared' : 'idle'}
              mood={out || lost ? 'ko' : v.winner === i || (press && !press.collided) ? 'happy' : 'calm'}
            />
            <span className="nc-seat__name">
              {p.name}
              {i === me && ' (나)'}
            </span>
          </div>
        )
      })}
    </div>
  )
}
