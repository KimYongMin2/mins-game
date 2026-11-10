import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import type { Look } from '../../../shared/art3d/animalKinds'
import { type AnimalRig, makeAnimal } from '../../../shared/art3d/animals'
import { COURT_W } from '../constants'
import type { Side, SimState } from '../play/sim'
import { GROUND, VIEW_H } from './Court'

// 2D 해변 코트(Court part="back") 위에 겹치는 투명한 3D 층: 두 선수만 동물 캐릭터로 그린다 (야구와 같은 방식).
// 코트·공·네트·물리는 2D 그대로. 정사영 카메라를 SVG 범위(가로 0~COURT_W, 높이 −(VIEW_H−GROUND)~GROUND)와 똑같이 맞춰,
// 물리 좌표 (x, 높이) = 3D (x, 높이, 0)이 같은 자리에 보인다. 공은 이 층 위(Court part="front")에 그려 몸에 안 가린다.

type Props = {
  sim: SimState
  me: Side
  mirror: boolean
  shake: number
  looks: { me: Look; foe: Look }
  onReady?: () => void
}

/** 동물(키 약 2.6) → 판정 네모(바닥~약 2.2m)에 맞춤 */
const RIG_SCALE = 0.88
const COLORS = { me: '#2563eb', foe: '#dc2626' } as const
/** 옆을 똑바로 보면 납작해 보여서 화면 쪽으로 조금 돌린다 */
const SIDE_TURN = 1.05

export function Players3D(props: Props) {
  const hostRef = useRef<HTMLDivElement>(null)
  const propsRef = useRef(props)
  useEffect(() => {
    propsRef.current = props
  })
  const lookKey = JSON.stringify(props.looks) + props.me

  useEffect(() => {
    const host = hostRef.current
    if (!host) return
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'low-power' })
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1))
    renderer.setClearColor(0x000000, 0)
    renderer.outputColorSpace = THREE.SRGBColorSpace
    renderer.toneMapping = THREE.ACESFilmicToneMapping
    renderer.domElement.style.cssText = 'display:block;width:100%;height:100%'
    host.appendChild(renderer.domElement)
    const scene = new THREE.Scene()
    scene.add(new THREE.HemisphereLight('#ffffff', '#e8c77a', 1.15))
    const sun = new THREE.DirectionalLight('#fff4dc', 1.5)
    sun.position.set(6, 12, 10)
    scene.add(sun)
    // SVG viewBox 0..COURT_W × 0..VIEW_H (화면 아래가 +) ↔ 3D x 0..COURT_W, y GROUND..−(VIEW_H−GROUND)
    const camera = new THREE.OrthographicCamera(0, COURT_W, GROUND, GROUND - VIEW_H, 0.1, 100)
    camera.position.set(0, 0, 40)

    const { looks, me } = propsRef.current
    // 자리마다: wrap(자리·몸 날릴 때 기울기) → rig.root(바라보는 쪽)
    const players = ([0, 1] as const).map((i) => {
      const mine = i === me
      const rig: AnimalRig = makeAnimal(mine ? looks.me : looks.foe, mine ? COLORS.me : COLORS.foe, { team: true })
      rig.root.scale.setScalar(RIG_SCALE)
      const wrap = new THREE.Group()
      wrap.add(rig.root)
      scene.add(wrap)
      return { rig, wrap }
    })

    let w = 1
    let h = 1
    function resize() {
      w = Math.max(1, host!.clientWidth)
      h = Math.max(1, host!.clientHeight)
      renderer.setSize(w, h, false)
    }
    resize()
    const ro = new ResizeObserver(resize)
    ro.observe(host)

    const ease = (cur: number, to: number, k = 0.3) => cur + (to - cur) * k
    let raf = 0
    function frame() {
      const { sim, mirror, shake } = propsRef.current
      const t = performance.now() / 1000
      camera.position.x = -shake
      camera.updateMatrixWorld()
      const done = sim.phase.kind === 'done' ? sim.phase.winner : null
      const spike = sim.lastHit?.kind === 'spike' ? sim.lastHit : null

      players.forEach(({ rig, wrap }, i) => {
        const p = sim.players[i]
        const x = mirror ? COURT_W - p.x : p.x
        // 평소엔 네트 쪽을 봄, 몸 날릴 땐 날리는 쪽
        const toNet = (i === 0) !== mirror ? 1 : -1
        const lying = p.dive > 0 || p.recover > 0
        const dir = lying ? (mirror ? -p.facing : p.facing) : toNet
        wrap.position.set(x, p.y, i === 0 ? 0.3 : -0.3)
        wrap.rotation.z = ease(wrap.rotation.z, lying ? -dir * 1.15 : 0)
        rig.root.rotation.y = ease(rig.root.rotation.y, dir * SIDE_TURN)

        const air = p.y > 0.05
        const win = done !== null && done === i
        const lose = done !== null && done !== i
        rig.update(t + i * 1.7, win ? 'cheer' : lose ? 'idle' : 'idle', win ? 'happy' : lose ? 'scared' : 'calm')
        if (win) return
        const hitAge = spike && spike.player === i ? sim.tick - spike.tick : 99
        // 팔: x로 앞뒤(−가 앞), z로 옆. 땅에선 두 팔 모아 앞으로(받기), 공중이면 위로, 치는 자세면 한 팔 뒤로 젖힘 → 치면 내리침
        if (hitAge < 12) {
          const k = hitAge / 12
          rig.armR.rotation.set(-2.9 + k * 2.2, 0, 0.2)
          rig.armL.rotation.set(-0.6, 0, -0.3)
        } else if (air && p.power) {
          rig.armR.rotation.set(-3.0, 0, 0.35)
          rig.armL.rotation.set(-1.6, 0, -0.4)
        } else if (air) {
          rig.armR.rotation.set(-2.7, 0, 0.3)
          rig.armL.rotation.set(-2.7, 0, -0.3)
        } else if (lying) {
          rig.armR.rotation.set(-2.9, 0, 0.1)
          rig.armL.rotation.set(-2.9, 0, -0.1)
        } else if (!lose) {
          rig.armR.rotation.set(-0.9, 0, -0.35)
          rig.armL.rotation.set(-0.9, 0, 0.35)
          // 걸을 땐 통통
          if (Math.abs(p.vx) > 0.1) rig.body.position.y = Math.abs(Math.sin(t * 14)) * 0.12
        }
      })

      renderer.render(scene, camera)
      raf = requestAnimationFrame(frame)
    }
    raf = requestAnimationFrame(frame)
    propsRef.current.onReady?.()

    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
      players.forEach(({ rig }) => rig.dispose())
      renderer.dispose()
      renderer.domElement.remove()
    }
  }, [lookKey])

  return <div className="vb-players3d" ref={hostRef} aria-hidden />
}
