import * as THREE from 'three'
import { type AnimalKind, type Fur, type Look, TINT_HEX } from './animalKinds'

// 3D 동물 캐릭터 (three.js 기본 도형으로 만듦, 그림 파일 없음). 큰 머리 + 작은 몸의 귀여운 비율.
// 몸통은 셔츠 색(팀전이면 팀 색), 얼굴은 동물마다 다르다. 표정(mood)과 자세(pose)를 바꿀 수 있다.
// 단위: 키 약 2.6 (발 = y 0). 얼굴은 +z 쪽.

export { ANIMALS, ANIMAL_NAMES, type AnimalKind, type Look, plainLook } from './animalKinds'

export type Mood = 'calm' | 'happy' | 'scared' | 'ko'
/** idle 가만히 · hold 두 손으로 앞에 듦 · scared 덜덜 · ko 뒤로 넘어감 · cheer 만세 */
export type Pose = 'idle' | 'hold' | 'scared' | 'ko' | 'cheer'

type Palette = { fur: string; light: string; ear: string; nose: string }

const LOOKS: Record<AnimalKind, Palette> = {
  bear: { fur: '#8a5a36', light: '#e1bf98', ear: '#c99a72', nose: '#2a1a12' },
  cat: { fur: '#f0a64b', light: '#fff1dc', ear: '#f7b3b3', nose: '#e57b8a' },
  fox: { fur: '#ee7a2c', light: '#fff4e6', ear: '#3a2418', nose: '#2a1a12' },
  rabbit: { fur: '#f2eeea', light: '#ffffff', ear: '#f6b5c4', nose: '#e57b8a' },
  panda: { fur: '#f7f5f0', light: '#ffffff', ear: '#222222', nose: '#222222' },
  dog: { fur: '#e2b57a', light: '#fbecd6', ear: '#8a5a30', nose: '#2a1a12' },
  pig: { fur: '#f6b1b8', light: '#ffd3d8', ear: '#ee95a0', nose: '#d97683' },
  frog: { fur: '#6cc04a', light: '#d9f2b8', ear: '#6cc04a', nose: '#2d5e1e' },
  tiger: { fur: '#f08c28', light: '#fff4e6', ear: '#2b2b2b', nose: '#2a1a12' },
  lion: { fur: '#e8a33d', light: '#fbe3b4', ear: '#9c4f14', nose: '#4a2a1a' },
  eagle: { fur: '#f8f9fa', light: '#ffffff', ear: '#6b3e1e', nose: '#f2b705' },
  seagull: { fur: '#fbfbfb', light: '#ffffff', ear: '#adb5bd', nose: '#f59f00' },
  penguin: { fur: '#23272d', light: '#ffffff', ear: '#23272d', nose: '#f59f00' },
  dino: { fur: '#3fae8c', light: '#c3f0dc', ear: '#f08c00', nose: '#1d5c48' },
  wolf: { fur: '#8d939b', light: '#eef0f2', ear: '#4b5058', nose: '#1f2226' },
  elephant: { fur: '#9aa5b1', light: '#c5ccd4', ear: '#f3b6c2', nose: '#7d8894' },
}

const GREY = new THREE.Color('#9ca3af')

export type AnimalRig = {
  root: THREE.Group
  kind: AnimalKind
  /** 매 프레임: t = 초, pose·mood에 맞춰 움직인다 */
  update: (t: number, pose: Pose, mood: Mood) => void
  /** 탈락하면 회색으로 */
  setOut: (out: boolean) => void
  /** 폭탄 같은 걸 들 때 손 사이 위치 (root 기준) */
  handsAt: THREE.Vector3
  /** 머리 (이름표를 붙일 곳) */
  head: THREE.Object3D
  dispose: () => void
}

/** 털 색 바꾸기: 연하게(흰색 쪽) · 진하게(검은색 쪽) */
function shade(color: string, fur: Fur): string {
  if (fur === 'base') return color
  return '#' + new THREE.Color(color).lerp(new THREE.Color(fur === 'light' ? '#ffffff' : '#000000'), fur === 'light' ? 0.4 : 0.35).getHexString()
}

/** 등번호 그림 (캔버스) */
function numberTexture(n: number, color: string): THREE.CanvasTexture {
  const c = document.createElement('canvas')
  c.width = c.height = 128
  const g = c.getContext('2d')!
  g.font = '900 96px system-ui, sans-serif'
  g.textAlign = 'center'
  g.textBaseline = 'middle'
  g.lineWidth = 8
  g.strokeStyle = 'rgba(0,0,0,0.25)'
  g.strokeText(String(n), 64, 70)
  g.fillStyle = color
  g.fillText(String(n), 64, 70)
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  return t
}

/** shirt = 자리 색, opts.team = 팀전이라 shirt가 팀 색 (유니폼도 팀 색 바탕으로) */
export function makeAnimal(lookIn: Look, shirt: string, opts: { team?: boolean } = {}): AnimalRig {
  const kind: AnimalKind = lookIn.animal
  const base = LOOKS[kind]
  const look = { ...base, fur: shade(base.fur, lookIn.fur), light: shade(base.light, lookIn.fur === 'dark' ? 'base' : lookIn.fur) }
  const mats: { m: THREE.MeshStandardMaterial; base: THREE.Color }[] = []
  const mat = (color: string, rough = 0.75, metal = 0) => {
    const m = new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: metal })
    mats.push({ m, base: m.color.clone() })
    return m
  }
  const furM = mat(look.fur, 0.85)
  const lightM = mat(look.light, 0.85)
  const earM = mat(look.ear, 0.8)
  const noseM = mat(look.nose, 0.35)
  // 야구 유니폼: 흰 바탕(팀전이면 팀 색) + 내 색 소매·깃·단추줄·등번호
  const uniform = lookIn.outfit === 'uniform'
  const tint = TINT_HEX[lookIn.tint]
  const shirtM = mat(uniform ? (opts.team ? shirt : '#f4f4f1') : shirt, 0.55)
  const sleeveM = uniform ? mat(tint, 0.5) : shirtM
  const eyeM = mat('#14161b', 0.15)
  const whiteM = mat('#ffffff', 0.3)
  const cheekM = new THREE.MeshStandardMaterial({ color: '#ff8f9a', roughness: 0.9, transparent: true, opacity: 0.55 })

  const extraDispose: (() => void)[] = []
  const mesh = (g: THREE.BufferGeometry, m: THREE.Material, x = 0, y = 0, z = 0) => {
    const o = new THREE.Mesh(g, m)
    o.position.set(x, y, z)
    o.castShadow = true
    return o
  }

  const root = new THREE.Group()
  const bodyG = new THREE.Group()
  root.add(bodyG)

  // 몸통 (셔츠) + 배
  const torso = mesh(new THREE.CapsuleGeometry(0.42, 0.45, 8, 20), shirtM, 0, 1.15, 0)
  bodyG.add(torso)
  const collar = mesh(new THREE.TorusGeometry(0.22, 0.05, 8, 20), mat('#ffffff', 0.5), 0, 1.6, 0.05)
  collar.rotation.x = Math.PI / 2
  bodyG.add(collar)

  // 팔: 어깨에서 늘어진 팔 + 손 (손은 털 색)
  const arm = (side: 1 | -1) => {
    const pivot = new THREE.Group()
    pivot.position.set(side * 0.46, 1.48, 0)
    const sleeve = mesh(new THREE.CapsuleGeometry(0.12, 0.32, 6, 12), sleeveM, 0, -0.24, 0)
    const hand = mesh(new THREE.SphereGeometry(0.13, 16, 12), furM, 0, -0.5, 0)
    pivot.add(sleeve, hand)
    bodyG.add(pivot)
    return pivot
  }
  const armL = arm(-1)
  const armR = arm(1)

  // 머리
  const head = new THREE.Group()
  head.position.set(0, 2.05, 0)
  bodyG.add(head)
  const skull = mesh(new THREE.SphereGeometry(0.52, 32, 24), furM)
  skull.scale.set(1, 0.94, 0.95)
  head.add(skull)

  // 눈 (보통 / 겁먹음 / ✕)
  let eyeY = 0.06
  let eyeX = 0.18
  let eyeZ = 0.46
  if (kind === 'frog') {
    eyeY = 0.42
    eyeX = 0.22
    eyeZ = 0.24
    for (const s of [-1, 1]) head.add(mesh(new THREE.SphereGeometry(0.17, 20, 14), furM, s * eyeX, eyeY - 0.02, eyeZ - 0.06))
  }
  const eyes = new THREE.Group()
  const scaredEyes = new THREE.Group()
  const koEyes = new THREE.Group()
  for (const s of [-1, 1]) {
    const e = mesh(new THREE.SphereGeometry(0.07, 14, 10), eyeM, s * eyeX, eyeY, eyeZ)
    const shine = mesh(new THREE.SphereGeometry(0.024, 8, 6), whiteM, s * eyeX + 0.025, eyeY + 0.03, eyeZ + 0.055)
    eyes.add(e, shine)
    const white = mesh(new THREE.SphereGeometry(0.11, 14, 10), whiteM, s * eyeX, eyeY + 0.01, eyeZ - 0.02)
    white.scale.z = 0.6
    const pupil = mesh(new THREE.SphereGeometry(0.045, 10, 8), eyeM, s * eyeX, eyeY + 0.01, eyeZ + 0.05)
    scaredEyes.add(white, pupil)
    for (const r of [-1, 1]) {
      const bar = mesh(new THREE.BoxGeometry(0.17, 0.035, 0.03), eyeM, s * eyeX, eyeY, eyeZ + 0.02)
      bar.rotation.z = (r * Math.PI) / 4
      koEyes.add(bar)
    }
  }
  head.add(eyes, scaredEyes, koEyes)

  // 볼
  for (const s of [-1, 1]) {
    const c = mesh(new THREE.SphereGeometry(0.08, 12, 8), cheekM, s * 0.32, -0.1, 0.4)
    c.scale.set(1.2, 0.6, 0.4)
    c.castShadow = false
    head.add(c)
  }

  // 입: 웃음(반원) / 벌림(동그라미)
  const smile = mesh(new THREE.TorusGeometry(0.07, 0.018, 6, 16, Math.PI), noseM, 0, -0.17, 0.47)
  smile.rotation.z = Math.PI
  const open = mesh(new THREE.SphereGeometry(0.07, 14, 10), mat('#5a1d24', 0.6), 0, -0.2, 0.45)
  open.scale.set(0.8, 1, 0.5)
  head.add(smile, open)

  // 동물마다 귀·코·무늬
  const snout = (color: THREE.Material, w = 0.2, y = -0.1) => {
    const s = mesh(new THREE.SphereGeometry(w, 20, 14), color, 0, y, 0.4)
    s.scale.set(1.15, 0.8, 0.7)
    head.add(s)
    return s
  }
  const nose = (y: number, z: number, r = 0.06) => {
    const n = mesh(new THREE.SphereGeometry(r, 12, 10), noseM, 0, y, z)
    n.scale.set(1.3, 0.9, 0.9)
    head.add(n)
  }
  const cone = (m: THREE.Material, r: number, h: number, x: number, y: number, z: number, tilt: number) => {
    const c = mesh(new THREE.ConeGeometry(r, h, 16), m, x, y, z)
    c.rotation.z = tilt
    head.add(c)
    return c
  }
  switch (kind) {
    case 'bear':
      for (const s of [-1, 1]) {
        head.add(mesh(new THREE.SphereGeometry(0.17, 16, 12), furM, s * 0.34, 0.4, -0.02))
        head.add(mesh(new THREE.SphereGeometry(0.09, 12, 10), earM, s * 0.34, 0.4, 0.08))
      }
      snout(lightM)
      nose(-0.04, 0.55)
      smile.position.y = -0.2
      smile.position.z = 0.5
      break
    case 'cat':
      for (const s of [-1, 1]) {
        cone(furM, 0.17, 0.32, s * 0.3, 0.46, 0, -s * 0.35)
        cone(earM, 0.09, 0.2, s * 0.3, 0.44, 0.07, -s * 0.35)
        for (const k of [-1, 1]) {
          const w = mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.34, 4), whiteM, s * 0.33, -0.08 + k * 0.04, 0.42)
          w.rotation.z = Math.PI / 2 + s * k * 0.15
          w.castShadow = false
          head.add(w)
        }
      }
      nose(-0.06, 0.5, 0.045)
      break
    case 'fox':
      for (const s of [-1, 1]) {
        cone(furM, 0.17, 0.42, s * 0.28, 0.5, 0, -s * 0.25)
        cone(earM, 0.07, 0.15, s * 0.31, 0.66, 0.02, -s * 0.25)
      }
      {
        const m = mesh(new THREE.ConeGeometry(0.2, 0.36, 18), lightM, 0, -0.1, 0.48)
        m.rotation.x = Math.PI / 2
        head.add(m)
      }
      for (const s of [-1, 1]) {
        const c = mesh(new THREE.SphereGeometry(0.2, 14, 10), lightM, s * 0.26, -0.16, 0.3)
        c.scale.set(1, 0.7, 0.6)
        head.add(c)
      }
      nose(-0.06, 0.67, 0.05)
      smile.position.set(0, -0.24, 0.5)
      open.position.set(0, -0.26, 0.5)
      break
    case 'rabbit':
      for (const s of [-1, 1]) {
        const ear = mesh(new THREE.CapsuleGeometry(0.09, 0.5, 6, 12), furM, s * 0.17, 0.75, -0.04)
        ear.rotation.z = -s * 0.12
        const inner = mesh(new THREE.CapsuleGeometry(0.045, 0.4, 6, 10), earM, s * 0.17, 0.75, 0.03)
        inner.rotation.z = -s * 0.12
        head.add(ear, inner)
      }
      snout(lightM, 0.16, -0.12)
      nose(-0.05, 0.53, 0.04)
      head.add(mesh(new THREE.BoxGeometry(0.08, 0.07, 0.03), whiteM, 0, -0.22, 0.48))
      smile.visible = false
      break
    case 'panda':
      for (const s of [-1, 1]) {
        head.add(mesh(new THREE.SphereGeometry(0.15, 16, 12), earM, s * 0.34, 0.4, -0.02))
        const patch = mesh(new THREE.SphereGeometry(0.13, 16, 12), earM, s * eyeX, eyeY - 0.01, eyeZ - 0.06)
        patch.scale.set(1.1, 1.3, 0.5)
        patch.rotation.z = s * 0.5
        head.add(patch)
      }
      snout(lightM, 0.17)
      nose(-0.05, 0.54)
      smile.position.set(0, -0.2, 0.5)
      break
    case 'dog':
      for (const s of [-1, 1]) {
        const ear = mesh(new THREE.SphereGeometry(0.2, 16, 12), earM, s * 0.48, 0.02, 0)
        ear.scale.set(0.55, 1.3, 0.7)
        ear.rotation.z = s * 0.3
        head.add(ear)
      }
      snout(lightM, 0.21)
      nose(-0.02, 0.57, 0.07)
      smile.position.set(0, -0.2, 0.52)
      break
    case 'pig':
      for (const s of [-1, 1]) cone(earM, 0.14, 0.22, s * 0.3, 0.44, 0.05, -s * 0.6)
      {
        const p = mesh(new THREE.CylinderGeometry(0.15, 0.16, 0.12, 20), noseM, 0, -0.08, 0.5)
        p.rotation.x = Math.PI / 2
        head.add(p)
        for (const s of [-1, 1]) head.add(mesh(new THREE.SphereGeometry(0.035, 8, 6), eyeM, s * 0.06, -0.08, 0.565))
      }
      smile.position.set(0, -0.26, 0.45)
      open.position.set(0, -0.27, 0.44)
      break
    case 'frog':
      smile.scale.set(2.2, 1, 1)
      smile.position.set(0, -0.12, 0.46)
      for (const s of [-1, 1]) head.add(mesh(new THREE.SphereGeometry(0.02, 6, 6), eyeM, s * 0.06, 0.02, 0.5))
      break
    case 'tiger': {
      const stripe = mat('#2b2b2b', 0.8)
      for (const s of [-1, 1]) {
        head.add(mesh(new THREE.SphereGeometry(0.16, 16, 12), furM, s * 0.34, 0.4, -0.02))
        head.add(mesh(new THREE.SphereGeometry(0.08, 12, 10), stripe, s * 0.34, 0.41, 0.08))
      }
      // 이마·볼 줄무늬: 머리 겉면에 붙인 얇은 막대
      for (const [x, y, len, rot] of [
        [-0.12, 0.34, 0.16, 0],
        [0, 0.38, 0.2, 0],
        [0.12, 0.34, 0.16, 0],
        [-0.42, 0.06, 0.18, 1.3],
        [-0.44, -0.08, 0.16, 1.4],
        [0.42, 0.06, 0.18, -1.3],
        [0.44, -0.08, 0.16, -1.4],
      ] as const) {
        const z = Math.sqrt(Math.max(0, 0.52 * 0.52 - x * x - y * y)) * 0.95
        const m = mesh(new THREE.BoxGeometry(0.045, len, 0.03), stripe, x, y, z)
        m.lookAt(new THREE.Vector3(x, y, z).multiplyScalar(2))
        m.rotateZ(rot)
        head.add(m)
      }
      snout(lightM)
      for (const s of [-1, 1]) {
        const c = mesh(new THREE.SphereGeometry(0.16, 14, 10), lightM, s * 0.22, -0.16, 0.34)
        c.scale.set(1, 0.7, 0.6)
        head.add(c)
      }
      nose(-0.04, 0.55)
      smile.position.set(0, -0.2, 0.5)
      break
    }
    case 'lion': {
      // 갈기: 머리 뒤로 둥글게 털뭉치
      const mane = mat(look.ear, 0.95)
      for (let k = 0; k < 14; k++) {
        const a = (k / 14) * Math.PI * 2
        head.add(mesh(new THREE.SphereGeometry(0.2, 12, 10), mane, Math.cos(a) * 0.5, Math.sin(a) * 0.48 + 0.02, -0.12))
      }
      for (const s of [-1, 1]) head.add(mesh(new THREE.SphereGeometry(0.12, 12, 10), furM, s * 0.32, 0.38, 0.05))
      snout(lightM)
      nose(-0.04, 0.55)
      smile.position.set(0, -0.2, 0.5)
      break
    }
    case 'eagle': {
      const beak = mesh(new THREE.ConeGeometry(0.13, 0.34, 16), noseM, 0, -0.06, 0.6)
      beak.rotation.x = Math.PI / 2 + 0.35
      const tip = mesh(new THREE.SphereGeometry(0.05, 10, 8), noseM, 0, -0.17, 0.72)
      head.add(beak, tip)
      // 매서운 눈썹
      for (const s of [-1, 1]) {
        const brow = mesh(new THREE.BoxGeometry(0.17, 0.04, 0.04), earM, s * eyeX, eyeY + 0.12, eyeZ + 0.01)
        brow.rotation.z = s * -0.35
        head.add(brow)
      }
      smile.visible = false
      break
    }
    case 'seagull': {
      const beak = mesh(new THREE.ConeGeometry(0.08, 0.42, 14), noseM, 0, -0.08, 0.66)
      beak.rotation.x = Math.PI / 2
      beak.scale.set(1, 1, 0.6)
      head.add(beak, mesh(new THREE.SphereGeometry(0.03, 8, 6), mat('#e03131', 0.4), 0, -0.12, 0.78))
      // 머리 뒤 회색 깃
      const back = mesh(new THREE.SphereGeometry(0.4, 20, 14), earM, 0, 0.08, -0.22)
      back.scale.set(1.1, 0.9, 0.8)
      head.add(back)
      smile.visible = false
      break
    }
    case 'penguin': {
      const face = mesh(new THREE.SphereGeometry(0.42, 24, 18), lightM, 0, -0.05, 0.2)
      face.scale.set(0.92, 0.85, 0.72)
      head.add(face)
      const beak = mesh(new THREE.ConeGeometry(0.08, 0.2, 12), noseM, 0, -0.08, 0.56)
      beak.rotation.x = Math.PI / 2
      head.add(beak)
      smile.visible = false
      break
    }
    case 'dino': {
      // 길쭉한 주둥이 + 머리 뒤 등뼈
      const muzzle = mesh(new THREE.SphereGeometry(0.3, 20, 14), furM, 0, -0.12, 0.34)
      muzzle.scale.set(1.15, 0.75, 1)
      head.add(muzzle)
      for (const s of [-1, 1]) head.add(mesh(new THREE.SphereGeometry(0.025, 8, 6), noseM, s * 0.08, -0.06, 0.63))
      for (let k = 0; k < 4; k++) {
        const sp = mesh(new THREE.ConeGeometry(0.08 - k * 0.008, 0.2, 8), earM, 0, 0.46 - k * 0.12, -0.1 - k * 0.14)
        sp.rotation.x = -0.5 - k * 0.3
        head.add(sp)
      }
      smile.position.set(0, -0.22, 0.6)
      smile.scale.set(1.6, 1, 1)
      open.position.set(0, -0.24, 0.6)
      break
    }
    case 'wolf':
      for (const s of [-1, 1]) {
        cone(furM, 0.15, 0.36, s * 0.28, 0.48, -0.02, -s * 0.2)
        cone(earM, 0.07, 0.18, s * 0.28, 0.46, 0.05, -s * 0.2)
      }
      {
        const m = mesh(new THREE.ConeGeometry(0.2, 0.36, 18), lightM, 0, -0.1, 0.48)
        m.rotation.x = Math.PI / 2
        head.add(m)
      }
      nose(-0.06, 0.67, 0.055)
      smile.position.set(0, -0.24, 0.5)
      open.position.set(0, -0.26, 0.5)
      break
    case 'elephant': {
      for (const s of [-1, 1]) {
        const ear = mesh(new THREE.SphereGeometry(0.34, 20, 14), furM, s * 0.52, 0.02, -0.08)
        ear.scale.set(0.3, 1, 0.95)
        const inner = mesh(new THREE.SphereGeometry(0.26, 16, 12), earM, s * 0.555, 0.02, -0.04)
        inner.scale.set(0.2, 0.9, 0.85)
        head.add(ear, inner)
        const tusk = mesh(new THREE.ConeGeometry(0.04, 0.16, 8), whiteM, s * 0.14, -0.24, 0.42)
        tusk.rotation.x = Math.PI * 0.85
        head.add(tusk)
      }
      // 코: 아래로 휘어 내려가는 공 몇 개
      for (let k = 0; k < 5; k++) {
        const r = 0.12 - k * 0.012
        head.add(mesh(new THREE.SphereGeometry(r, 14, 10), furM, 0, -0.08 - k * 0.1, 0.5 + Math.sin(k * 0.5) * 0.08))
      }
      smile.visible = false
      break
    }
  }

  // ---- 야구 유니폼: 깃·단추줄·앞 번호(작게)·등번호(크게) ----
  if (uniform) {
    collar.material = sleeveM
    const placket = mesh(new THREE.BoxGeometry(0.06, 0.62, 0.02), sleeveM, 0, 1.16, 0.42)
    bodyG.add(placket)
    for (let k = 0; k < 3; k++) bodyG.add(mesh(new THREE.SphereGeometry(0.018, 8, 6), mat('#f8f9fa', 0.3), 0, 1.38 - k * 0.18, 0.435))
    const numColor = opts.team ? '#ffffff' : tint
    const numTex = numberTexture(lookIn.number, numColor)
    const numMat = new THREE.MeshStandardMaterial({ map: numTex, transparent: true, roughness: 0.6 })
    const back = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.5), numMat)
    back.position.set(0, 1.18, -0.44)
    back.rotation.y = Math.PI
    const front = new THREE.Mesh(new THREE.PlaneGeometry(0.2, 0.2), numMat)
    front.position.set(-0.17, 1.3, 0.4)
    front.rotation.y = -0.38
    bodyG.add(back, front)
    extraDispose.push(() => {
      numTex.dispose()
      numMat.dispose()
    })
  }

  // ---- 꾸미기: 모자 · 안경 · 목 장식 ----
  const accM = (color: string, rough = 0.5, metal = 0) => mat(color, rough, metal)
  const headTop = kind === 'frog' ? 0.5 : 0.46
  switch (lookIn.hat) {
    case 'cap': {
      const c = accM(tint, 0.6)
      const dome = mesh(new THREE.SphereGeometry(0.55, 28, 14, 0, Math.PI * 2, 0, Math.PI / 2), c, 0, headTop - 0.28, 0)
      dome.scale.set(1, 0.72, 1)
      const brim = mesh(new THREE.CylinderGeometry(0.32, 0.32, 0.04, 24, 1, false, -Math.PI / 2, Math.PI), c, 0, headTop - 0.27, 0.42)
      brim.scale.set(1, 1, 1.1)
      const button = mesh(new THREE.SphereGeometry(0.06, 10, 8), accM('#ffffff'), 0, headTop + 0.1, 0)
      head.add(dome, brim, button)
      break
    }
    case 'crown': {
      const gold = accM('#f5c518', 0.25, 0.9)
      const band = mesh(new THREE.CylinderGeometry(0.3, 0.33, 0.2, 10, 1, true), gold, 0, headTop + 0.02, 0)
      band.material.side = THREE.DoubleSide
      head.add(band)
      for (let k = 0; k < 5; k++) {
        const a = (k / 5) * Math.PI * 2
        head.add(mesh(new THREE.ConeGeometry(0.07, 0.18, 8), gold, Math.sin(a) * 0.3, headTop + 0.2, Math.cos(a) * 0.3))
        head.add(mesh(new THREE.SphereGeometry(0.035, 8, 6), accM(['#e64980', '#4dabf7', '#51cf66'][k % 3], 0.2), Math.sin(a) * 0.32, headTop + 0.02, Math.cos(a) * 0.32))
      }
      break
    }
    case 'party': {
      const cone = mesh(new THREE.ConeGeometry(0.22, 0.55, 20), accM('#7950f2', 0.55), 0.08, headTop + 0.24, 0)
      cone.rotation.z = -0.2
      const pom = mesh(new THREE.SphereGeometry(0.08, 12, 10), accM('#ffd43b'), 0.14, headTop + 0.52, 0)
      for (let k = 0; k < 3; k++) {
        const stripe = mesh(new THREE.TorusGeometry(0.17 - k * 0.05, 0.018, 6, 20), accM('#ffd43b'), 0.08 + k * 0.025, headTop + 0.08 + k * 0.13, 0)
        stripe.rotation.x = Math.PI / 2
        stripe.rotation.y = -0.2
        head.add(stripe)
      }
      head.add(cone, pom)
      break
    }
    case 'beanie': {
      const knit = accM('#1c7ed6', 0.95)
      const dome = mesh(new THREE.SphereGeometry(0.56, 28, 14, 0, Math.PI * 2, 0, Math.PI / 2), knit, 0, headTop - 0.3, 0)
      dome.scale.set(1, 0.85, 1)
      const band = mesh(new THREE.TorusGeometry(0.5, 0.07, 10, 32), accM('#f1f3f5', 0.95), 0, headTop - 0.28, 0)
      band.rotation.x = Math.PI / 2
      const pom = mesh(new THREE.SphereGeometry(0.12, 14, 10), accM('#f1f3f5', 0.95), 0, headTop + 0.22, 0)
      head.add(dome, band, pom)
      break
    }
    case 'tophat': {
      const black = accM('#1a1b1e', 0.4)
      head.add(mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.04, 28), black, 0, headTop + 0.02, 0))
      head.add(mesh(new THREE.CylinderGeometry(0.25, 0.27, 0.42, 24), black, 0, headTop + 0.24, 0))
      head.add(mesh(new THREE.CylinderGeometry(0.272, 0.272, 0.08, 24), accM('#c92a2a', 0.5), 0, headTop + 0.08, 0))
      break
    }
  }
  if (lookIn.glasses !== 'none') {
    const gz = eyeZ + 0.07
    const frame = accM(lookIn.glasses === 'star' ? '#f06595' : '#212529', 0.3, 0.3)
    for (const s of [-1, 1]) {
      if (lookIn.glasses === 'round') {
        head.add(mesh(new THREE.TorusGeometry(0.11, 0.016, 8, 24), frame, s * eyeX, eyeY, gz))
      } else if (lookIn.glasses === 'sun') {
        const lens = mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.03, 24), accM('#101113', 0.08, 0.6), s * eyeX, eyeY - 0.01, gz)
        lens.rotation.x = Math.PI / 2
        lens.scale.set(1.15, 1, 0.85)
        head.add(lens)
      } else {
        const star = new THREE.Shape()
        for (let k = 0; k < 10; k++) {
          const r = k % 2 ? 0.06 : 0.14
          const a = (k / 10) * Math.PI * 2 + Math.PI / 2
          if (k === 0) star.moveTo(Math.cos(a) * r, Math.sin(a) * r)
          else star.lineTo(Math.cos(a) * r, Math.sin(a) * r)
        }
        const m = mesh(new THREE.ExtrudeGeometry(star, { depth: 0.025, bevelEnabled: false }), frame, s * eyeX, eyeY, gz - 0.01)
        head.add(m)
      }
    }
    const bridge = mesh(new THREE.CylinderGeometry(0.012, 0.012, eyeX * 2 - 0.2, 6), frame, 0, eyeY + 0.02, gz)
    bridge.rotation.z = Math.PI / 2
    head.add(bridge)
  }
  if (lookIn.neck !== 'none') {
    collar.visible = false
    if (lookIn.neck === 'bow') {
      const red = accM('#e03131', 0.5)
      for (const s of [-1, 1]) {
        const wing = mesh(new THREE.ConeGeometry(0.1, 0.2, 12), red, s * 0.12, 1.6, 0.36)
        wing.rotation.z = (s * Math.PI) / 2
        bodyG.add(wing)
      }
      bodyG.add(mesh(new THREE.SphereGeometry(0.06, 10, 8), red, 0, 1.6, 0.38))
    } else if (lookIn.neck === 'scarf') {
      const wool = accM('#f08c00', 0.95)
      const ring = mesh(new THREE.TorusGeometry(0.3, 0.1, 10, 28), wool, 0, 1.6, 0)
      ring.rotation.x = Math.PI / 2
      const tail = mesh(new THREE.BoxGeometry(0.16, 0.42, 0.08), wool, 0.18, 1.38, 0.36)
      tail.rotation.z = 0.15
      bodyG.add(ring, tail)
    } else {
      const navy = accM('#364fc7', 0.45)
      bodyG.add(mesh(new THREE.BoxGeometry(0.1, 0.08, 0.06), navy, 0, 1.58, 0.4))
      const blade = mesh(new THREE.BoxGeometry(0.12, 0.4, 0.04), navy, 0, 1.33, 0.43)
      blade.rotation.x = -0.15
      bodyG.add(blade)
      bodyG.add(mesh(new THREE.TorusGeometry(0.22, 0.04, 8, 20), accM('#ffffff', 0.5), 0, 1.6, 0.05))
    }
  }

  /** 손 사이 (머리 위로 번쩍 든 자세 기준 — 앞으로 들면 뒤에서 보는 내 캐릭터 머리에 가려서) */
  const handsAt = new THREE.Vector3(0, 3.1, 0.12)

  let shownMood: Mood | null = null
  function setMood(mood: Mood) {
    if (mood === shownMood) return
    shownMood = mood
    eyes.visible = mood === 'calm' || mood === 'happy'
    scaredEyes.visible = mood === 'scared'
    koEyes.visible = mood === 'ko'
    smile.visible = (mood === 'calm' || mood === 'happy') && kind !== 'rabbit'
    open.visible = mood === 'scared' || mood === 'ko'
    eyes.scale.setScalar(mood === 'happy' ? 1.1 : 1)
  }
  setMood('calm')

  const ease = (cur: number, to: number, k = 0.18) => cur + (to - cur) * k

  function update(t: number, pose: Pose, mood: Mood) {
    setMood(mood)
    // 팔: x로 앞뒤, z로 옆으로
    let ax = 0
    let az = 0.12
    let lean = 0
    let bob = Math.sin(t * 2.2) * 0.025
    let shake = 0
    let sink = 0
    let tilt = 0
    switch (pose) {
      case 'hold':
        // 두 손으로 머리 위에 번쩍
        ax = -0.25
        az = 2.75
        bob = Math.sin(t * 14) * 0.015
        break
      case 'scared':
        ax = -0.6
        az = 0.7
        shake = Math.sin(t * 40) * 0.05
        break
      case 'ko':
        // 옆으로 쓰러짐 (뒤로 넘어지면 내 캐릭터가 카메라 밖으로 나가서)
        tilt = 1.25
        sink = -0.55
        ax = -0.3
        az = 1.6
        bob = 0
        break
      case 'cheer':
        ax = 0
        az = 2.6 + Math.sin(t * 9) * 0.25
        bob = Math.abs(Math.sin(t * 6)) * 0.18
        break
    }
    armL.rotation.x = ease(armL.rotation.x, ax)
    armR.rotation.x = ease(armR.rotation.x, ax)
    armL.rotation.z = ease(armL.rotation.z, -az)
    armR.rotation.z = ease(armR.rotation.z, az)
    bodyG.rotation.x = ease(bodyG.rotation.x, lean, 0.12)
    bodyG.position.y = ease(bodyG.position.y, sink, 0.12) + bob
    bodyG.rotation.z = ease(bodyG.rotation.z, tilt, 0.12) + shake
    head.rotation.z = pose === 'idle' ? Math.sin(t * 1.3 + kind.length) * 0.06 : 0
  }

  function setOut(out: boolean) {
    for (const { m, base } of mats) m.color.copy(out ? base.clone().lerp(GREY, 0.75) : base)
    cheekM.opacity = out ? 0 : 0.55
  }

  function dispose() {
    root.traverse((o) => {
      if (o instanceof THREE.Mesh) o.geometry.dispose()
    })
    for (const { m } of mats) m.dispose()
    extraDispose.forEach((f) => f())
    cheekM.dispose()
  }

  return { root, kind, update, setOut, handsAt, head, dispose }
}
