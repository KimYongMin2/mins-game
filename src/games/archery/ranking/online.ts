import { getSupabase } from '../../../shared/online/supabase'
import { createUploadQueue, newRecordId, type UploadStatus } from '../../../shared/online/uploadQueue'
import type { RoundSummary } from '../play/roundState'
import type { ArcheryLeaderRow } from './leaderboard'

// 경기 결과를 서버(Supabase)에 올리고 랭킹 합계를 받아온다.
// 올리기·재전송은 shared/online/uploadQueue가 맡는다.

/** archery_games 한 줄 (player_id·created_at은 서버가 채운다) */
export type ArcheryGameRow = {
  id: string
  nickname: string
  points: number
  x_count: number
  ten_count: number
}

export function toGameRow(summary: RoundSummary, nickname: string, id: string): ArcheryGameRow {
  return {
    id,
    nickname: nickname.trim().slice(0, 10) || '익명',
    points: summary.points,
    x_count: summary.xCount,
    ten_count: summary.tenCount,
  }
}

const queue = createUploadQueue<ArcheryGameRow>('archery_games', 'archery:pending-games')

export const flushPendingGames = queue.flush

export function submitGame(summary: RoundSummary, nickname: string): Promise<Exclude<UploadStatus, 'saving'>> {
  return queue.submit(toGameRow(summary, nickname, newRecordId()))
}

type RpcRow = {
  player_id: string
  nickname: string
  games: number
  avg_points: number | string
  best_points: number | string
  best_x: number
  best_ten: number
  best_at: string
  most_x: number
  most_x_points: number | string
  most_x_at: string
}

/** numeric 열은 설정에 따라 문자열로 올 수 있어 숫자로 맞춘다 */
const num = (v: number | string) => Number(v)

export async function fetchLeaderboard(): Promise<ArcheryLeaderRow[]> {
  const supabase = await getSupabase()
  const { data, error } = await supabase.rpc('archery_leaderboard')
  if (error) throw error
  return ((data ?? []) as RpcRow[]).map((r) => ({
    playerId: r.player_id,
    nickname: r.nickname,
    games: r.games,
    avgPoints: num(r.avg_points),
    best: { points: num(r.best_points), xCount: r.best_x, tenCount: r.best_ten, at: r.best_at },
    mostX: { xCount: r.most_x, points: num(r.most_x_points), at: r.most_x_at },
  }))
}
