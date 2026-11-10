import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { ANIMALS, plainLook } from '../../../shared/art3d/animalKinds'
import { type AnimalRig, makeAnimal } from '../../../shared/art3d/animals'
import { NODE_XY, nodeOf } from '../rules/board'
import type { From, Piece } from '../rules/moves'
import type { YutView } from '../play/view'

// 2D 천 윷판(Board) 위에 겹치는 투명한 3D 층: 말을 그 사람(팀전이면 그 팀 첫 사람)의 동물로 세운다 (사용자 요청).
// 정사영 카메라를 윷판 SVG(0~300)와 똑같이 맞춰, 칸 (x, y) = 3D (x, 300 − y)에 발을 딛는다. 아래 칸일수록 앞에 그린다.
// 말을 옮기면 폴짝 뛰어서 새 칸으로, 움직일 수 있는 내 말은 통통, 고른 말은 만세. 업힌 수는 윷판 쪽 배지(Board figures).

type Props = {
  view: YutView
  movable: number[]
  selected: From | null
  me: number
  colors: readonly string[]
  onReady?: () => void
}

const VIEW = 300
/** 동물(키 약 2.6) → 윷판 단위 (칸 사이 약 40~48) */
const S = 12.5
/** 말 한 줄에 최대 몇 무리 (말 수) */
const MAX_GROUPS = 4
const HOP_MS = 420

const onBoard = (p: Piece): p is Exclude<Piece, 'home' | 'out'> => p !== 'home' && p !== 'out'
const feet = (node: number) => {
  const [x, y] = NODE_XY[node]
  return new THREE.Vector3(x, VIEW - y - 6, y * 0.5)
}

export function Pieces3D(props: Props) {
  const hostRef = useRef<HTMLDivElement>(null)
  const propsRef = useRef(props)
  useEffect(() => {
    propsRef.current = props
  })
  const { view } = props
  // 줄마다 동물: 개인전은 그 사람, 팀전은 그 팀에서 먼저 앉은 사람
  const rowLooks = view.pieces.map((_, r) => {
    const p = view.teams ? view.teams.findIndex((t) => t === r) : r
    return view.players[p]?.avatar ?? plainLook(ANIMALS[r % ANIMALS.length])
  })
  const key = JSON.stringify(rowLooks) + props.colors.join()

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
    scene.add(new THREE.HemisphereLight('#fff6e8', '#7a5a3a', 1.2))
    const sun = new THREE.DirectionalLight('#fff4dc', 1.3)
    sun.position.set(-80, 200, 300)
    scene.add(sun)
    const camera = new THREE.OrthographicCamera(0, VIEW, VIEW, 0, 1, 2000)
    camera.position.set(0, 0, 1000)

    const { colors } = propsRef.current
    type Figure = { rig: AnimalRig; node: number | null; from: THREE.Vector3; to: THREE.Vector3; hopAt: number }
    const rows: Figure[][] = rowLooks.map((look, r) =>
      Array.from({ length: MAX_GROUPS }, () => {
        const rig = makeAnimal(look, colors[r % colors.length], { team: true })
        rig.root.scale.setScalar(S)
        // 위에서 조금 내려다본 것처럼 앞으로 살짝 숙임
        rig.root.rotation.x = 0.22
        rig.root.visible = false
        scene.add(rig.root)
        return { rig, node: null, from: new THREE.Vector3(), to: new THREE.Vector3(), hopAt: 0 }
      }),
    )

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

    const cur = new THREE.Vector3()
    let raf = 0
    function frame() {
      const { view: v, movable, selected, me } = propsRef.current
      const now = performance.now()
      const t = now / 1000
      rows.forEach((figs, r) => {
        const nodes = [...new Set((v.pieces[r] ?? []).filter(onBoard).map(nodeOf))]
        // 이미 그 칸에 있는 말은 그대로, 새 칸은 남은 말 중 가장 가까운 것이 폴짝 (새로 올린 말은 출발점에서)
        const free = figs.filter((f) => f.node === null || !nodes.includes(f.node))
        const placed = new Set(figs.filter((f) => f.node !== null && nodes.includes(f.node)).map((f) => f.node))
        for (const n of nodes) {
          if (placed.has(n)) continue
          const target = feet(n)
          free.sort((a, b) => (a.node === null ? 1e9 : a.to.distanceTo(target)) - (b.node === null ? 1e9 : b.to.distanceTo(target)))
          const f = free.shift()
          if (!f) break
          f.from.copy(f.node === null ? feet(0) : f.to)
          f.to.copy(target)
          f.hopAt = now
          f.node = n
        }
        for (const f of free) f.node = null
        for (const f of figs) {
          const shown = f.node !== null
          f.rig.root.visible = shown
          if (!shown) continue
          const k = Math.min(1, (now - f.hopAt) / HOP_MS)
          cur.lerpVectors(f.from, f.to, k)
          const hopping = k < 1
          const canPick = r === me && movable.includes(f.node!)
          const picked = canPick && selected === f.node
          const bounce = hopping ? Math.sin(Math.PI * k) * 26 : picked ? Math.abs(Math.sin(t * 7)) * 9 : canPick && selected === null ? Math.abs(Math.sin(t * 5 + r)) * 5 : 0
          f.rig.root.position.set(cur.x, cur.y + bounce, cur.z)
          // 칸을 옮기는 동안은 가는 쪽을 보고, 서 있을 땐 앞(카메라)
          const dir = f.to.x - f.from.x
          f.rig.root.rotation.y = hopping && Math.abs(dir) > 1 ? Math.sign(dir) * 0.9 : 0
          f.rig.update(t + r * 1.7, picked ? 'cheer' : hopping ? 'raise' : 'idle', picked || hopping ? 'happy' : 'calm')
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
      rows.flat().forEach((f) => f.rig.dispose())
      renderer.dispose()
      renderer.domElement.remove()
    }
  }, [key]) // eslint-disable-line react-hooks/exhaustive-deps

  return <div className="yt-pieces3d" ref={hostRef} aria-hidden />
}
