import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { ANIMALS, plainLook } from '../../../shared/art3d/animalKinds'
import { type AnimalRig, makeAnimal } from '../../../shared/art3d/animals'
import { TEAM_COLORS } from '../../../shared/team/teams'
import { PLAYER_COLORS, TANK_CY, WORLD_H, WORLD_W } from '../constants'
import { type ScreenState, myIndex } from '../play/view'
import { tankPose } from '../rules/physics'
import { shakeOf, tankDraws, tankShown } from './Battlefield'
import { addRoomLight } from '../../../shared/art3d/stage'

// 2D 전장(Battlefield) 위에 겹치는 투명한 3D 층: 대포 포탑 위로 동물이 상반신을 내밀고 타고 있다 (사용자 요청, 야구처럼 2D 위에 겹침).
// 정사영 카메라를 SVG 범위(가로 0~WORLD_W, 높이 0~WORLD_H)와 똑같이 맞춰 같은 자리에 보인다.
// 포탑 아래로 내려가는 몸(다리)은 자르기 평면으로 안 그린다 (포탑 안에 들어가 있는 것처럼).

type Props = { screen: ScreenState; onReady?: () => void }

/** 동물(키 약 2.6) → 전장 단위 */
const K = 5
/** 동물 허리 높이 (동물 단위) */
const WAIST = 0.95
/** 포탑 가운데에서 몸을 이만큼 올림 · 이 아래는 자름 (전장 단위, 포탑 반지름은 3.3) */
const LIFT = 0
const CLIP = 0.6
/** 옆을 똑바로 보면 납작해 보여서 화면 쪽으로 조금 돌림 */
const TURN = 0.55

export function Riders3D(props: Props) {
  const hostRef = useRef<HTMLDivElement>(null)
  const propsRef = useRef(props)
  useEffect(() => {
    propsRef.current = props
  })
  const players = props.screen.view?.players ?? []
  const teamed = !!props.screen.view?.teams
  const key = JSON.stringify(players.map((p) => [p.id, p.avatar])) + (props.screen.view?.teams ?? []).join()

  useEffect(() => {
    const host = hostRef.current
    const view = propsRef.current.screen.view
    if (!host || !view) return
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'low-power' })
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1))
    renderer.setClearColor(0x000000, 0)
    renderer.outputColorSpace = THREE.SRGBColorSpace
    renderer.toneMapping = THREE.ACESFilmicToneMapping
    renderer.localClippingEnabled = true
    renderer.domElement.style.cssText = 'display:block;width:100%;height:100%'
    host.appendChild(renderer.domElement)
    const scene = new THREE.Scene()
    const dropRoomLight = addRoomLight(renderer, scene) // 털·나무에 은은한 반사 (실감 나게)
    scene.add(new THREE.HemisphereLight('#ffffff', '#8a6a4a', 1.15))
    const sun = new THREE.DirectionalLight('#fff4dc', 1.4)
    sun.position.set(30, 60, 50)
    scene.add(sun)
    const camera = new THREE.OrthographicCamera(0, WORLD_W, WORLD_H, 0, 0.1, 200)
    camera.position.set(0, 0, 100)

    const riders = view.players.map((p, i) => {
      const color = view.teams ? TEAM_COLORS[view.teams[i]] : PLAYER_COLORS[i % PLAYER_COLORS.length]
      const rig: AnimalRig = makeAnimal(p.avatar ?? plainLook(ANIMALS[i % ANIMALS.length]), color, { team: true })
      rig.root.scale.setScalar(K)
      rig.root.position.y = -WAIST * K + LIFT
      const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0)
      rig.root.traverse((o) => {
        if (!(o instanceof THREE.Mesh)) return
        for (const m of Array.isArray(o.material) ? o.material : [o.material]) m.clippingPlanes = [plane]
      })
      // wrap = 포탑 가운데 (대포 기울기만큼 기움)
      const wrap = new THREE.Group()
      wrap.add(rig.root)
      scene.add(wrap)
      return { rig, wrap, plane, facing: 1 }
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

    const up = new THREE.Vector3()
    const at = new THREE.Vector3()
    let raf = 0
    function frame() {
      const { screen } = propsRef.current
      const v = screen.view
      if (v) {
        camera.position.x = -shakeOf(screen)
        const t = performance.now() / 1000
        const elapsed = screen.now - screen.phaseStart
        const tanks = tankDraws(screen)
        const me = myIndex(screen)
        const winners = v.phase === 'done' ? (v.teams && v.winTeam !== null ? v.players.map((_, i) => v.teams![i] === v.winTeam) : v.ranks.map((r) => r === 1)) : null
        riders.forEach((r, i) => {
          const tk = tanks[i]
          if (!tk || !tankShown(screen, i, tk)) {
            r.wrap.visible = false
            return
          }
          r.wrap.visible = true
          const pose = tankPose(v.terrain, tk.x)
          up.set(-Math.sin(pose.tilt), Math.cos(pose.tilt), 0)
          at.set(tk.x, pose.y, 0).addScaledVector(up, TANK_CY)
          r.wrap.position.copy(at)
          r.wrap.rotation.z = pose.tilt
          // 포탑 가운데 + CLIP 아래는 자름 (보이는 쪽 = up 방향)
          r.plane.normal.copy(up)
          r.plane.constant = -up.dot(at.clone().addScaledVector(up, CLIP))
          // 포신 쪽을 봄 (90°보다 크면 왼쪽)
          const want = tk.angle > 90 ? -1 : 1
          r.facing += (want - r.facing) * 0.2
          r.rig.root.rotation.y = r.facing * (Math.PI / 2 - TURN)
          const hurt = v.phase === 'boom' && (v.boom?.damage[i] ?? 0) > 0 && elapsed < 1400
          const active = i === v.turn && (v.phase === 'aim' || v.phase === 'countdown') && tk.alive
          const won = !!winners?.[i] && tk.alive
          r.rig.setOut(!tk.alive)
          r.rig.update(t + i * 1.3, won ? 'cheer' : !tk.alive || hurt ? 'scared' : active ? 'aim' : 'idle', won ? 'happy' : !tk.alive ? 'ko' : hurt ? 'scared' : i === me && active ? 'happy' : 'calm')
        })
      }
      renderer.render(scene, camera)
      raf = requestAnimationFrame(frame)
    }
    raf = requestAnimationFrame(frame)
    propsRef.current.onReady?.()

    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
      riders.forEach((r) => r.rig.dispose())
      dropRoomLight()
      renderer.dispose()
      renderer.domElement.remove()
    }
  }, [key, teamed])

  return <div className="at-riders3d" ref={hostRef} aria-hidden />
}
