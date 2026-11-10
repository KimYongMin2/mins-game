import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { ANIMALS, plainLook } from '../../../shared/art3d/animalKinds'
import { type AnimalRig, makeAnimal } from '../../../shared/art3d/animals'
import { NODE_XY, nodeOf } from '../rules/board'
import type { From, Piece } from '../rules/moves'
import type { YutView } from '../play/view'
import { THROW_LABEL, type Throw } from '../rules/throw'
import { woodTexture } from '../../../shared/art3d/stage'
import { FLAT } from './Sticks'

// 2D 천 윷판(Board) 위에 겹치는 투명한 3D 층: 말을 그 사람(팀전이면 그 팀 첫 사람)의 동물로 세운다 (사용자 요청).
// 정사영 카메라를 윷판 SVG(0~300)와 똑같이 맞춰, 칸 (x, y) = 3D (x, 300 − y)에 발을 딛는다. 아래 칸일수록 앞에 그린다.
// 말을 옮기면 폴짝 뛰어서 새 칸으로, 움직일 수 있는 내 말은 통통, 고른 말은 만세. 업힌 수는 윷판 쪽 배지(Board figures).
// 윷을 던지면 윷판 가운데에 큰 윷가락 넷이 아래에서 빙글빙글 날아올라 떨어지고(배·등이 결과대로), 결과 글자가 크게 뜬 뒤 사라진다 (사용자 요청).

type Props = {
  view: YutView
  movable: number[]
  selected: From | null
  me: number
  colors: readonly string[]
  /** 마지막 던지기: 결과·번호·이 기기에서 본 시각(performance.now)·던진 사람 색 */
  toss: { result: Throw; seq: number; at: number; color: string } | null
  onReady?: () => void
}

/** 던지기 연출: 날아가 떨어지기 · 그대로 보여 주기 · 사라지기 (ms) */
const TOSS_FLY = 650
const TOSS_HOLD = 1500
const TOSS_FADE = 350
const STICK_LEN = 112
const STICK_R = 11

/** 배(평평한 면): 밝은 나무에 ✕ 낙인, 빽도 가락은 아래쪽 빨간 띠 */
function stickFace(marked: boolean): THREE.CanvasTexture {
  const c = document.createElement('canvas')
  c.width = 64
  c.height = 256
  const g = c.getContext('2d')!
  const grad = g.createLinearGradient(0, 0, 64, 0)
  grad.addColorStop(0, '#e2bb7f')
  grad.addColorStop(0.5, '#f6dfb0')
  grad.addColorStop(1, '#e2bb7f')
  g.fillStyle = grad
  g.fillRect(0, 0, 64, 256)
  g.strokeStyle = 'rgba(120,70,20,0.18)'
  for (let y = 4; y < 256; y += 9) {
    g.beginPath()
    g.moveTo(0, y)
    g.lineTo(64, y + 3)
    g.stroke()
  }
  g.strokeStyle = '#5b3410'
  g.lineWidth = 7
  g.lineCap = 'round'
  g.beginPath()
  g.moveTo(16, 104)
  g.lineTo(48, 152)
  g.moveTo(48, 104)
  g.lineTo(16, 152)
  g.stroke()
  if (marked) {
    g.fillStyle = '#e5484d'
    g.fillRect(0, 214, 64, 26)
  }
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  return t
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

    // 윷가락 넷: 반원 기둥(둥근 등, 진한 나무) + 평평한 배. 배가 카메라(+z) 쪽이면 '배가 위'
    const backTex = woodTexture('#7a4a1d', false)
    const backM = new THREE.MeshStandardMaterial({ map: backTex, roughness: 0.55, side: THREE.DoubleSide })
    const sticks = [0, 1, 2, 3].map((i) => {
      const g = new THREE.Group()
      const back = new THREE.Mesh(new THREE.CylinderGeometry(STICK_R, STICK_R, STICK_LEN, 20, 1, true, Math.PI / 2, Math.PI), backM)
      const capM = new THREE.MeshStandardMaterial({ color: '#8a5523', roughness: 0.6, side: THREE.DoubleSide })
      const face = new THREE.Mesh(new THREE.PlaneGeometry(STICK_R * 2, STICK_LEN), new THREE.MeshStandardMaterial({ map: stickFace(i === 0), roughness: 0.6, side: THREE.DoubleSide }))
      // 양끝 반달 마개
      for (const y of [-STICK_LEN / 2, STICK_LEN / 2]) {
        const cap = new THREE.Mesh(new THREE.CircleGeometry(STICK_R, 20, Math.PI, Math.PI), capM)
        // 아래쪽 반원(y≤0)을 눕히면 뒤쪽(z≤0) 반달 = 등 쪽 단면
        cap.rotation.x = Math.PI / 2
        cap.position.y = y
        g.add(cap)
      }
      g.add(back, face)
      g.visible = false
      scene.add(g)
      return g
    })
    let tossSeq = -1
    let spins: { turns: number; tilt: number; dx: number }[] = []

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
      // 던지기 연출
      const toss = propsRef.current.toss
      const age = toss ? now - toss.at : Infinity
      const showing = toss !== null && age >= 0 && age < TOSS_FLY + TOSS_HOLD + TOSS_FADE
      if (toss && toss.seq !== tossSeq) {
        tossSeq = toss.seq
        spins = sticks.map((_, i) => ({ turns: 2 + ((toss.seq * 7 + i * 3) % 3), tilt: (((toss.seq * 13 + i * 5) % 7) - 3) * 0.05, dx: (((toss.seq * 11 + i * 7) % 5) - 2) * 4 }))
      }
      sticks.forEach((g, i) => {
        g.visible = showing
        if (!showing || !toss) return
        const flat = FLAT[toss.result][i]
        const k = Math.min(1, age / TOSS_FLY)
        const ease = 1 - (1 - k) * (1 - k)
        const sp = spins[i]
        const endX = VIEW / 2 + (i - 1.5) * 34 + sp.dx
        const endY = VIEW / 2
        const startX = VIEW / 2 + (i - 1.5) * 12
        const startY = -60
        // 위로 솟았다가 떨어짐 + 땅에 닿으면 살짝 튐
        const arc = Math.sin(Math.PI * Math.min(1, k)) * 110
        const bounce = k >= 1 ? Math.max(0, Math.sin(((age - TOSS_FLY) / 160) * Math.PI)) * 6 * Math.max(0, 1 - (age - TOSS_FLY) / 320) : 0
        g.position.set(startX + (endX - startX) * ease, startY + (endY - startY) * ease + arc + bounce, 600 + i)
        // 긴 축으로 빙글빙글 구르다가 결과 면으로 멈춤, 옆으로도 돌다가 살짝 기운 채로
        const finalRoll = flat ? 0 : Math.PI
        g.rotation.y = finalRoll + (1 - ease) * sp.turns * Math.PI * 2
        g.rotation.z = sp.tilt + (1 - ease) * (i % 2 ? 1 : -1) * 2.4
        g.rotation.x = 0.25 * (1 - ease)
        const fade = age > TOSS_FLY + TOSS_HOLD ? 1 - (age - TOSS_FLY - TOSS_HOLD) / TOSS_FADE : 1
        g.scale.setScalar(Math.max(0.01, fade))
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

  const { toss } = props
  return (
    <div className="yt-pieces3d" ref={hostRef} aria-hidden>
      {/* 결과 글자: 가락이 떨어질 때쯤 크게 떴다가 사라짐 (번호가 바뀔 때마다 다시) */}
      {toss && toss.at > 0 && (
        <span key={toss.seq} className="yt-toss-label" style={{ color: toss.color }}>
          {THROW_LABEL[toss.result]}!
        </span>
      )}
    </div>
  )
}
