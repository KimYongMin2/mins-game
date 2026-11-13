import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import type { Look } from '../../../shared/art3d/animalKinds'
import { makeAnimal } from '../../../shared/art3d/animals'
import { BATTER_X, MOUND_HEIGHT, PITCHER_DISTANCE, PLAYER_HEIGHT } from '../constants'
import { type Camera, FIELD_ASPECT, screenUnit } from './camera'
import { type Impact, shakeOf } from './impact'
import { addRoomLight } from '../../../shared/art3d/stage'

// 2D 야구장(Field) 위에 겹치는 투명한 3D 층: 투수·타자만 동물 캐릭터로 그린다.
// 경기장·공·효과·카메라는 2D 그대로라 타이밍이 예전과 똑같다 (3D 경기장은 원근 때문에 너무 어려워서 되돌림).
// 정사영 카메라를 2D 카메라(centerX·width, 지면 84% 높이)와 똑같이 맞춰, 2D 좌표 (x, 높이) = 3D (0, 높이, -x)가 같은 자리에 보인다.

type Props = {
  camera: Camera
  swing?: number | null
  throwT?: number | null
  impact?: Impact | null
  looks: { batter: Look; pitcher: Look }
  now?: number
  /** 처음 그렸을 때 (2D 선수를 끄라고) */
  onReady?: () => void
}

/** 동물(키 약 2.6) → 야구 선수 키(PLAYER_HEIGHT 3)에 맞춤 */
const RIG_SCALE = PLAYER_HEIGHT / 2.6
const GROUND_RATIO = 0.84

export function Players3D(props: Props) {
  const hostRef = useRef<HTMLDivElement>(null)
  const propsRef = useRef(props)
  useEffect(() => {
    propsRef.current = props
  })
  const lookKey = JSON.stringify(props.looks)

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
    const dropRoomLight = addRoomLight(renderer, scene) // 털·나무에 은은한 반사 (실감 나게)
    scene.add(new THREE.HemisphereLight('#ffffff', '#6b8f5a', 1.1))
    const sun = new THREE.DirectionalLight('#fff4dc', 1.4)
    sun.position.set(30, 25, 10)
    scene.add(sun)
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 200)

    const { looks } = propsRef.current
    const rig = (look: Look) => {
      const r = makeAnimal(look, '#f4f4f1')
      r.root.scale.setScalar(RIG_SCALE)
      scene.add(r.root)
      return r
    }
    // 투수: 마운드 위, 홈(화면 왼쪽)을 봄 · 타자: 홈 옆에서 카메라 쪽(홈플레이트)을 보고 투수 쪽으로 고개
    const pitcher = rig(looks.pitcher)
    pitcher.root.position.set(0, MOUND_HEIGHT, -PITCHER_DISTANCE)
    const batter = rig(looks.batter)
    batter.root.position.set(-0.9, 0, -BATTER_X)
    batter.root.rotation.y = Math.PI / 2
    batter.head.rotation.y = Math.PI / 2 - 0.25

    // 배트: 타자 몸에 붙여 몸이 도는 대로
    // 두 손이 배트 손잡이를 같이 쥔다: 손잡이는 가슴 앞 가운데(GRIP), 두 팔이 매 프레임 거기를 향함
    // (처음엔 배트만 가슴에 붙고 팔은 앞으로 뻗어 있어서 손이 배트를 안 잡고 있었음 — 사용자 '방망이 잘못 들고 있다')
    const GRIP = new THREE.Vector3(-0.08, 1.3, 0.5)
    const batPivot = new THREE.Group()
    batPivot.position.copy(GRIP)
    batter.body.add(batPivot)
    const DOWN = new THREE.Vector3(0, -1, 0)
    const toGrip = new THREE.Vector3()
    const bat = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.032, 1.05, 14), new THREE.MeshStandardMaterial({ color: '#c8955a', roughness: 0.45 }))
    bat.position.y = 0.45
    batPivot.add(bat)
    const UP = new THREE.Vector3(0, 1, 0)
    const BAT_READY = new THREE.Vector3(-0.72, 0.66, -0.15).normalize()
    const BAT_HIT = new THREE.Vector3(0.05, 0.12, 1).normalize()
    const BAT_FOLLOW = new THREE.Vector3(0.85, 0.35, -0.4).normalize()
    const qa = new THREE.Quaternion()
    const qb = new THREE.Quaternion()

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

    let raf = 0
    function frame() {
      const p = propsRef.current
      const now = p.now ?? performance.now()
      const t = now / 1000

      // 카메라: 2D와 같은 화면 범위 (+ 맞은 순간 흔들림도 같이)
      const cw = p.camera.width
      const ch = cw / FIELD_ASPECT
      camera.left = -cw / 2
      camera.right = cw / 2
      camera.top = ch * GROUND_RATIO
      camera.bottom = -ch * (1 - GROUND_RATIO)
      camera.updateProjectionMatrix()
      const shake = shakeOf(p.impact, screenUnit(p.camera))
      camera.position.set(60, shake.y, -p.camera.centerX + shake.x)
      camera.lookAt(0, shake.y, -p.camera.centerX + shake.x)

      // 투수: 공 놓기 전 0.75초 와인드업 → 놓는 순간 팔 휘두름 → 마무리
      pitcher.update(t, 'idle', 'calm')
      pitcher.body.rotation.y = 0
      const tt = p.throwT
      if (tt !== null && tt !== undefined && tt > -800 && tt < 900) {
        const k = tt / 750
        if (tt < 0) {
          pitcher.armL.rotation.x = 2.5 * (1 + k)
          pitcher.armR.rotation.x = -0.8 * (1 + k)
          pitcher.body.rotation.x = -0.15 * (1 + k)
          pitcher.body.rotation.y = 0.5 * (1 + k)
        } else {
          const f = Math.min(1, tt / 160)
          pitcher.armL.rotation.x = 2.5 - f * 4.1
          pitcher.armR.rotation.x = -0.8 + f * 0.8
          pitcher.body.rotation.x = 0.35 * Math.min(1, tt / 200) * Math.max(0, 1 - (tt - 300) / 600)
          pitcher.body.rotation.y = 0.5 - f * 0.9
        }
      }

      // 타자: 준비(포수 쪽으로 살짝 꼼) → 스윙(몸 비틀기 + 배트가 존을 지나 돌아감)
      batter.update(t, 'idle', 'calm')
      for (const arm of [batter.armL, batter.armR]) {
        toGrip.copy(GRIP).sub(arm.position)
        // 팔(어깨~손 0.5)이 손잡이까지 닿게 조금 늘림
        arm.scale.y = Math.min(1.5, Math.max(1, toGrip.length() / 0.5))
        arm.quaternion.setFromUnitVectors(DOWN, toGrip.normalize())
      }
      const prog = p.swing === null || p.swing === undefined ? -1 : p.swing
      if (prog < 0) {
        batter.body.rotation.y = -0.35 + Math.sin(t * 3) * 0.03
        batPivot.quaternion.setFromUnitVectors(UP, BAT_READY)
      } else {
        batter.body.rotation.y = -0.35 + Math.min(1, prog * 1.4) * 1.7
        if (prog < 0.4) {
          qa.setFromUnitVectors(UP, BAT_READY)
          qb.setFromUnitVectors(UP, BAT_HIT)
          batPivot.quaternion.slerpQuaternions(qa, qb, prog / 0.4)
        } else {
          qa.setFromUnitVectors(UP, BAT_HIT)
          qb.setFromUnitVectors(UP, BAT_FOLLOW)
          batPivot.quaternion.slerpQuaternions(qa, qb, Math.min(1, (prog - 0.4) / 0.6))
        }
      }

      renderer.render(scene, camera)
      raf = requestAnimationFrame(frame)
    }
    raf = requestAnimationFrame(frame)
    propsRef.current.onReady?.()

    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
      pitcher.dispose()
      batter.dispose()
      bat.geometry.dispose()
      ;(bat.material as THREE.Material).dispose()
      dropRoomLight()
      renderer.dispose()
      renderer.domElement.remove()
    }
  }, [lookKey])

  return <div className="zb-players3d" ref={hostRef} aria-hidden />
}
