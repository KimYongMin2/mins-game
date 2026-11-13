import * as THREE from 'three'
import { type AnimalKind, type Fur, type Look, TINT_HEX } from './animalKinds'

// 3D 동물 캐릭터 (three.js 기본 도형으로 만듦, 그림 파일 없음). 큰 머리 + 작은 몸의 귀여운 비율.
// 몸통은 셔츠 색(팀전이면 팀 색), 얼굴은 동물마다 다르다. 표정(mood)과 자세(pose)를 바꿀 수 있다.
// 단위: 키 약 2.6 (발 = y 0). 얼굴은 +z 쪽.

export { ANIMALS, ANIMAL_NAMES, type AnimalKind, type Look, plainLook } from './animalKinds'

export type Mood = 'calm' | 'happy' | 'scared' | 'ko'
/** idle 가만히 · hold 두 손으로 머리 위에 듦 · scared 덜덜 · ko 쓰러짐 · cheer 만세 · raise 한 손 번쩍(외치기) */
export type Pose = 'idle' | 'hold' | 'scared' | 'ko' | 'cheer' | 'raise' | 'aim'

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
  /** 몸 전체(다리 위)·팔 — 게임이 직접 움직일 때 (야구 스윙·투구). update 뒤에 바꾸면 그 프레임엔 그 값 */
  body: THREE.Group
  armL: THREE.Group
  armR: THREE.Group
  dispose: () => void
}

/** 털 색 바꾸기: 연하게(흰색 쪽) · 진하게(검은색 쪽) */
function shade(color: string, fur: Fur): string {
  if (fur === 'base') return color
  return '#' + new THREE.Color(color).lerp(new THREE.Color(fur === 'light' ? '#ffffff' : '#000000'), fur === 'light' ? 0.4 : 0.35).getHexString()
}

/** 털·천 결 (작은 잡음 무늬를 bump로) — 모든 캐릭터가 같이 씀 */
let grainTex: THREE.CanvasTexture | null = null
function grain(): THREE.CanvasTexture {
  if (grainTex) return grainTex
  const c = document.createElement('canvas')
  c.width = c.height = 128
  const g = c.getContext('2d')!
  const img = g.createImageData(128, 128)
  let seed = 11
  for (let i = 0; i < img.data.length; i += 4) {
    seed = (seed * 16807) % 2147483647
    const v = 110 + (seed % 90)
    img.data[i] = img.data[i + 1] = img.data[i + 2] = v
    img.data[i + 3] = 255
  }
  g.putImageData(img, 0, 0)
  grainTex = new THREE.CanvasTexture(c)
  grainTex.wrapS = grainTex.wrapT = THREE.RepeatWrapping
  grainTex.repeat.set(3, 3)
  return grainTex
}

/** 눈동자 색 */
const IRIS: Partial<Record<AnimalKind, string>> = { cat: '#7cb342', fox: '#b8860b', wolf: '#4fa3d1', tiger: '#c98a1a', lion: '#a0661e', eagle: '#e0a419', frog: '#c9a227', dino: '#d08a1e' }

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
  const mat = (color: string, rough = 0.75, metal = 0, bump = 0) => {
    const m = new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: metal, ...(bump ? { bumpMap: grain(), bumpScale: bump } : {}) })
    mats.push({ m, base: m.color.clone() })
    return m
  }
  // 털은 결이 보이게 (새·개구리·공룡은 매끈하게)
  const furry = !['frog', 'dino', 'penguin'].includes(kind)
  const furM = mat(look.fur, 0.85, 0, furry ? 0.035 : 0.008)
  const lightM = mat(look.light, 0.85, 0, furry ? 0.03 : 0.006)
  const earM = mat(look.ear, 0.8)
  const noseM = mat(look.nose, 0.35)
  // 야구 유니폼: 흰 바탕(팀전이면 팀 색) + 내 색 소매·깃·단추줄·등번호
  const uniform = lookIn.outfit === 'uniform'
  const tint = TINT_HEX[lookIn.tint]
  const shirtM = mat(uniform ? (opts.team ? shirt : '#f4f4f1') : shirt, 0.6, 0, 0.012)
  const sleeveM = uniform ? mat(tint, 0.55, 0, 0.012) : shirtM
  const pantsM = mat(uniform ? (opts.team ? '#f4f4f1' : '#e9e9e4') : '#34405a', 0.7, 0, 0.012)
  const shoeM = mat('#f8f9fa', 0.45)
  const soleM = mat(uniform ? tint : '#e8590c', 0.5)
  const padM = mat(kind === 'panda' || kind === 'penguin' ? '#3a3f45' : '#f3a5b5', 0.6)
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

  // 반바지 + 다리 + 운동화 (게임에선 탁자에 가려지지만 쓰러지거나 미리 보기에서 보임)
  const shorts = mesh(new THREE.CylinderGeometry(0.43, 0.41, 0.26, 24), pantsM, 0, 0.66, 0)
  bodyG.add(shorts)
  for (const s of [-1, 1]) {
    // 새는 부리 색 다리
    const legM = kind === 'eagle' || kind === 'seagull' || kind === 'penguin' ? noseM : furM
    bodyG.add(mesh(new THREE.CapsuleGeometry(0.13, 0.22, 6, 12), legM, s * 0.19, 0.34, 0))
    const shoe = mesh(new THREE.SphereGeometry(0.17, 16, 12), shoeM, s * 0.19, 0.1, 0.06)
    shoe.scale.set(0.95, 0.55, 1.35)
    const sole = mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.04, 16), soleM, s * 0.19, 0.03, 0.06)
    sole.scale.set(1, 1, 1.35)
    const lace = mesh(new THREE.BoxGeometry(0.12, 0.02, 0.06), soleM, s * 0.19, 0.17, 0.16)
    bodyG.add(shoe, sole, lace)
  }

  // 꼬리 (동물마다)
  const tail = new THREE.Group()
  tail.position.set(0, 0.78, -0.4)
  bodyG.add(tail)
  const chain = (n: number, r: number, bend: number, m: (k: number) => THREE.Material) => {
    let y = 0
    let z = 0
    for (let k = 0; k < n; k++) {
      const a = (k / n) * bend
      y += Math.sin(a) * r * 1.3
      z -= Math.cos(a) * r * 1.1
      tail.add(mesh(new THREE.SphereGeometry(r * (1 - k * 0.04), 12, 10), m(k), 0, y, z))
    }
  }
  switch (kind) {
    case 'bear':
    case 'panda':
      tail.add(mesh(new THREE.SphereGeometry(0.1, 12, 10), kind === 'panda' ? earM : furM))
      break
    case 'rabbit':
      tail.add(mesh(new THREE.SphereGeometry(0.14, 14, 12), lightM))
      break
    case 'cat':
      chain(8, 0.06, 2.2, () => furM)
      break
    case 'tiger':
      chain(8, 0.065, 2.0, (k) => (k % 2 ? earM : furM))
      break
    case 'lion':
      chain(7, 0.045, 1.6, () => furM)
      tail.add(mesh(new THREE.SphereGeometry(0.09, 12, 10), earM, 0, 0.3, -0.4))
      break
    case 'elephant':
      chain(5, 0.04, 0.4, () => furM)
      break
    case 'fox':
    case 'wolf': {
      const bush = mesh(new THREE.SphereGeometry(0.17, 16, 12), furM, 0, 0.16, -0.22)
      bush.scale.set(0.85, 0.85, 1.9)
      bush.rotation.x = -0.6
      tail.add(bush)
      const tip = mesh(new THREE.SphereGeometry(0.11, 12, 10), kind === 'fox' ? lightM : earM, 0, 0.36, -0.48)
      tail.add(tip)
      break
    }
    case 'dog': {
      const t = mesh(new THREE.CapsuleGeometry(0.06, 0.26, 6, 10), furM, 0, 0.14, -0.08)
      t.rotation.x = -0.7
      tail.add(t)
      break
    }
    case 'pig': {
      const curl = mesh(new THREE.TorusGeometry(0.07, 0.025, 8, 16, Math.PI * 1.6), furM, 0, 0.04, -0.04)
      curl.rotation.y = Math.PI / 2
      tail.add(curl)
      break
    }
    case 'dino': {
      const t = mesh(new THREE.ConeGeometry(0.26, 0.9, 16), furM, 0, -0.32, -0.42)
      t.rotation.x = -Math.PI / 2 - 0.45
      tail.add(t)
      for (let k = 0; k < 3; k++) {
        const sp = mesh(new THREE.ConeGeometry(0.06, 0.14, 8), earM, 0, -0.08 - k * 0.12, -0.2 - k * 0.22)
        sp.rotation.x = -0.6
        tail.add(sp)
      }
      break
    }
    case 'eagle':
    case 'seagull':
    case 'penguin':
      for (const a of [-0.45, 0, 0.45]) {
        const f = mesh(new THREE.SphereGeometry(0.12, 12, 10), kind === 'eagle' ? earM : kind === 'seagull' ? lightM : furM, Math.sin(a) * 0.12, -0.05, -0.12)
        f.scale.set(0.5, 0.25, 1.3)
        f.rotation.y = a
        tail.add(f)
      }
      break
  }

  // 팔: 어깨에서 늘어진 팔 + 손 (손은 털 색)
  const arm = (side: 1 | -1) => {
    const pivot = new THREE.Group()
    pivot.position.set(side * 0.46, 1.48, 0)
    const sleeve = mesh(new THREE.CapsuleGeometry(0.12, 0.32, 6, 12), sleeveM, 0, -0.24, 0)
    const hand = mesh(new THREE.SphereGeometry(0.13, 16, 12), furM, 0, -0.5, 0)
    // 손바닥 젤리 (새는 없음)
    const birds = kind === 'eagle' || kind === 'seagull' || kind === 'penguin'
    if (!birds && kind !== 'frog') {
      const pad = mesh(new THREE.SphereGeometry(0.055, 10, 8), padM, 0, -0.56, 0.09)
      pad.scale.set(1, 0.8, 0.5)
      pivot.add(pad)
    }
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
    const iris = IRIS[kind]
    const e = mesh(new THREE.SphereGeometry(0.075, 18, 14), iris ? mat(iris, 0.2) : eyeM, s * eyeX, eyeY, eyeZ)
    const dot = mesh(new THREE.SphereGeometry(0.05, 14, 10), eyeM, s * eyeX, eyeY - 0.005, eyeZ + 0.032)
    dot.scale.set(kind === 'cat' || kind === 'tiger' ? 0.55 : 1, 1, 0.6)
    const shine = mesh(new THREE.SphereGeometry(0.024, 8, 6), whiteM, s * eyeX + 0.028, eyeY + 0.032, eyeZ + 0.06)
    const shine2 = mesh(new THREE.SphereGeometry(0.011, 6, 4), whiteM, s * eyeX - 0.022, eyeY - 0.025, eyeZ + 0.062)
    for (const o of [shine, shine2, dot]) o.castShadow = false
    eyes.add(e, dot, shine, shine2)
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
  // 눈썹 (새·개구리 빼고 — 독수리는 따로 매서운 눈썹). 겁먹으면 올라가고 가운데가 들림
  const brows = new THREE.Group()
  const browL: THREE.Mesh[] = []
  if (!['eagle', 'seagull', 'penguin', 'frog'].includes(kind)) {
    const browM = mat(new THREE.Color(look.fur).multiplyScalar(0.45).getStyle(), 0.8)
    for (const s of [-1, 1]) {
      const b = mesh(new THREE.CapsuleGeometry(0.018, 0.08, 4, 8), browM, s * eyeX, eyeY + 0.13, eyeZ - 0.01)
      b.rotation.z = Math.PI / 2
      b.userData.side = s
      b.castShadow = false
      brows.add(b)
      browL.push(b)
    }
  }
  head.add(brows)

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
    // 토끼·새·코끼리는 웃는 입을 안 그림 (이·부리·코가 대신)
    smile.visible = (mood === 'calm' || mood === 'happy') && !['rabbit', 'eagle', 'seagull', 'penguin', 'elephant'].includes(kind)
    open.visible = mood === 'scared' || mood === 'ko'
    eyes.scale.setScalar(mood === 'happy' ? 1.1 : 1)
    brows.visible = mood !== 'ko'
    for (const b of browL) {
      const side = b.userData.side as number
      b.position.y = eyeY + (mood === 'scared' ? 0.18 : 0.13)
      b.rotation.z = Math.PI / 2 + (mood === 'scared' ? side * -0.4 : mood === 'happy' ? side * 0.15 : 0)
    }
  }
  setMood('calm')

  const ease = (cur: number, to: number, k = 0.18) => cur + (to - cur) * k
  let sunk = 0
  let tilted = 0
  // 살아 있는 느낌 (2026-11-13 '더 사실적이고 역동적이게'): 눈 깜빡임 · 숨쉬기 · 두리번 · 신나면 쭉 늘었다 찌그러짐.
  // 캐릭터마다 박자가 달라 여럿이 서 있어도 똑같이 움직이지 않음
  const seed = Math.random() * 10
  let looked = 0 // 지난 프레임에 더한 두리번 각도 (게임이 정해 둔 고개 방향은 그대로 두려고 더했다 뺌)

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
      case 'aim':
        // 오른손(armL — 캐릭터 기준 오른쪽, 얼굴이 +z라 -x 쪽)으로 총을 앞으로 겨누고 왼손은 안쪽으로 받침 (아래에서 따로)
        bob = 0
        break
      case 'cheer':
        ax = 0
        az = 2.6 + Math.sin(t * 9) * 0.25
        bob = Math.abs(Math.sin(t * 6)) * 0.18
        break
    }
    // 가만히 서 있을 땐 팔도 살짝 흔들림
    if (pose === 'idle') ax += Math.sin(t * 2.2 + seed) * 0.06
    if (pose === 'scared') sink = -0.06
    // 한 손 번쩍: 오른손만 위로
    const raise = pose === 'raise'
    if (raise) bob = Math.abs(Math.sin(t * 5)) * 0.06
    const aim = pose === 'aim'
    armL.rotation.x = ease(armL.rotation.x, aim ? -1.5 : ax)
    armR.rotation.x = ease(armR.rotation.x, raise ? -0.2 : aim ? -1.3 : ax)
    armL.rotation.z = ease(armL.rotation.z, aim ? 0.3 : -az)
    armR.rotation.z = ease(armR.rotation.z, raise ? 2.85 : aim ? -0.85 : az)
    bodyG.rotation.x = ease(bodyG.rotation.x, lean, 0.12)
    // 가라앉기·기울기는 따로 부드럽게 따라가고, 살랑임·떨림은 그 위에 더한다 (같이 섞으면 매 프레임 쌓여서 8배쯤 커졌음)
    sunk = ease(sunk, sink, 0.12)
    tilted = ease(tilted, tilt, 0.12)
    bodyG.position.y = sunk + bob
    bodyG.rotation.z = tilted + shake
    head.rotation.z = pose === 'idle' ? Math.sin(t * 1.3 + kind.length) * 0.06 : 0
    // 두리번 (가만히 있을 때만)
    head.rotation.y -= looked
    looked = pose === 'idle' ? Math.sin(t * 0.45 + seed) * 0.16 + Math.sin(t * 1.7 + seed * 2) * 0.03 : ease(looked, 0, 0.2)
    head.rotation.y += looked
    // 숨쉬기 + 신날 때 늘었다 찌그러짐
    const breathe = pose === 'ko' ? 0 : Math.sin(t * 2.1 + seed) * 0.014
    const squash = pose === 'cheer' ? 0.93 + bob * 0.55 : 1
    bodyG.scale.set(1 - breathe * 0.5 - (squash - 1) * 0.4, (1 + breathe) * squash, 1 - breathe * 0.5 - (squash - 1) * 0.4)
    // 눈 깜빡임 (4초쯤마다 0.12초)
    const blink = (t + seed) % 4.2 < 0.12 ? 0.12 : 1
    eyes.scale.y = (shownMood === 'happy' ? 1.1 : 1) * blink
    // 꼬리: 신나면 빨리, 평소엔 천천히 흔들기, 쓰러지면 축
    const wag = pose === 'ko' ? 0 : mood === 'happy' ? Math.sin(t * 12) * 0.5 : mood === 'scared' ? Math.sin(t * 30) * 0.12 : Math.sin(t * 2.4) * 0.18
    tail.rotation.y = wag
    tail.rotation.x = pose === 'ko' ? 0.5 : mood === 'scared' ? 0.35 : 0
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

  return { root, kind, update, setOut, handsAt, head, body: bodyG, armL, armR, dispose }
}
