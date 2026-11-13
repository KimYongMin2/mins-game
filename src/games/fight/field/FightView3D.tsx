import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import type { Look } from '../../../shared/art3d/animalKinds'
import { type AnimalRig, makeAnimal } from '../../../shared/art3d/animals'
import { createStage } from '../../../shared/art3d/stage'
import { type TurnEvent, isHurt } from '../rules/turn'
import type { FighterShow } from './FightView'

// 3D 링 위의 두 동물 권투 선수 (사용자 요청 — 처음엔 2D 만화풍, field/FightView.tsx는 WebGL이 안 될 때 그대로 씀).
// 왼쪽이 나(파랑), 오른쪽이 상대(빨강). 카메라는 링 옆 조금 위에서 비스듬히.
// 자세: 평소 주먹 들기 · 준비 = 쪼그려 기 모으기(노란 기운) · 방어 = 팔 엇갈려 막기(파란 방패) · 타격 = 앞 손 내지르며 뛰어듦 · 강타 = 두 손 · 맞음 = 뒤로 젖혀지며 번쩍
// 글자(?·+1·이름)는 3D 위치를 화면에 옮겨 HTML로 겹친다.

type Props = {
  fighters: readonly [FighterShow, FighterShow]
  reveal: number | null
  now: number
  names: readonly [string, string]
  looks: readonly [Look, Look]
  /** 경기가 끝났으면 이긴 쪽 (만세 / 쓰러짐) */
  winner: 0 | 1 | 'draw' | null
}

const COLORS = ['#2563eb', '#dc2626'] as const
/** 두 선수 서는 자리 (가운데에서) */
const GAP = 1.15
/** 2D 연출 거리(120칸 사이) → 3D */
const UNIT = (GAP * 2) / 120
/** 옆을 똑바로 보면 납작해 보여서 카메라 쪽으로 조금 돌림 */
const TURN = 0.42

const EVENT_TEXT: Partial<Record<TurnEvent, { text: string; tone: 'good' | 'bad' | 'plain' }>> = {
  charge: { text: '+1', tone: 'good' },
  'charge-full': { text: '꽉 참', tone: 'plain' },
  hurt: { text: '−1', tone: 'bad' },
  pierced: { text: '뚫림! −1', tone: 'bad' },
  overpowered: { text: '밀림! −1', tone: 'bad' },
  'smash-hit': { text: '강타!', tone: 'good' },
  block: { text: '막음!', tone: 'good' },
  strike: { text: '명중!', tone: 'good' },
  blocked: { text: '막힘', tone: 'plain' },
}

function starGeometry(points: number, inner: number): THREE.ShapeGeometry {
  const s = new THREE.Shape()
  for (let i = 0; i < points * 2; i++) {
    const r = i % 2 ? inner : 1
    const a = (i / (points * 2)) * Math.PI * 2 - Math.PI / 2
    if (i === 0) s.moveTo(Math.cos(a) * r, Math.sin(a) * r)
    else s.lineTo(Math.cos(a) * r, Math.sin(a) * r)
  }
  return new THREE.ShapeGeometry(s)
}

const glowMat = (color: string, opacity = 1) =>
  new THREE.MeshBasicMaterial({ color, transparent: true, opacity, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide })

function buildRing(scene: THREE.Scene) {
  // 링 바닥 (파란 매트 + 흰 테두리 + 옆 천)
  const apron = new THREE.Mesh(new THREE.BoxGeometry(7.6, 0.7, 5.2), new THREE.MeshStandardMaterial({ color: '#1e293b', roughness: 0.9 }))
  apron.position.y = -0.35
  apron.receiveShadow = true
  const mat = new THREE.Mesh(new THREE.BoxGeometry(7.2, 0.06, 4.8), new THREE.MeshStandardMaterial({ color: '#3b5bdb', roughness: 0.85 }))
  mat.position.y = 0.0
  mat.receiveShadow = true
  const line = new THREE.Mesh(new THREE.RingGeometry(0.75, 0.82, 48), new THREE.MeshStandardMaterial({ color: '#e7ecff', roughness: 0.8 }))
  line.rotation.x = -Math.PI / 2
  line.position.y = 0.035
  scene.add(apron, mat, line)
  // 기둥 넷 (파랑·빨강 코너) + 로프 (앞쪽은 선수를 가려서 안 걸음)
  const postM = (c: string) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.4, metalness: 0.3 })
  const corners: [number, number, string][] = [
    [-3.4, -2.2, '#2563eb'],
    [3.4, -2.2, '#dc2626'],
    [-3.4, 2.2, '#e5e7eb'],
    [3.4, 2.2, '#e5e7eb'],
  ]
  for (const [x, z, c] of corners) {
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 1.7, 12), postM(c))
    post.position.set(x, 0.85, z)
    post.castShadow = true
    const pad = new THREE.Mesh(new THREE.BoxGeometry(0.24, 1.0, 0.24), postM(c))
    pad.position.set(x, 0.95, z)
    scene.add(post, pad)
  }
  const ropeColors = ['#f8fafc', '#ef4444', '#f8fafc']
  const rope = (a: THREE.Vector3, b: THREE.Vector3, color: string) => {
    const len = a.distanceTo(b)
    const m = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, len, 8), new THREE.MeshStandardMaterial({ color, roughness: 0.5 }))
    m.position.copy(a).add(b).multiplyScalar(0.5)
    m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize())
    scene.add(m)
  }
  ropeColors.forEach((c, i) => {
    const y = 0.55 + i * 0.4
    rope(new THREE.Vector3(-3.4, y, -2.2), new THREE.Vector3(3.4, y, -2.2), c)
    rope(new THREE.Vector3(-3.4, y, -2.2), new THREE.Vector3(-3.4, y, 2.2), c)
    rope(new THREE.Vector3(3.4, y, -2.2), new THREE.Vector3(3.4, y, 2.2), c)
  })
  // 어두운 관중석 (뒤쪽 계단에 머리들)
  const crowdM = new THREE.MeshStandardMaterial({ color: '#312e81', roughness: 1 })
  let seed = 3
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647)
  for (let row = 0; row < 3; row++) {
    for (let i = 0; i < 22; i++) {
      const head = new THREE.Mesh(new THREE.SphereGeometry(0.26, 10, 8), crowdM)
      head.position.set(-7 + i * 0.66 + rnd() * 0.2, 0.9 + row * 0.7 + rnd() * 0.1, -4.2 - row * 0.8)
      scene.add(head)
    }
  }
}

export function FightView3D(props: Props) {
  const hostRef = useRef<HTMLDivElement>(null)
  const propsRef = useRef(props)
  useEffect(() => {
    propsRef.current = props
  })
  const tagRefs = [useRef<HTMLDivElement>(null), useRef<HTMLDivElement>(null)]
  const nameRefs = [useRef<HTMLDivElement>(null), useRef<HTMLDivElement>(null)]
  const clashRef = useRef<HTMLDivElement>(null)
  const lookKey = JSON.stringify(props.looks)

  useEffect(() => {
    const host = hostRef.current
    if (!host) return
    const stage = createStage(host, { background: '#1e1b4b', fov: 34 })
    const { scene, camera, lamp } = stage
    scene.fog = new THREE.Fog('#1e1b4b', 12, 26)
    lamp.position.set(0, 9, 2)
    lamp.angle = Math.PI / 5
    lamp.intensity = 85
    // 양쪽 무대 조명 (2D의 빛줄기처럼)
    for (const x of [-3, 3]) {
      const s = new THREE.SpotLight(x < 0 ? '#c7d2fe' : '#fecaca', 25, 16, Math.PI / 7, 0.6, 1.4)
      s.position.set(x, 8, 3)
      s.target.position.set(x * 0.4, 0, 0)
      scene.add(s, s.target)
    }
    buildRing(scene)

    const { looks } = propsRef.current
    const fighters = ([0, 1] as const).map((side) => {
      const dir = side === 0 ? 1 : -1
      const rig: AnimalRig = makeAnimal(looks[side], COLORS[side], { team: true })
      rig.root.traverse((o) => {
        if (o instanceof THREE.Mesh) o.castShadow = true
      })
      // 권투 글러브 (손 위에) + 머리띠
      const gloveM = new THREE.MeshStandardMaterial({ color: COLORS[side], roughness: 0.3, metalness: 0.05 })
      for (const arm of [rig.armL, rig.armR]) {
        const glove = new THREE.Mesh(new THREE.SphereGeometry(0.21, 18, 14), gloveM)
        glove.scale.set(1, 1.05, 1.15)
        glove.position.set(0, -0.54, 0.03)
        glove.castShadow = true
        const cuff = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.15, 0.12, 14), new THREE.MeshStandardMaterial({ color: '#f8fafc', roughness: 0.6 }))
        cuff.position.set(0, -0.36, 0)
        arm.add(glove, cuff)
      }
      const band = new THREE.Mesh(new THREE.TorusGeometry(0.5, 0.055, 8, 32), gloveM)
      band.rotation.x = Math.PI / 2
      band.position.y = 0.16
      rig.head.add(band)
      // 가까운 팔(카메라 쪽)로 내지른다
      const near = side === 0 ? rig.armL : rig.armR
      const far = side === 0 ? rig.armR : rig.armL
      const inward = (arm: THREE.Group) => (arm === rig.armL ? 1 : -1)
      rig.root.rotation.y = dir * (Math.PI / 2 - TURN)
      scene.add(rig.root)

      // 효과: 기운(노란 타원) · 반짝이 · 방패(파란 판) · 맞음 번쩍(별)
      const aura = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 16), glowMat('#facc15', 0.3))
      aura.scale.set(0.85, 1.45, 0.85)
      aura.position.y = 1.25
      const sparkles = Array.from({ length: 4 }, () => {
        const m = new THREE.Mesh(starGeometry(4, 0.35), glowMat('#fef08a', 1))
        m.scale.setScalar(0.13)
        return m
      })
      const fx = new THREE.Group()
      fx.add(aura, ...sparkles)
      scene.add(fx)
      const shieldM = glowMat('#60a5fa', 0.5)
      const shield = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 16, -0.9, 1.8, 0.35, 2.4), shieldM)
      shield.scale.set(1.15, 1.15, 1.15)
      scene.add(shield)
      const hitStar = new THREE.Mesh(starGeometry(9, 0.5), glowMat('#fff7ae', 1))
      const hitCore = new THREE.Mesh(starGeometry(7, 0.5), glowMat('#ffffff', 1))
      hitCore.position.z = 0.01
      const hit = new THREE.Group()
      hit.add(hitStar, hitCore)
      scene.add(hit)
      const wave = new THREE.Mesh(new THREE.TorusGeometry(1, 0.06, 8, 40), glowMat('#fbbf24', 1))
      scene.add(wave)
      // 팔·몸 기울기는 여기에 따로 부드럽게 따라가 두고 매 프레임 덮어쓴다 (rig.update도 0 쪽으로 당겨서 섞으면 덜 감)
      const pose = new Map<THREE.Object3D, { x: number; z: number }>([
        [near, { x: 0, z: 0 }],
        [far, { x: 0, z: 0 }],
      ])
      return { side, dir, rig, near, far, inward, pose, lean: 0, fx, aura, sparkles, shield, shieldM, hit, wave, x: -GAP * dir }
    })
    const clash = new THREE.Mesh(starGeometry(10, 0.45), glowMat('#fff7ae', 1))
    scene.add(clash)

    const camBase = new THREE.Vector3(0.6, 2.8, 8.6)
    const look = new THREE.Vector3(0, 1.45, 0)
    const ease = (cur: number, to: number, k = 0.25) => cur + (to - cur) * k
    const tmp = new THREE.Vector3()

    let raf = 0
    let fired = false // 이번 공개의 부딪힘 연출(카메라 당김·불꽃)을 했는지
    function frame() {
      const { fighters: shows, reveal, winner } = propsRef.current
      const t = performance.now() / 1000
      const p = reveal ?? 0
      const hits = shows.filter((f) => !f.hidden && f.event && isHurt(f.event))
      const strong = hits.some((f) => f.event !== 'hurt')
      if (reveal === null) fired = false
      else if (!fired && fighters.every((f) => f.rig)) {
        fired = true
        // 맞은 쪽 얼굴에서 불꽃, 막으면 파란 불똥, 맞부딪히면 흰 불꽃 + 카메라 당김
        shows.forEach((sh, i) => {
          if (sh.hidden || !sh.event) return
          const head = fighters[i].rig.head.getWorldPosition(new THREE.Vector3())
          if (isHurt(sh.event)) {
            stage.burst(head.add(new THREE.Vector3(fighters[i].dir * 0.4, 0, 0.3)), { color: sh.event === 'hurt' ? '#ffd23f' : '#ff7a3d', count: sh.event === 'hurt' ? 22 : 40, speed: sh.event === 'hurt' ? 3 : 4.6 })
          } else if (sh.event === 'block') {
            stage.burst(new THREE.Vector3(fighters[i].x + fighters[i].dir * 0.3, 1.3, 0.3), { color: '#9fd0ff', count: 18, speed: 2.6, life: 0.5 })
          }
        })
        if (shows[0].event === 'clash') stage.burst(new THREE.Vector3((fighters[0].x + fighters[1].x) / 2, 1.6, 0.3), { color: '#fff7ae', count: 30, speed: 4 })
        if (hits.length > 0) stage.kick(strong ? 1 : 0.55)
        else if (shows[0].event === 'clash') stage.kick(0.45)
      }
      const amp = reveal !== null && hits.length > 0 && p < 0.3 ? (strong ? 0.12 : 0.06) * (1 - p / 0.3) : 0
      camera.position.set(camBase.x + Math.sin(p * 90) * amp, camBase.y + Math.cos(p * 70) * amp * 0.6, camBase.z)
      camera.lookAt(look)

      for (const f of fighters) {
        const show = shows[f.side]
        const { rig, dir, near, far, inward } = f
        const stance = show.hidden ? null : show.stance
        const hurt = !show.hidden && !!show.event && isHurt(show.event)
        // 공개 순간: 타격은 앞으로 뛰어들고, 맞으면 뒤로 밀린다 (2D와 같은 거리)
        let shift = 0
        const lunging = reveal !== null && (stance === 'attack' || stance === 'smash')
        if (lunging) {
          const reach = show.event === 'strike' ? 40 : show.event === 'smash-hit' ? 34 : show.event === 'clash' ? 6 : 10
          shift = reach * Math.min(1, p / 0.15)
        }
        if (reveal !== null && hurt) shift = (show.event === 'hurt' ? -14 : -30) * Math.min(1, p / 0.2)
        const x = -GAP * dir + shift * UNIT * dir
        f.x = x
        rig.root.position.set(x, 0, 0)

        const won = winner !== null && winner !== 'draw' && winner === f.side
        const lost = winner !== null && winner !== 'draw' && winner !== f.side
        if (won) {
          rig.update(t, 'cheer', 'happy')
        } else if (lost) {
          rig.update(t, 'ko', 'ko')
        } else {
          rig.update(t + f.side * 1.3, 'idle', hurt ? 'ko' : 'calm')
          const setArm = (arm: THREE.Group, ax: number, zIn: number) => {
            const st = f.pose.get(arm)!
            st.x = ease(st.x, ax, 0.35)
            st.z = ease(st.z, inward(arm) * zIn, 0.35)
            arm.rotation.x = st.x
            arm.rotation.z = st.z
          }
          let lean = 0
          let crouch = 0
          const bounce = reveal === null ? Math.abs(Math.sin(t * 5 + f.side)) * 0.05 : 0
          if (hurt) {
            setArm(near, -0.7, -0.6)
            setArm(far, -0.9, -0.5)
            lean = -0.4
          } else if (stance === 'ready') {
            setArm(near, -0.35, -0.45)
            setArm(far, -0.35, -0.45)
            crouch = -0.22
            lean = 0.15
          } else if (stance === 'guard') {
            setArm(near, -2.55, 0.75)
            setArm(far, -2.35, 0.6)
            lean = -0.08
          } else if (stance === 'attack' && reveal !== null) {
            setArm(near, -1.62, 0.12)
            setArm(far, -2.2, 0.35)
            lean = 0.22
          } else if (stance === 'smash' && reveal !== null) {
            setArm(near, -1.62, 0.32)
            setArm(far, -1.62, 0.32)
            lean = 0.32
          } else {
            // 주먹 들고 서기 (고르는 중엔 통통)
            setArm(near, -2.15, 0.3)
            setArm(far, -2.3, 0.38)
          }
          f.lean = ease(f.lean, lean, 0.3)
          rig.body.rotation.x = f.lean
          rig.body.position.y = crouch + bounce
        }

        // 효과
        const charging = !show.hidden && (show.event === 'charge' || show.event === 'charge-full') && reveal !== null
        f.fx.visible = charging
        if (charging) {
          f.fx.position.set(x, 0, 0)
          ;(f.aura.material as THREE.MeshBasicMaterial).opacity = 0.4 * (1 - p * 0.7)
          const s = 1 + 0.08 * Math.sin(p * 12)
          f.aura.scale.set(0.85 * s, 1.45 * s, 0.85 * s)
          f.sparkles.forEach((m, i) => {
            m.position.set([-0.4, 0.1, 0.45, -0.1][i], 0.3 + ((p * 2.4 + i * 0.6) % 2.2), 0.6)
            m.quaternion.copy(camera.quaternion)
            m.rotation.z += t * 2
          })
        }
        const guarding = !show.hidden && stance === 'guard'
        f.shield.visible = guarding
        if (guarding) {
          f.shield.position.set(x + dir * 0.15, 1.2, 0)
          f.shield.rotation.y = dir > 0 ? Math.PI / 2 : -Math.PI / 2
          const broken = show.event === 'pierced' && reveal !== null
          const flash = show.event === 'block' && reveal !== null && p < 0.3
          f.shieldM.color.set(broken ? '#f87171' : flash ? '#dbeafe' : '#60a5fa')
          f.shieldM.opacity = broken ? 0.5 * Math.max(0, 1 - p * 2) : flash ? 0.8 : 0.42
          const sc = broken ? 1.15 + p * 0.8 : 1.15
          f.shield.scale.setScalar(sc)
        }
        const flashing = hurt && reveal !== null && p < 0.5
        f.hit.visible = flashing
        if (flashing) {
          const head = rig.head.getWorldPosition(tmp)
          f.hit.position.set(head.x + dir * 0.45, head.y, head.z + 0.35)
          f.hit.quaternion.copy(camera.quaternion)
          f.hit.scale.setScalar((show.event === 'hurt' ? 0.45 : 0.7) * (0.6 + p))
          for (const c of f.hit.children) ((c as THREE.Mesh).material as THREE.MeshBasicMaterial).opacity = 1 - p / 0.5
          f.hit.children[1].scale.setScalar(0.45)
        }
        const smashing = !show.hidden && show.event === 'smash-hit' && reveal !== null
        f.wave.visible = smashing
        if (smashing) {
          f.wave.position.set(x + dir * 1.0, 1.55, 0)
          f.wave.rotation.y = Math.PI / 2
          f.wave.scale.setScalar(0.2 + p * 0.9)
          ;(f.wave.material as THREE.MeshBasicMaterial).opacity = 1 - p
        }
      }
      // 부딪힘 (상쇄)
      const clashing = reveal !== null && shows[0].event === 'clash'
      clash.visible = clashing
      if (clashing) {
        clash.position.set((fighters[0].x + fighters[1].x) / 2, 1.6, 0.3)
        clash.quaternion.copy(camera.quaternion)
        clash.scale.setScalar(0.35 + 0.35 * p)
        ;(clash.material as THREE.MeshBasicMaterial).opacity = 1 - p
      }

      stage.render()

      // 글자: 머리 위(? · +1)와 발밑(이름)
      fighters.forEach((f, i) => {
        const top = stage.toScreen(tmp.set(-GAP * f.dir, 3.05, 0))
        const tag = tagRefs[i].current
        if (tag) tag.style.transform = `translate(${top.x}px, ${top.y - 18 * p}px) translate(-50%, -100%)`
        const foot = stage.toScreen(tmp.set(-GAP * f.dir, -0.05, 0.6))
        const nm = nameRefs[i].current
        if (nm) nm.style.transform = `translate(${foot.x}px, ${foot.y}px) translate(-50%, 0)`
      })
      const mid = stage.toScreen(tmp.set(0, 2.6, 0))
      if (clashRef.current) clashRef.current.style.transform = `translate(${mid.x}px, ${mid.y}px) translate(-50%, -100%)`
      raf = requestAnimationFrame(frame)
    }
    raf = requestAnimationFrame(frame)

    return () => {
      cancelAnimationFrame(raf)
      fighters.forEach((f) => f.rig.dispose())
      stage.dispose()
    }
  }, [lookKey])

  const { fighters, reveal, names } = props
  return (
    <div className="ft-view ft-view3d" role="img" aria-label="링 위에 마주 선 두 격투가">
      <div className="ft-view3d__stage" ref={hostRef} />
      {fighters.map((f, i) => {
        const ev = !f.hidden && f.event && reveal !== null ? EVENT_TEXT[f.event] : undefined
        return (
          <div key={i}>
            <div className="ft-view3d__tag" ref={tagRefs[i]}>
              {f.hidden ? <span className="ft-view3d__secret">?</span> : ev ? <span className={`ft-view3d__pop ft-view3d__pop--${ev.tone}`}>{ev.text}</span> : null}
            </div>
            <div className="ft-view3d__name" ref={nameRefs[i]}>
              {names[i]}
            </div>
          </div>
        )
      })}
      <div className="ft-view3d__tag" ref={clashRef}>
        {reveal !== null && fighters[0].event === 'clash' && <span className="ft-view3d__pop ft-view3d__pop--plain">상쇄!</span>}
      </div>
    </div>
  )
}
