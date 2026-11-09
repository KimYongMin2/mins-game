import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { ANIMALS, type AnimalRig, type Mood, type Pose, makeAnimal, plainLook } from '../../../shared/art3d/animals'
import { buildTableRoom } from '../../../shared/art3d/room'
import { createStage } from '../../../shared/art3d/stage'
import { PERSON_SHIRTS } from '../../../shared/art/shapes'
import { TEAM_COLORS } from '../../../shared/team/teams'
import { TeamDot } from '../../../shared/ui/TeamResult'
import type { OutReason } from '../play/engine'
import { type ScreenState, myIndex } from '../play/view'
import { HAND_LABEL } from './Table'

// 3D 탁자: 동물 캐릭터들이 둘러서고, 외치면 한 손 번쩍 + 머리 위에 숫자, 겹치면 '겹침!'과 함께 쓰러진다.
// 결승 가위바위보는 머리 위 말풍선으로 고른 손을 보여준다. 나는 항상 앞(카메라 쪽).

const REASON_LABEL: Record<OutReason, string> = {
  collide: '겹침!',
  last: '꼴찌!',
  timeout: '시간 초과',
  final: '결승 패배',
  left: '나감',
}

export function Table3D({ screen }: { screen: ScreenState }) {
  const hostRef = useRef<HTMLDivElement>(null)
  const screenRef = useRef(screen)
  const labelRefs = useRef<(HTMLSpanElement | null)[]>([])
  const bubbleRefs = useRef<(HTMLSpanElement | null)[]>([])
  useEffect(() => {
    screenRef.current = screen
  })

  const v = screen.view
  const players = v?.players ?? []
  const playerKey = players.map((p) => p.id).join(',')
  const teamsKey = v?.teams?.join(',') ?? ''

  useEffect(() => {
    const host = hostRef.current
    const first = screenRef.current.view
    if (!host || !first) return
    const n = first.players.length
    const stage = createStage(host, { background: '#1f1914' })
    const { scene, camera } = stage
    const room = buildTableRoom(scene, n)
    stage.lamp.target.position.set(0, 1, 0)

    const me = first.players.findIndex((p) => p.id === screenRef.current.myId)
    const seatOf = (i: number) => (me < 0 ? i : (i - me + n) % n)
    const rigs: AnimalRig[] = first.players.map((_, i) => {
      const shirt = first.teams ? TEAM_COLORS[first.teams[i]] : PERSON_SHIRTS[i % PERSON_SHIRTS.length]
      const rig = makeAnimal(first.players[i].avatar ?? plainLook(ANIMALS[i % ANIMALS.length]), shirt, { team: !!first.teams })
      rig.root.position.copy(room.seatPos(seatOf(i)))
      rig.root.lookAt(0, 0, 0)
      scene.add(rig.root)
      return rig
    })

    let lastPhase = ''
    let clashAt = -1
    let raf = 0
    const tmp = new THREE.Vector3()
    function frame() {
      const s = screenRef.current
      const view = s.view
      if (view) {
        const t = s.now / 1000
        // 겹치는 순간 화면이 살짝 흔들림
        const anyClash = view.presses.some((p) => p.collided)
        if (anyClash && clashAt < 0) clashAt = s.now
        if (!anyClash) clashAt = -1
        if (view.phase !== lastPhase) lastPhase = view.phase
        const winners = view.phase === 'done' ? (view.teams && view.winTeam !== null ? view.players.map((_, i) => view.teams![i] === view.winTeam) : view.ranks.map((r) => r === 1)) : null

        rigs.forEach((rig, i) => {
          const press = view.presses.find((x) => x.player === i)
          const lost = view.losers.find((l) => l.player === i)
          const out = !view.alive[i] || !!lost
          rig.setOut(!view.alive[i])
          let pose: Pose = 'idle'
          let mood: Mood = 'calm'
          if (winners?.[i] || view.winner === i) {
            pose = 'cheer'
            mood = 'happy'
          } else if (out) {
            pose = lost && view.alive[i] ? 'scared' : 'ko'
            mood = 'ko'
          } else if (press && !press.collided) {
            pose = 'raise'
            mood = 'happy'
          } else if (press?.collided) {
            pose = 'scared'
            mood = 'scared'
          } else if (view.phase === 'call') {
            // 아직 안 외친 사람은 눈치 보는 중 (살짝 긴장)
            mood = 'calm'
          }
          rig.update(t + i, pose, mood)
        })

        const shake = clashAt >= 0 && s.now - clashAt < 400 ? (1 - (s.now - clashAt) / 400) * 0.12 : 0
        camera.position.set(room.camera.pos.x + (Math.random() - 0.5) * shake, room.camera.pos.y + (Math.random() - 0.5) * shake, room.camera.pos.z)
        camera.lookAt(room.camera.look)

        // 이름표(발밑)·말풍선(머리 위)
        rigs.forEach((rig, i) => {
          const el = labelRefs.current[i]
          if (el) {
            const p = stage.toScreen(rig.root.localToWorld(tmp.set(0, 0, 0.55)))
            el.style.transform = `translate(${p.x}px, ${p.y}px) translate(-50%, -30%)`
            el.classList.toggle('nc3-label--out', !view.alive[i])
          }
          const b = bubbleRefs.current[i]
          if (!b) return
          const press = view.presses.find((x) => x.player === i)
          const lost = view.losers.find((l) => l.player === i)
          const hand = view.hands[i]
          const finalist = view.phase === 'rps' && view.alive[i]
          let text = ''
          let kind = ''
          if (hand) {
            text = HAND_LABEL[hand]
            kind = 'hand'
          } else if (finalist) {
            text = view.picked.includes(i) ? '골랐음' : '…'
            kind = 'wait'
          } else if (press) {
            text = press.collided ? '겹침!' : String(press.n)
            kind = press.collided ? 'clash' : 'num'
          } else if (lost) {
            text = REASON_LABEL[lost.reason]
            kind = 'clash'
          }
          b.style.display = text ? '' : 'none'
          if (!text) return
          const p = stage.toScreen(rig.head.getWorldPosition(tmp).add(new THREE.Vector3(0, 0.95, 0)))
          b.style.transform = `translate(${p.x}px, ${p.y}px) translate(-50%, -100%)`
          if (b.textContent !== text) b.textContent = text
          b.className = `nc3-bubble nc3-bubble--${kind}`
        })
      }
      stage.render()
      raf = requestAnimationFrame(frame)
    }
    raf = requestAnimationFrame(frame)

    return () => {
      cancelAnimationFrame(raf)
      rigs.forEach((r) => r.dispose())
      stage.dispose()
    }
  }, [playerKey, teamsKey])

  if (!v) return <div className="nc-table nc-table--empty">시작하는 중…</div>
  const me = myIndex(screen)
  return (
    <div className="nc3" ref={hostRef}>
      {players.map((p, i) => (
        <span
          key={p.id}
          ref={(el) => {
            labelRefs.current[i] = el
          }}
          className={`nc3-label${i === me ? ' nc3-label--me' : ''}`}
        >
          {v.teams && <TeamDot team={v.teams[i]} />}
          {p.name}
          {i === me && ' (나)'}
        </span>
      ))}
      {players.map((p, i) => (
        <span
          key={`b-${p.id}`}
          ref={(el) => {
            bubbleRefs.current[i] = el
          }}
          className="nc3-bubble"
          style={{ display: 'none' }}
        />
      ))}
    </div>
  )
}
