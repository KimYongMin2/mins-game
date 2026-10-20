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


-- ───────────────────────────────────────────────────────────────
-- 졸라 양궁 온라인 랭킹
-- - archery_games: 경기 한 판(10발)의 결과 한 줄. 본인 기록만 쓰고 읽을 수 있다.
-- - archery_leaderboard(): 선수별 최고 점수·평균 점수·한 경기 최다 X. 이 합계만 공개한다.

create table if not exists public.archery_games (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  nickname text not null check (char_length(btrim(nickname)) between 1 and 10),
  -- 한 발 최대 10.9점 × 10발. 소수점 한 자리
  points numeric(4, 1) not null check (points between 0 and 109),
  x_count int not null check (x_count between 0 and 10),
  ten_count int not null check (ten_count between x_count and 10),
  created_at timestamptz not null default now(),
  -- 10점 링(X 포함)이 n개면 최소 10n점 (조작 방지용 최소한의 검사)
  constraint archery_points_cover_tens check (points >= ten_count * 10)
);

create index if not exists archery_games_player_idx on public.archery_games (player_id);

alter table public.archery_games enable row level security;

drop policy if exists "본인 기록 추가" on public.archery_games;
create policy "본인 기록 추가" on public.archery_games
  for insert to authenticated
  with check (player_id = (select auth.uid()));

drop policy if exists "본인 기록 보기" on public.archery_games;
create policy "본인 기록 보기" on public.archery_games
  for select to authenticated
  using (player_id = (select auth.uid()));

drop policy if exists "본인 기록 삭제" on public.archery_games;
create policy "본인 기록 삭제" on public.archery_games
  for delete to authenticated
  using (player_id = (select auth.uid()));

revoke all on public.archery_games from anon;
grant select, insert, delete on public.archery_games to authenticated;

-- 선수별 합계. 닉네임은 가장 최근 경기의 것.
-- 최고 점수 경기: 점수 → X → 10점 개수가 높고, 같으면 먼저 세운 기록
-- 최다 X 경기: X → 점수가 높고, 같으면 먼저 세운 기록
create or replace function public.archery_leaderboard()
returns table (
  player_id uuid,
  nickname text,
  games int,
  avg_points numeric,
  best_points numeric,
  best_x int,
  best_ten int,
  best_at timestamptz,
  most_x int,
  most_x_points numeric,
  most_x_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  with agg as (
    select g.player_id,
           (array_agg(g.nickname order by g.created_at desc))[1] as nickname,
           count(*)::int as games,
           round(avg(g.points), 2) as avg_points
    from public.archery_games g
    group by g.player_id
  ),
  best as (
    select distinct on (g.player_id) g.player_id, g.points, g.x_count, g.ten_count, g.created_at
    from public.archery_games g
    order by g.player_id, g.points desc, g.x_count desc, g.ten_count desc, g.created_at asc
  ),
  most_x as (
    select distinct on (g.player_id) g.player_id, g.x_count, g.points, g.created_at
    from public.archery_games g
    order by g.player_id, g.x_count desc, g.points desc, g.created_at asc
  )
  select a.player_id, a.nickname, a.games, a.avg_points,
         b.points, b.x_count, b.ten_count, b.created_at,
         m.x_count, m.points, m.created_at
  from agg a
  join best b on b.player_id = a.player_id
  join most_x m on m.player_id = a.player_id
$$;

revoke all on function public.archery_leaderboard() from public;
grant execute on function public.archery_leaderboard() to anon, authenticated;


-- ───────────────────────────────────────────────────────────────
-- 졸라 타격왕 온라인 랭킹
-- - batting_games: 경기 한 판(10구)의 결과 한 줄. 본인 기록만 쓰고 읽을 수 있다.
-- - batting_leaderboard(난이도): 선수별 최고 점수·한 경기 최다 홈런. 이 합계만 공개한다.

create table if not exists public.batting_games (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  nickname text not null check (char_length(btrim(nickname)) between 1 and 10),
  difficulty text not null check (difficulty in ('normal', 'hard')),
  hand text not null check (hand in ('right', 'left')),
  -- 점수 = 비거리 합(m). 한 공 최대 140m × 10구
  points int not null check (points between 0 and 1400),
  homeruns int not null check (homeruns between 0 and 10),
  hits int not null check (hits between homeruns and 10),
  created_at timestamptz not null default now(),
  -- 홈런은 115m 이상이라 홈런이 n개면 최소 115n점 (조작 방지용 최소한의 검사)
  constraint batting_points_cover_homeruns check (points >= homeruns * 115)
);

create index if not exists batting_games_difficulty_player_idx
  on public.batting_games (difficulty, player_id);

alter table public.batting_games enable row level security;

drop policy if exists "본인 기록 추가" on public.batting_games;
create policy "본인 기록 추가" on public.batting_games
  for insert to authenticated
  with check (player_id = (select auth.uid()));

drop policy if exists "본인 기록 보기" on public.batting_games;
create policy "본인 기록 보기" on public.batting_games
  for select to authenticated
  using (player_id = (select auth.uid()));

drop policy if exists "본인 기록 삭제" on public.batting_games;
create policy "본인 기록 삭제" on public.batting_games
  for delete to authenticated
  using (player_id = (select auth.uid()));

revoke all on public.batting_games from anon;
grant select, insert, delete on public.batting_games to authenticated;

-- 선수별 합계. 닉네임은 가장 최근 경기의 것.
-- 최고 점수 경기: 점수 → 홈런 → 안타 이상이 높고, 같으면 먼저 세운 기록
-- 최다 홈런 경기: 홈런 → 점수가 높고, 같으면 먼저 세운 기록
create or replace function public.batting_leaderboard(p_difficulty text)
returns table (
  player_id uuid,
  nickname text,
  games int,
  best_points int,
  best_homeruns int,
  best_hits int,
  best_at timestamptz,
  most_hr int,
  most_hr_points int,
  most_hr_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  with mine as (
    select * from public.batting_games g where g.difficulty = p_difficulty
  ),
  agg as (
    select m.player_id,
           (array_agg(m.nickname order by m.created_at desc))[1] as nickname,
           count(*)::int as games
    from mine m
    group by m.player_id
  ),
  best as (
    select distinct on (m.player_id) m.player_id, m.points, m.homeruns, m.hits, m.created_at
    from mine m
    order by m.player_id, m.points desc, m.homeruns desc, m.hits desc, m.created_at asc
  ),
  most_hr as (
    select distinct on (m.player_id) m.player_id, m.homeruns, m.points, m.created_at
    from mine m
    order by m.player_id, m.homeruns desc, m.points desc, m.created_at asc
  )
  select a.player_id, a.nickname, a.games,
         b.points, b.homeruns, b.hits, b.created_at,
         h.homeruns, h.points, h.created_at
  from agg a
  join best b on b.player_id = a.player_id
  join most_hr h on h.player_id = a.player_id
$$;

revoke all on function public.batting_leaderboard(text) from public;
grant execute on function public.batting_leaderboard(text) to anon, authenticated;


-- ───────────────────────────────────────────────────────────────
-- 격투 온라인 랭킹
-- - fight_games: 경기 한 판의 결과 한 줄. 본인 기록만 쓰고 읽을 수 있다.
-- - fight_leaderboard(난이도): 선수별 승/패/무와 최다 연승. 이 합계만 공개한다.

create table if not exists public.fight_games (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  nickname text not null check (char_length(btrim(nickname)) between 1 and 10),
  difficulty text not null check (difficulty in ('normal', 'hard')),
  outcome text not null check (outcome in ('win', 'lose', 'draw')),
  -- 생명력 3이라 최소 3턴, 턴 제한 30
  turns int not null check (turns between 3 and 30),
  -- 이 경기 뒤의 연승. 이긴 경기만 1 이상
  win_streak int not null check (win_streak between 0 and 100000),
  created_at timestamptz not null default now(),
  constraint fight_streak_only_on_win check ((outcome = 'win') = (win_streak > 0))
);

create index if not exists fight_games_difficulty_player_idx
  on public.fight_games (difficulty, player_id);

alter table public.fight_games enable row level security;

drop policy if exists "본인 기록 추가" on public.fight_games;
create policy "본인 기록 추가" on public.fight_games
  for insert to authenticated
  with check (player_id = (select auth.uid()));

drop policy if exists "본인 기록 보기" on public.fight_games;
create policy "본인 기록 보기" on public.fight_games
  for select to authenticated
  using (player_id = (select auth.uid()));

drop policy if exists "본인 기록 삭제" on public.fight_games;
create policy "본인 기록 삭제" on public.fight_games
  for delete to authenticated
  using (player_id = (select auth.uid()));

revoke all on public.fight_games from anon;
grant select, insert, delete on public.fight_games to authenticated;

-- 선수별 합계. 닉네임은 가장 최근 경기의 것. 최다 연승은 그 연승에 처음 닿은 시각도 함께.
create or replace function public.fight_leaderboard(p_difficulty text)
returns table (
  player_id uuid,
  nickname text,
  wins int,
  losses int,
  draws int,
  best_streak int,
  best_streak_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  with mine as (
    select * from public.fight_games g where g.difficulty = p_difficulty
  ),
  agg as (
    select m.player_id,
           (array_agg(m.nickname order by m.created_at desc))[1] as nickname,
           (count(*) filter (where m.outcome = 'win'))::int as wins,
           (count(*) filter (where m.outcome = 'lose'))::int as losses,
           (count(*) filter (where m.outcome = 'draw'))::int as draws,
           max(m.win_streak)::int as best_streak
    from mine m
    group by m.player_id
  )
  select a.player_id, a.nickname, a.wins, a.losses, a.draws, a.best_streak,
         (select min(m.created_at) from mine m
           where m.player_id = a.player_id and m.win_streak = a.best_streak and a.best_streak > 0)
  from agg a
$$;

revoke all on function public.fight_leaderboard(text) from public;
grant execute on function public.fight_leaderboard(text) to anon, authenticated;
