// 메인 화면에 보여줄 게임 목록. 게임 코드를 import하지 않고 메타데이터만 둔다.
export type GameEntry = {
  id: string
  title: string
  /** 메인 카드 한 줄 설명 (두 칸 타일이라 짧게) */
  description: string
  path: string
  ready: boolean
  /** pvp = 친구 대전과 봇 대전 / solo = 혼자 하는 기록 도전 (메인 화면에서 나눠 보여줌) */
  play: 'pvp' | 'solo'
  /** 몇 명이 하는지 (메인 카드에 표시) */
  players: string
}

export const GAMES: GameEntry[] = [
  {
    id: 'zolaball',
    title: '야구',
    description: '타이밍 맞춰 스윙, 홈런을 노려라',
    path: '/games/zolaball',
    ready: true,
    play: 'pvp',
    players: '2인',
  },
  {
    id: 'fight',
    title: '격투',
    description: '2초마다 준비·방어·타격 수 싸움',
    path: '/games/fight',
    ready: true,
    play: 'pvp',
    players: '2인',
  },
  {
    id: 'memory',
    title: '짝맞추기',
    description: '번갈아 뒤집어 짝을 더 많이',
    path: '/games/memory',
    ready: true,
    play: 'pvp',
    players: '2인',
  },
  {
    id: 'armwrestle',
    title: '팔씨름',
    description: '연타·타이밍으로 3판 2선승',
    path: '/games/armwrestle',
    ready: true,
    play: 'pvp',
    players: '2인',
  },
  {
    id: 'bomb',
    title: '폭탄 돌리기',
    description: '터지기 전에 옆 사람에게!',
    path: '/games/bomb',
    ready: true,
    play: 'pvp',
    players: '2~6인',
  },
  {
    id: 'nunchi',
    title: '눈치게임',
    description: '겹치거나 마지막이면 탈락',
    path: '/games/nunchi',
    ready: true,
    play: 'pvp',
    players: '3~6인',
  },
  {
    id: 'yut',
    title: '윷놀이',
    description: '윷·모면 한 번 더, 업고 잡기',
    path: '/games/yut',
    ready: true,
    play: 'pvp',
    players: '2~4인',
  },
  {
    id: 'numbaseball',
    title: '숫자야구',
    description: '스트라이크·볼로 숫자 추리',
    path: '/games/numbaseball',
    ready: true,
    play: 'pvp',
    players: '2인',
  },
  {
    id: 'omok',
    title: '오목',
    description: '렌주룰, 다섯 개 먼저 잇기',
    path: '/games/omok',
    ready: true,
    play: 'pvp',
    players: '2인',
  },
  {
    id: 'alkkagi',
    title: '알까기',
    description: '돌을 튕겨 상대 돌을 판 밖으로!',
    path: '/games/alkkagi',
    ready: true,
    play: 'pvp',
    players: '2인',
  },
  {
    id: 'batting',
    title: '배팅',
    description: '공 10개 비거리 도전',
    path: '/games/batting',
    ready: true,
    play: 'solo',
    players: '1인',
  },
  {
    id: 'archery',
    title: '양궁',
    description: '바람 읽고 X를 노려라',
    path: '/games/archery',
    ready: true,
    play: 'solo',
    players: '1인',
  },
]
