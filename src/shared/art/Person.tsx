import { PERSON_SHIRTS, TOON_OUTLINE, TOON_SKIN } from './shapes'

// 앞에서 본 만화풍 사람 (탁자에 둘러앉은 게임들이 같이 씀). 상반신만, viewBox 0 0 60 70.
// 굵은 외곽선, 셔츠 색·머리 모양은 자리마다 다르게, 자세·표정으로 상황을 보여준다.

export type PersonPose = 'idle' | 'raise' | 'cheer' | 'hold' | 'scared'
export type PersonMood = 'calm' | 'happy' | 'scared' | 'ko'

type Props = {
  /** 셔츠 색 번호 (PERSON_SHIRTS) — 보통 자리 번호 */
  shirt: number
  pose?: PersonPose
  mood?: PersonMood
  /** 탈락: 회색으로 */
  out?: boolean
  className?: string
}

const O = 1.6
const HAIR = ['#1f2937', '#78350f', '#111827', '#a16207', '#4b5563', '#7c2d12']

function Limb({ d, w, color }: { d: string; w: number; color: string }) {
  return (
    <>
      <path d={d} fill="none" stroke={TOON_OUTLINE} strokeWidth={w + O * 2} strokeLinecap="round" strokeLinejoin="round" />
      <path d={d} fill="none" stroke={color} strokeWidth={w} strokeLinecap="round" strokeLinejoin="round" />
    </>
  )
}

/** 팔: [어깨 → 팔꿈치 → 손] 왼팔·오른팔 */
const ARMS: Record<PersonPose, [string, string]> = {
  idle: ['M16 50 L13 58 L15 67', 'M44 50 L47 58 L45 67'],
  raise: ['M16 50 L13 58 L15 67', 'M44 50 L52 38 L53 22'],
  cheer: ['M16 50 L8 38 L7 22', 'M44 50 L52 38 L53 22'],
  hold: ['M16 50 L16 60 L25 62', 'M44 50 L44 60 L35 62'],
  scared: ['M16 50 L12 42 L18 32', 'M44 50 L48 42 L42 32'],
}

function handOf(path: string): [number, number] {
  const nums = path.match(/-?\d+(\.\d+)?/g)!.map(Number)
  return [nums[nums.length - 2], nums[nums.length - 1]]
}

/** 머리 모양 세 가지 (자리마다 돌아가며) */
function Hair({ kind, color }: { kind: number; color: string }) {
  switch (kind % 3) {
    case 0: // 뾰족
      return <path d="M15 24 L17 12 L22 16 L26 8 L31 14 L36 8 L39 15 L44 12 L45 24 Q30 16 15 24Z" fill={color} stroke={TOON_OUTLINE} strokeWidth={1} strokeLinejoin="round" />
    case 1: // 단발
      return <path d="M15 30 Q13 10 30 10 Q47 10 45 30 L42 30 Q41 20 30 19 Q19 20 18 30Z" fill={color} stroke={TOON_OUTLINE} strokeWidth={1} />
    default: // 가르마 + 앞머리
      return <path d="M16 23 Q16 11 30 11 Q44 11 44 23 Q36 15 27 21 Q22 17 16 23Z" fill={color} stroke={TOON_OUTLINE} strokeWidth={1} />
  }
}

function Face({ mood }: { mood: PersonMood }) {
  const ink = TOON_OUTLINE
  switch (mood) {
    case 'happy':
      return (
        <g fill="none" stroke={ink} strokeWidth={1.6} strokeLinecap="round">
          <path d="M22 26 q3 -3 6 0 M32 26 q3 -3 6 0" />
          <path d="M24 32 q6 6 12 0" />
        </g>
      )
    case 'scared':
      return (
        <g>
          <circle cx={25} cy={26} r={2.6} fill="#fff" stroke={ink} strokeWidth={1.2} />
          <circle cx={35} cy={26} r={2.6} fill="#fff" stroke={ink} strokeWidth={1.2} />
          <circle cx={25} cy={26} r={1} fill={ink} />
          <circle cx={35} cy={26} r={1} fill={ink} />
          <ellipse cx={30} cy={34} rx={2.2} ry={2.8} fill={ink} />
          {/* 식은땀 */}
          <path d="M44 20 q2 4 0 6 q-2 -2 0 -6Z" fill="#7dd3fc" stroke="#0369a1" strokeWidth={0.6} />
        </g>
      )
    case 'ko':
      return (
        <g fill="none" stroke={ink} strokeWidth={1.6} strokeLinecap="round">
          <path d="M22 24 l5 5 m0 -5 l-5 5 M33 24 l5 5 m0 -5 l-5 5" />
          <path d="M25 34 q2.5 -2 5 0 q2.5 2 5 0" />
        </g>
      )
    default:
      return (
        <g>
          <circle cx={25} cy={27} r={1.6} fill={ink} />
          <circle cx={35} cy={27} r={1.6} fill={ink} />
          <path d="M26 33 q4 2 8 0" fill="none" stroke={ink} strokeWidth={1.5} strokeLinecap="round" />
        </g>
      )
  }
}

export function Person({ shirt, pose = 'idle', mood = 'calm', out = false, className }: Props) {
  const color = out ? '#9ca3af' : PERSON_SHIRTS[shirt % PERSON_SHIRTS.length]
  const skin = out ? '#d1d5db' : TOON_SKIN
  const hair = out ? '#6b7280' : HAIR[shirt % HAIR.length]
  const [left, right] = ARMS[pose]
  const front = pose === 'hold' || pose === 'scared'
  const arms = (
    <>
      <Limb d={left} w={6} color={skin} />
      <Limb d={right} w={6} color={skin} />
      {[handOf(left), handOf(right)].map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r={3.6} fill={skin} stroke={TOON_OUTLINE} strokeWidth={O} />
      ))}
    </>
  )
  return (
    <svg className={className} viewBox="0 0 60 70" aria-hidden>
      {/* 몸이 앞에 있어야 하는 자세가 아니면 팔을 몸 뒤에 */}
      {!front && pose !== 'idle' && arms}
      <path d="M12 70 V54 Q12 42 30 42 Q48 42 48 54 V70 Z" fill={color} stroke={TOON_OUTLINE} strokeWidth={O * 2} strokeLinejoin="round" />
      {/* 목 */}
      <path d="M26 38 V44 M34 38 V44" stroke={TOON_OUTLINE} strokeWidth={1} />
      <rect x={26} y={36} width={8} height={8} fill={skin} />
      <circle cx={30} cy={26} r={14} fill={skin} stroke={TOON_OUTLINE} strokeWidth={O * 2} />
      <Hair kind={shirt} color={hair} />
      <Face mood={mood} />
      {(front || pose === 'idle') && arms}
    </svg>
  )
}
