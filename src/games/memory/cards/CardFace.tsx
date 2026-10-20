import { PAIRS } from '../constants'

// 카드 그림 12가지. 그림 파일 없이 40×40 안에 선으로 그린다. 그림마다 선 색을 달리해 기억하기 쉽게.

type Face = { name: string; color: string; draw: () => React.ReactNode }

const star = (cx: number, cy: number, r: number) =>
  Array.from({ length: 10 }, (_, i) => {
    const a = -Math.PI / 2 + (i * Math.PI) / 5
    const d = i % 2 === 0 ? r : r * 0.45
    return `${i === 0 ? 'M' : 'L'}${(cx + Math.cos(a) * d).toFixed(1)} ${(cy + Math.sin(a) * d).toFixed(1)}`
  }).join('') + 'Z'

const FACES: Face[] = [
  {
    name: '해',
    color: '#ea580c',
    draw: () => (
      <>
        <circle cx={20} cy={20} r={7} />
        {Array.from({ length: 8 }, (_, i) => {
          const a = (i * Math.PI) / 4
          return <path key={i} d={`M${20 + Math.cos(a) * 11} ${20 + Math.sin(a) * 11}L${20 + Math.cos(a) * 16} ${20 + Math.sin(a) * 16}`} />
        })}
      </>
    ),
  },
  { name: '달', color: '#ca8a04', draw: () => <path d="M25 6A14 14 0 1 0 34 28A11 11 0 1 1 25 6Z" /> },
  { name: '별', color: '#d97706', draw: () => <path d={star(20, 21, 15)} /> },
  { name: '하트', color: '#e11d48', draw: () => <path d="M20 33C8 24 5 18 5 13A7.5 7.5 0 0 1 20 11A7.5 7.5 0 0 1 35 13C35 18 32 24 20 33Z" /> },
  { name: '번개', color: '#eab308', draw: () => <path d="M23 4L10 22H19L16 36L30 17H21Z" /> },
  { name: '물방울', color: '#2563eb', draw: () => <path d="M20 5C20 5 9 18 9 25A11 11 0 0 0 31 25C31 18 20 5 20 5Z" /> },
  {
    name: '나무',
    color: '#16a34a',
    draw: () => (
      <>
        <path d="M20 4L8 20H14L6 30H34L26 20H32Z" />
        <path d="M20 30V37" />
      </>
    ),
  },
  {
    name: '집',
    color: '#92400e',
    draw: () => (
      <>
        <path d="M5 19L20 6L35 19" />
        <path d="M9 16V34H31V16" />
        <path d="M17 34V25H23V34" />
      </>
    ),
  },
  {
    name: '물고기',
    color: '#0d9488',
    draw: () => (
      <>
        <path d="M4 20C10 10 24 10 30 20C24 30 10 30 4 20Z" />
        <path d="M30 20L37 13V27Z" />
        <circle cx={11} cy={18} r={1.5} />
      </>
    ),
  },
  {
    name: '야구공',
    color: '#dc2626',
    draw: () => (
      <>
        <circle cx={20} cy={20} r={15} />
        <path d="M11 8C16 14 16 26 11 32" />
        <path d="M29 8C24 14 24 26 29 32" />
      </>
    ),
  },
  {
    name: '과녁',
    color: '#7c3aed',
    draw: () => (
      <>
        <circle cx={20} cy={20} r={15} />
        <circle cx={20} cy={20} r={9.5} />
        <circle cx={20} cy={20} r={4} />
      </>
    ),
  },
  {
    name: '졸라맨',
    color: '#111111',
    draw: () => (
      <>
        <circle cx={20} cy={8} r={5} />
        <path d="M20 13V26M20 17L10 12M20 17L30 12M20 26L12 37M20 26L28 37" />
      </>
    ),
  },
]

if (FACES.length !== PAIRS) throw new Error('카드 그림 수가 쌍 수와 달라요')

export function faceName(face: number): string {
  return FACES[face].name
}

export function CardFace({ face }: { face: number }) {
  const f = FACES[face]
  return (
    <svg className="mm-face" viewBox="0 0 40 40" role="img" aria-label={f.name} style={{ color: f.color }}>
      {f.draw()}
    </svg>
  )
}
