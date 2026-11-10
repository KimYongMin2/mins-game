// 내 정보 창 '내 전적' (사용자 요청): 게임마다 기기에 저장된 기록을 읽어 한 줄로 요약한다.
// pages는 게임 페이지를 불러오는 곳(App.tsx)이라 각 게임의 records를 읽어도 된다(게임끼리·shared→games만 금지).
import { loadRecord as archery } from '../games/archery/records'
import { loadRecord as armwrestle } from '../games/armwrestle/records'
import { loadRecord as artillery } from '../games/artillery/records'
import { loadRecord as batting } from '../games/batting/records'
import { loadRecord as bomb } from '../games/bomb/records'
import { loadRecord as fight } from '../games/fight/records'
import { loadRecord as memory } from '../games/memory/records'
import { loadRecord as numbaseball } from '../games/numbaseball/records'
import { loadRecord as nunchi } from '../games/nunchi/records'
import { loadRecord as omok } from '../games/omok/records'
import { loadRecord as roulette } from '../games/roulette/records'
import { loadRecord as survival } from '../games/survival/records'
import { loadRecord as tiles } from '../games/tiles/records'
import { loadRecord as volley } from '../games/volley/records'
import { loadRecord as yut } from '../games/yut/records'
import { loadRecord as zolaball } from '../games/zolaball/records'

type WLD = { wins: number; losses: number; draws?: number }
type Tally = { games: number; wins: number }
export type GameStat = { id: string; played: number; bot: string | null; pvp: string | null }

const add = (...xs: WLD[]): Required<WLD> => xs.reduce<Required<WLD>>((a, x) => ({ wins: a.wins + x.wins, losses: a.losses + x.losses, draws: a.draws + (x.draws ?? 0) }), { wins: 0, losses: 0, draws: 0 })
const n = (x: WLD) => x.wins + x.losses + (x.draws ?? 0)
const wld = (x: WLD) => (n(x) === 0 ? null : `${x.wins}승 ${x.losses}패${x.draws ? ` ${x.draws}무` : ''}`)
const sumTally = (...xs: Tally[]): Tally => xs.reduce((a, x) => ({ games: a.games + x.games, wins: a.wins + x.wins }), { games: 0, wins: 0 })
const tally = (t: Tally) => (t.games === 0 ? null : `${t.games}판 · 우승 ${t.wins}번`)

function duel(id: string, bot: WLD, pvp: WLD): GameStat {
  return { id, played: n(bot) + n(pvp), bot: wld(bot), pvp: wld(pvp) }
}
function group(id: string, bot: Tally, pvp: Tally): GameStat {
  return { id, played: bot.games + pvp.games, bot: tally(bot), pvp: tally(pvp) }
}

/** 게임마다 요약 (읽기에 실패한 게임은 0판으로) */
export function loadStats(): GameStat[] {
  const safe = (id: string, f: () => GameStat): GameStat => {
    try {
      return f()
    } catch {
      return { id, played: 0, bot: null, pvp: null }
    }
  }
  return [
    safe('zolaball', () => {
      const r = zolaball()
      return duel('zolaball', add(r.normal, r.hard), r.pvp)
    }),
    safe('volley', () => {
      const r = volley()
      return duel('volley', add(r.bot.normal, r.bot.hard), r.pvp)
    }),
    safe('fight', () => {
      const r = fight()
      return duel('fight', add(r.normal, r.hard), r.pvp)
    }),
    safe('memory', () => {
      const r = memory()
      return duel('memory', add(r.normal, r.hard), r.pvp)
    }),
    safe('armwrestle', () => {
      const r = armwrestle()
      return duel('armwrestle', add(r.mash.normal, r.mash.hard, r.timing.normal, r.timing.hard), r.pvp)
    }),
    safe('bomb', () => {
      const r = bomb()
      return group('bomb', r.bot, r.pvp)
    }),
    safe('nunchi', () => {
      const r = nunchi()
      return group('nunchi', r.bot, r.pvp)
    }),
    safe('survival', () => {
      const r = survival()
      return group('survival', r.bot, r.pvp)
    }),
    safe('roulette', () => {
      const r = roulette()
      return group('roulette', r.bot, r.pvp)
    }),
    safe('artillery', () => {
      const r = artillery()
      return group('artillery', sumTally(r.bot.normal, r.bot.hard), r.pvp)
    }),
    safe('yut', () => {
      const r = yut()
      return group('yut', r.bot, r.pvp)
    }),
    safe('tiles', () => {
      const r = tiles()
      return group('tiles', r.bot, r.pvp)
    }),
    safe('numbaseball', () => {
      const r = numbaseball()
      return duel('numbaseball', add(r.normal, r.hard), r.pvp)
    }),
    safe('omok', () => {
      const r = omok()
      return duel('omok', add(r.normal, r.hard), r.pvp)
    }),
    safe('batting', () => {
      const r = batting()
      const games = r.normal.games + r.hard.games
      const best = Math.max(r.normal.best?.points ?? 0, r.hard.best?.points ?? 0)
      return { id: 'batting', played: games, bot: games ? `${games}판 · 최고 ${Math.round(best)}점` : null, pvp: null }
    }),
    safe('archery', () => {
      const r = archery()
      return { id: 'archery', played: r.games, bot: r.games ? `${r.games}판 · 최고 ${(r.best?.points ?? 0).toFixed(1)}점` : null, pvp: null }
    }),
  ]
}
