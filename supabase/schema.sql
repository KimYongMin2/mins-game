-- 졸라볼 온라인 랭킹 스키마
-- Supabase 대시보드 → SQL Editor에 통째로 붙여넣고 Run. 여러 번 실행해도 안전하다.
--
-- 구조
-- - zolaball_games: 경기 한 판의 결과 한 줄. 본인 기록만 쓰고 읽을 수 있다 (익명 로그인 ID 기준).
-- - zolaball_leaderboard(난이도): 선수별 합계. 원본 대신 이 합계만 모두에게 공개한다.

create table if not exists public.zolaball_games (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  nickname text not null check (char_length(btrim(nickname)) between 1 and 10),
  difficulty text not null check (difficulty in ('normal', 'hard')),
  outcome text not null check (outcome in ('win', 'lose', 'draw')),
  -- 3이닝 경기에서 나올 수 없는 값은 거부한다 (기록 조작 방지용 최소한의 검사)
  at_bats int not null check (at_bats between 0 and 60),
  hits int not null check (hits between 0 and at_bats),
  homeruns int not null check (homeruns between 0 and hits),
  rbi int not null check (rbi between 0 and 100),
  outs_pitched int not null check (outs_pitched between 0 and 9),
  runs_allowed int not null check (runs_allowed between 0 and 100),
  created_at timestamptz not null default now()
);

create index if not exists zolaball_games_difficulty_player_idx
  on public.zolaball_games (difficulty, player_id);

alter table public.zolaball_games enable row level security;

drop policy if exists "본인 기록 추가" on public.zolaball_games;
create policy "본인 기록 추가" on public.zolaball_games
  for insert to authenticated
  with check (player_id = (select auth.uid()));

drop policy if exists "본인 기록 보기" on public.zolaball_games;
create policy "본인 기록 보기" on public.zolaball_games
  for select to authenticated
  using (player_id = (select auth.uid()));

drop policy if exists "본인 기록 삭제" on public.zolaball_games;
create policy "본인 기록 삭제" on public.zolaball_games
  for delete to authenticated
  using (player_id = (select auth.uid()));

revoke all on public.zolaball_games from anon;
grant select, insert, delete on public.zolaball_games to authenticated;

-- 선수별 합계. 닉네임은 가장 최근 경기의 것을 쓴다 (닉네임을 바꾸면 랭킹에도 반영).
create or replace function public.zolaball_leaderboard(p_difficulty text)
returns table (
  player_id uuid,
  nickname text,
  games int,
  wins int,
  losses int,
  draws int,
  at_bats int,
  hits int,
  homeruns int,
  rbi int,
  best_rbi int,
  outs_pitched int,
  runs_allowed int
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    g.player_id,
    (array_agg(g.nickname order by g.created_at desc))[1],
    count(*)::int,
    (count(*) filter (where g.outcome = 'win'))::int,
    (count(*) filter (where g.outcome = 'lose'))::int,
    (count(*) filter (where g.outcome = 'draw'))::int,
    sum(g.at_bats)::int,
    sum(g.hits)::int,
    sum(g.homeruns)::int,
    sum(g.rbi)::int,
    max(g.rbi)::int,
    sum(g.outs_pitched)::int,
    sum(g.runs_allowed)::int
  from public.zolaball_games g
  where g.difficulty = p_difficulty
  group by g.player_id
$$;

revoke all on function public.zolaball_leaderboard(text) from public;
grant execute on function public.zolaball_leaderboard(text) to anon, authenticated;
