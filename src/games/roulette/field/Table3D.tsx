import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { ANIMALS, type AnimalRig, type Mood, type Pose, makeAnimal } from '../../../shared/art3d/animals'
import { buildTableRoom, footRing, glowTexture } from '../../../shared/art3d/room'
import { createStage, nearestOnScreen } from '../../../shared/art3d/stage'
import { PERSON_SHIRTS } from '../../../shared/art/shapes'
import { TEAM_COLORS, sameTeam } from '../../../shared/team/teams'
import { TeamDot } from '../../../shared/ui/TeamResult'
import { CHAMBERS, SUSPENSE_MS } from '../constants'
import { type ScreenState, fired, isMyTurn, myIndex } from '../play/view'

// 3D 탁자: 동물 캐릭터들이 둘러서고 가운데 은색 리볼버가 겨눈 사람 쪽으로 돈다. 나는 항상 앞.
// 당기면 총이 떨리고(철컥) → '찰칵'이면 겨눠진 사람이 움찔, '탕!'이면 총구 불꽃 + 쓰러짐. 내 차례면 캐릭터를 눌러 고른다.

type Props = {
  screen: ScreenState
  onPick: (i: number) => void
}

/** 리볼버 (총구가 +z 쪽) */
function makeRevolver() {
  const group = new THREE.Group()
  const steel = new THREE.MeshStandardMaterial({ color: '#c9d0d7', metalness: 0.95, roughness: 0.22 })
  const dark = new THREE.MeshStandardMaterial({ color: '#4b5259', metalness: 0.9, roughness: 0.35 })
  const wood = new THREE.MeshStandardMaterial({ color: '#7a4220', roughness: 0.55 })
  const add = (m: THREE.Mesh, x: number, y: number, z: number) => {
    m.position.set(x, y, z)
    m.castShadow = true
    group.add(m)
    return m
  }
  // 총열 (+z로)
  const barrel = add(new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.75, 20), steel), 0, 0.12, 0.42)
  barrel.rotation.x = Math.PI / 2
  add(new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.05, 0.06), steel), 0, 0.2, 0.76)
  // 몸통
  add(new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.24, 0.42), steel), 0, 0.08, -0.05)
  // 탄창 (돌아가는 실린더)
  const drum = add(new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 0.24, 6), dark), 0, 0.08, 0.02)
  drum.rotation.x = Math.PI / 2
  // 손잡이
  const grip = add(new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.38, 0.17), wood), 0, -0.16, -0.24)
  grip.rotation.x = -0.35
  // 방아쇠울·방아쇠·공이
  const guard = add(new THREE.Mesh(new THREE.TorusGeometry(0.08, 0.015, 8, 20, Math.PI * 1.2), steel), 0, -0.07, 0.0)
  guard.rotation.y = Math.PI / 2
  add(new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.09, 0.02), dark), 0, -0.07, 0.01)
  const hammer = add(new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.1, 0.06), dark), 0, 0.22, -0.25)
  hammer.rotation.x = -0.5
  // 총구 불꽃
  const flash = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }))
  flash.position.set(0, 0.12, 0.9)
  flash.visible = false
  const light = new THREE.PointLight('#ffb347', 0, 6)
  light.position.copy(flash.position)
  group.add(flash, light)
  group.scale.setScalar(2.4)
  return { group, drum, hammer, flash, light }
}

export function Table3D({ screen, onPick }: Props) {
  const hostRef = useRef<HTMLDivElement>(null)
  const screenRef = useRef(screen)
  const pickRef = useRef(onPick)
  const labelRefs = useRef<(HTMLSpanElement | null)[]>([])
  const bubbleRefs = useRef<(HTMLSpanElement | null)[]>([])
  useEffect(() => {
    screenRef.current = screen
    pickRef.current = onPick
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
      const rig = makeAnimal(ANIMALS[i % ANIMALS.length], shirt)
      rig.root.position.copy(room.seatPos(seatOf(i)))
      rig.root.lookAt(0, 0, 0)
      rig.root.traverse((o) => (o.userData.player = i))
      scene.add(rig.root)
      return rig
    })
    // 고를 수 있는 사람(노랑) · 겨눠진 사람(빨강) 발밑 고리
    const pickRings = rigs.map((r, i) => {
      const ring = footRing('#ffd43b')
      ring.position.copy(r.root.position).setY(0.06)
      ring.userData.player = i
      scene.add(ring)
      return ring
    })
    const aimRings = rigs.map((r) => {
      const ring = footRing('#ef4444')
      ring.scale.setScalar(1.15)
      ring.position.copy(r.root.position).setY(0.07)
      scene.add(ring)
      return ring
    })

    const gun = makeRevolver()
    gun.group.position.set(0, room.tableY + 0.32, 0)
    scene.add(gun.group)

    let yaw = 0
    let lastPhase = ''
    let fireStart = 0
    let raf = 0
    const tmp = new THREE.Vector3()
    function frame() {
      const s = screenRef.current
      const view = s.view
      if (view) {
        const t = s.now / 1000
        const meNow = myIndex(s)
        const mine = isMyTurn(s)
        const f = view.fire
        const shown = fired(s)
        if (view.phase === 'fire' && lastPhase !== 'fire') fireStart = s.now
        lastPhase = view.phase
        const target = f?.target ?? view.aimAt
        const winners = view.phase === 'done' ? (view.teams && view.winTeam !== null ? view.players.map((_, i) => view.teams![i] === view.winTeam) : view.alive) : null

        rigs.forEach((rig, i) => {
          const hitNow = !!f?.bang && f.target === i && shown
          const dead = !view.alive[i] || hitNow
          rig.setOut(dead)
          let pose: Pose = 'idle'
          let mood: Mood = 'calm'
          if (dead) {
            pose = 'ko'
            mood = 'ko'
          } else if (winners?.[i]) {
            pose = 'cheer'
            mood = 'happy'
          } else if (target === i && view.phase !== 'intro') {
            pose = 'scared'
            mood = 'scared'
          } else if (f && !f.bang && shown && f.target === i) {
            mood = 'happy'
          }
          rig.update(t + i, pose, mood)
          const pickable = mine && !dead && (view.friendlyFire || !sameTeam(view.teams, meNow, i))
          pickRings[i].visible = pickable && target !== i
          aimRings[i].visible = target === i && !dead && view.phase !== 'done'
          const k = 1 + Math.sin(t * 7) * 0.05
          aimRings[i].scale.set(1.15 * k, 1.15 * k, 1.15 * k)
        })

        // 총: 겨눈 사람 쪽으로
        gun.group.visible = view.phase !== 'intro' && view.phase !== 'done'
        const aimAt = target !== null ? rigs[target].root.position : new THREE.Vector3()
        if (target !== null) {
          const want = Math.atan2(aimAt.x, aimAt.z)
          // 가장 가까운 쪽으로 돈다
          let d = want - yaw
          d = Math.atan2(Math.sin(d), Math.cos(d))
          yaw += d * 0.15
        } else if (view.phase === 'aim') {
          // 아직 안 골랐으면 병 돌리기처럼 천천히 빙글빙글
          yaw += 0.012
        }
        const tense = !!f && !shown
        gun.group.rotation.set(tense ? Math.sin(t * 60) * 0.03 : 0, yaw + (tense ? Math.sin(t * 47) * 0.03 : 0), 0)
        // 철컥: 공이가 젖혀지고 탄창이 한 칸 돈다
        const sinceFire = view.phase === 'fire' ? s.now - fireStart : 99999
        gun.hammer.rotation.x = tense ? -1.1 : -0.5
        gun.drum.rotation.y = view.pulls * (Math.PI / 3) + (tense ? Math.min(1, sinceFire / 200) * (Math.PI / 3) : 0)
        const bangT = f?.bang && shown ? (sinceFire - SUSPENSE_MS) / 500 : -1
        gun.flash.visible = bangT >= 0 && bangT < 1
        if (gun.flash.visible) {
          gun.flash.scale.setScalar(0.6 + bangT * 1.4)
          ;(gun.flash.material as THREE.SpriteMaterial).opacity = 1 - bangT
        }
        gun.light.intensity = gun.flash.visible ? 30 * (1 - bangT) : 0
        const shake = bangT >= 0 && bangT < 1 ? (1 - bangT) * 0.15 : 0
        camera.position.set(room.camera.pos.x + (Math.random() - 0.5) * shake, room.camera.pos.y + (Math.random() - 0.5) * shake, room.camera.pos.z)
        camera.lookAt(room.camera.look)

        // 이름표(발밑)·말풍선(머리 위)
        rigs.forEach((rig, i) => {
          const el = labelRefs.current[i]
          if (el) {
            const p = stage.toScreen(rig.root.localToWorld(tmp.set(0, 0, 0.55)))
            el.style.transform = `translate(${p.x}px, ${p.y}px) translate(-50%, -30%)`
            el.classList.toggle('rl3-label--out', !view.alive[i])
            el.classList.toggle('rl3-label--turn', view.turn === i && view.phase === 'aim')
          }
          const b = bubbleRefs.current[i]
          if (b) {
            const show = !!f && f.target === i && shown
            b.style.display = show ? '' : 'none'
            if (show) {
              const p = stage.toScreen(rig.head.getWorldPosition(tmp).add(new THREE.Vector3(0, 0.75, 0)))
              b.style.transform = `translate(${p.x}px, ${p.y}px) translate(-50%, -100%)`
              b.textContent = f.bang ? '탕!' : '찰칵'
              b.classList.toggle('rl3-bubble--bang', f.bang)
            }
          }
        })
      }
      stage.render()
      raf = requestAnimationFrame(frame)
    }
    raf = requestAnimationFrame(frame)

    // 누르기: 누른 곳에서 가장 가까운, 고를 수 있는 사람
    function onDown(e: PointerEvent) {
      const s = screenRef.current
      const view = s.view
      if (!view || !isMyTurn(s)) return
      const meNow = myIndex(s)
      const points = rigs.map((r, i) =>
        view.alive[i] && (view.friendlyFire || !sameTeam(view.teams, meNow, i)) ? r.root.localToWorld(new THREE.Vector3(0, 1.4, 0)) : null,
      )
      const i = nearestOnScreen(stage, e.clientX, e.clientY, points)
      if (i === null) return
      e.preventDefault()
      pickRef.current(i)
    }
    stage.renderer.domElement.addEventListener('pointerdown', onDown)

    return () => {
      cancelAnimationFrame(raf)
      stage.renderer.domElement.removeEventListener('pointerdown', onDown)
      rigs.forEach((r) => r.dispose())
      stage.dispose()
    }
  }, [playerKey, teamsKey])

  if (!v) return <div className="rl-table rl-table--empty">시작하는 중…</div>
  const me = myIndex(screen)
  return (
    <div className="rl3" ref={hostRef}>
      {/* 탄창: 당긴 칸은 빈 칸, 남은 칸은 ? */}
      <div className="rl-cylinder rl3-cylinder" aria-label={`${v.pulls}번 당김, 남은 칸 ${CHAMBERS - v.pulls}`}>
        {Array.from({ length: CHAMBERS }, (_, k) => (
          <span key={k} className={`rl-cylinder__slot${k < v.pulls ? ' rl-cylinder__slot--used' : ''}`} />
        ))}
      </div>
      {players.map((p, i) => (
        <span
          key={p.id}
          ref={(el) => {
            labelRefs.current[i] = el
          }}
          className={`rl3-label${i === me ? ' rl3-label--me' : ''}`}
        >
          {v.teams && <TeamDot team={v.teams[i]} />}
          {i === me ? '나' : p.name}
          {v.kills[i] > 0 && <em> {v.kills[i]}킬</em>}
        </span>
      ))}
      {players.map((p, i) => (
        <span
          key={`b-${p.id}`}
          ref={(el) => {
            bubbleRefs.current[i] = el
          }}
          className="rl3-bubble"
          style={{ display: 'none' }}
        />
      ))}
    </div>
  )
}
