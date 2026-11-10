import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import type { Look } from './animalKinds'
import { type AnimalRig, makeAnimal } from './animals'

// 1:1 게임 위쪽 띠: 양쪽 끝에 두 사람의 3D 동물이 상반신으로 서서 가운데(판·카드) 쪽을 본다. 게임 규칙은 모른다.
// 짝맞추기에서 처음 만들고 오목·숫자야구도 같이 씀. 왼쪽 나(파랑), 오른쪽 상대(빨강). 혼자 하기면 looks 하나(왼쪽만).
// 점수·차례 글자는 게임이 이 위에 겹친다 (담는 칸 크기에 맞춰 늘고 줆).
// 반응: turn = 한 손 들기 · wait = 가만히 · good = 만세 · okay = 한 손 들고 웃음 · bad = 놀람 · win = 만세 · lose = 눈 ✕

export type Reaction = 'turn' | 'wait' | 'good' | 'okay' | 'bad' | 'win' | 'lose'

type Props = {
  looks: readonly Look[]
  reactions: readonly Reaction[]
  /** 셔츠 색 (기본 나 파랑·상대 빨강) */
  colors?: readonly string[]
  className?: string
  onReady?: () => void
}

const COLORS = ['#2563eb', '#dc2626']
const FOV = 24
const CAM_Z = 6
const LOOK_Y = 1.72

export function DuelStrip3D(props: Props) {
  const hostRef = useRef<HTMLDivElement>(null)
  const propsRef = useRef(props)
  useEffect(() => {
    propsRef.current = props
  })
  const key = JSON.stringify(props.looks)

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
    scene.add(new THREE.HemisphereLight('#fff6e8', '#5a3a22', 1.15))
    const sun = new THREE.DirectionalLight('#fff4dc', 1.4)
    sun.position.set(2, 6, 8)
    scene.add(sun)
    const camera = new THREE.PerspectiveCamera(FOV, 1, 0.1, 50)
    camera.position.set(0, LOOK_Y + 0.25, CAM_Z)
    camera.lookAt(0, LOOK_Y, 0)

    const rigs: AnimalRig[] = propsRef.current.looks.map((look, i) => {
      const rig = makeAnimal(look, (propsRef.current.colors ?? COLORS)[i], { team: true })
      scene.add(rig.root)
      return rig
    })

    let halfW = 4
    function resize() {
      const w = Math.max(1, host!.clientWidth)
      const h = Math.max(1, host!.clientHeight)
      renderer.setSize(w, h, false)
      camera.aspect = w / h
      camera.updateProjectionMatrix()
      halfW = Math.tan(((FOV / 2) * Math.PI) / 180) * CAM_Z * camera.aspect
    }
    resize()
    const ro = new ResizeObserver(resize)
    ro.observe(host)

    let raf = 0
    function frame() {
      const { reactions } = propsRef.current
      const t = performance.now() / 1000
      rigs.forEach((rig, i) => {
        const side = i === 0 ? -1 : 1
        // 양쪽 끝에서 가운데(카드) 쪽을 보며 조금 숙임
        rig.root.position.set(side * (halfW - 1.15), 0, 0)
        rig.root.rotation.y = -side * 0.55
        const r = reactions[i] ?? 'wait'
        const pose = r === 'good' || r === 'win' ? 'cheer' : r === 'turn' || r === 'okay' ? 'raise' : r === 'bad' ? 'scared' : 'idle'
        const mood = r === 'good' || r === 'win' || r === 'okay' ? 'happy' : r === 'bad' ? 'scared' : r === 'lose' ? 'ko' : 'calm'
        rig.update(t + i * 1.9, pose, mood)
        rig.body.rotation.x = r === 'wait' || r === 'turn' ? 0.12 : rig.body.rotation.x
      })
      renderer.render(scene, camera)
      raf = requestAnimationFrame(frame)
    }
    raf = requestAnimationFrame(frame)
    propsRef.current.onReady?.()

    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
      rigs.forEach((r) => r.dispose())
      renderer.dispose()
      renderer.domElement.remove()
    }
  }, [key])

  return <div className={props.className ?? 'duel-strip3d'} ref={hostRef} aria-hidden />
}
