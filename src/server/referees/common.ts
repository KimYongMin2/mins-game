import { type Look, decodeLook, encodeLook } from '../../shared/art3d/animalKinds'
import type { Team } from '../../shared/team/teams'
import type { RefereeContext } from '../hub'

// 서버 심판 공용: 방장이 보낸 준비물(사람·봇·팀) 검사. 사람 자리는 지금 방에 있는 접속 번호여야 한다.

export type SetupPlayer = { id: string; name: string; kind: 'remote' | 'bot'; avatar?: Look }

// eslint-disable-next-line no-control-regex -- 보이지 않는 제어 문자 지우기
const clean = (v: unknown, max: number) => (typeof v === 'string' ? [...v.replace(/[\u0000-\u001f\u007f]/g, '')].slice(0, max).join('').trim() : '')

function readLook(x: unknown): Look | undefined {
  if (!x || typeof x !== 'object') return undefined
  try {
    return decodeLook(encodeLook(x as Look))
  } catch {
    return undefined
  }
}

/** 사람은 방에 있는 사람만 한 번씩, 봇은 'bot0'~'bot15'. 사람 이름은 서버가 아는 닉네임으로 */
export function readPlayers(x: unknown, ctx: RefereeContext, min: number, max: number): SetupPlayer[] | null {
  if (!Array.isArray(x) || x.length < min || x.length > max) return null
  const members = new Map(ctx.members().map((m) => [m.id, m]))
  const seen = new Set<string>()
  const out: SetupPlayer[] = []
  for (const p of x as Record<string, unknown>[]) {
    if (!p || typeof p !== 'object' || typeof p.id !== 'string' || seen.has(p.id)) return null
    seen.add(p.id)
    const avatar = readLook(p.avatar)
    const member = members.get(p.id)
    if (member) out.push({ id: p.id, name: member.nickname, kind: 'remote', avatar })
    else if (/^bot\d{1,2}$/.test(p.id)) out.push({ id: p.id, name: clean(p.name, 20) || '봇', kind: 'bot', avatar })
    else return null
  }
  // 방장은 꼭 있어야
  if (!out.some((p) => members.get(p.id)?.role === 'host')) return null
  return out
}

/** 팀: 없으면 null(개인전), 모양이 틀리면 undefined */
export function readTeams(x: unknown, n: number): Team[] | null | undefined {
  if (x === null || x === undefined) return null
  if (!Array.isArray(x) || x.length !== n || !x.every((t) => t === 0 || t === 1)) return undefined
  return x as Team[]
}

export const serverSeed = () => crypto.getRandomValues(new Uint32Array(1))[0]
