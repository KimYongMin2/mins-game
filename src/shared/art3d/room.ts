import * as THREE from 'three'
import { woodTexture } from './stage'

// 둥근 나무 탁자가 있는 방 (나무 마루 + 빨간 깔개 + 탁자). 사람 수에 맞춰 탁자·자리 크기를 정한다.
// 자리 0(나)이 앞(+z, 카메라 쪽), 번호가 커질수록 시계 방향.

export type TableRoom = {
  /** 자리(캐릭터 발) 반지름 */
  seatR: number
  tableR: number
  /** 탁자 윗면 높이 */
  tableY: number
  /** seat번 자리 위치 (바닥) */
  seatPos: (seat: number) => THREE.Vector3
  /** 카메라 자리와 바라볼 곳 (내 등 뒤 위) */
  camera: { pos: THREE.Vector3; look: THREE.Vector3 }
}

export function buildTableRoom(scene: THREE.Scene, count: number): TableRoom {
  const floorTex = woodTexture('#6b4a30', false)
  floorTex.wrapS = floorTex.wrapT = THREE.RepeatWrapping
  floorTex.repeat.set(4, 4)
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(40, 40), new THREE.MeshStandardMaterial({ map: floorTex, roughness: 0.8 }))
  floor.rotation.x = -Math.PI / 2
  floor.receiveShadow = true
  scene.add(floor)

  const seatR = 2.55 + Math.max(0, count - 4) * 0.2
  const tableR = seatR - 0.95
  const tableY = 1.07
  const rug = new THREE.Mesh(new THREE.CircleGeometry(seatR + 1.1, 64), new THREE.MeshStandardMaterial({ color: '#7d2f2a', roughness: 1 }))
  rug.rotation.x = -Math.PI / 2
  rug.position.y = 0.01
  rug.receiveShadow = true
  scene.add(rug)
  const rugEdge = new THREE.Mesh(new THREE.RingGeometry(seatR + 0.85, seatR + 0.98, 64), new THREE.MeshStandardMaterial({ color: '#e0b25a', roughness: 1 }))
  rugEdge.rotation.x = -Math.PI / 2
  rugEdge.position.y = 0.015
  scene.add(rugEdge)

  const top = new THREE.Mesh(new THREE.CylinderGeometry(tableR, tableR, 0.14, 72), [
    new THREE.MeshStandardMaterial({ color: '#5b3216', roughness: 0.6 }),
    new THREE.MeshStandardMaterial({ map: woodTexture('#a8642e'), roughness: 0.38 }),
    new THREE.MeshStandardMaterial({ color: '#3d200c', roughness: 0.7 }),
  ])
  top.position.y = 1.0
  top.castShadow = true
  top.receiveShadow = true
  scene.add(top)
  const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.42, 0.95, 24), new THREE.MeshStandardMaterial({ color: '#4a2a12', roughness: 0.55 }))
  leg.position.y = 0.48
  leg.castShadow = true
  scene.add(leg)
  const foot = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.8, 0.08, 32), new THREE.MeshStandardMaterial({ color: '#3d200c', roughness: 0.6 }))
  foot.position.y = 0.05
  scene.add(foot)

  const seatPos = (seat: number) => {
    const a = Math.PI / 2 + (seat / count) * Math.PI * 2
    return new THREE.Vector3(Math.cos(a) * seatR, 0, Math.sin(a) * seatR)
  }
  return {
    seatR,
    tableR,
    tableY,
    seatPos,
    camera: { pos: new THREE.Vector3(0, 8.2 + count * 0.35, seatR + 4.6 + count * 0.3), look: new THREE.Vector3(0, 0.6, -0.5) },
  }
}

/** 발밑 고리 (누를 수 있는 사람·겨눠진 사람 표시) */
export function footRing(color: string): THREE.Mesh {
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.75, 0.05, 8, 40), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.9 }))
  ring.rotation.x = Math.PI / 2
  ring.visible = false
  return ring
}

/** 불꽃·폭발용 둥근 빛 텍스처 */
export function glowTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas')
  c.width = c.height = 128
  const g = c.getContext('2d')!
  const r = g.createRadialGradient(64, 64, 0, 64, 64, 64)
  r.addColorStop(0, 'rgba(255,255,235,1)')
  r.addColorStop(0.25, 'rgba(255,200,80,0.9)')
  r.addColorStop(0.6, 'rgba(255,110,20,0.35)')
  r.addColorStop(1, 'rgba(255,60,0,0)')
  g.fillStyle = r
  g.fillRect(0, 0, 128, 128)
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  return t
}
