-- 주간 팀 랭킹 — Supabase SQL Editor에 통째로 붙여 실행 (다시 실행해도 됨)
-- 앱은 테이블에 직접 접근 못 함 (RLS 켜고 정책 없음) → 아래 함수 2개만 anon 키로 호출
--   submit_team_score  : 결과 화면에서 한 판 점수 제출 (토스 안에서만, 게임 사용자 식별키 해시)
--   weekly_team_ranking: 팀별 주간 합계 — 한 주 = 한국시간 월요일 00:00 ~ 다음 월요일 00:00

create table if not exists public.team_scores (
  id bigint generated always as identity primary key,
  user_hash text not null,
  team_id text not null,
  score integer not null,
  created_at timestamptz not null default now()
);

create index if not exists team_scores_created_at_idx on public.team_scores (created_at);
create index if not exists team_scores_user_created_idx on public.team_scores (user_hash, created_at desc);

alter table public.team_scores enable row level security;
revoke all on public.team_scores from anon, authenticated;

-- 팀 id — src/components/constants.js TEAMS와 같은 순서·값
create or replace function public.team_ids()
returns text[]
language sql
immutable
as $$
  select array['kt', 'samsung', 'kia', 'lg', 'doosan', 'ssg', 'nc', 'lotte', 'hanwha', 'kiwoom']
$$;

-- 한 판 점수 제출 — 저장했으면 true, 거부·무시면 false
create or replace function public.submit_team_score(p_user text, p_team text, p_score integer)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  max_score constant integer := 3000000;  -- 한 판 점수 상한 (조작 피해 줄이기용, 넉넉하게)
  min_gap constant interval := interval '10 seconds';  -- 같은 사람 연속 제출 최소 간격
begin
  if p_user is null or length(p_user) not between 8 and 256 then
    return false;
  end if;
  if p_team is null or not (p_team = any (public.team_ids())) then
    return false;
  end if;
  if p_score is null or p_score < 0 or p_score > max_score then
    return false;
  end if;
  if exists (
    select 1 from public.team_scores
    where user_hash = p_user and created_at > now() - min_gap
  ) then
    return false;
  end if;

  insert into public.team_scores (user_hash, team_id, score) values (p_user, p_team, p_score);
  return true;
end;
$$;

-- 주간 팀 랭킹 — p_offset 0 = 이번 주, 1 = 지난주. 10개 팀 전부(기록 없으면 0), 합계 내림차순
create or replace function public.weekly_team_ranking(p_offset integer default 0)
returns table (team_id text, total bigint, players bigint, games bigint)
language sql
stable
security definer
set search_path = public
as $$
  with week as (
    select
      (date_trunc('week', now() at time zone 'Asia/Seoul') - make_interval(weeks => greatest(p_offset, 0)))
        at time zone 'Asia/Seoul' as starts_at
  ),
  teams as (
    select unnest(public.team_ids()) as team_id
  )
  select
    t.team_id,
    coalesce(sum(s.score), 0)::bigint as total,
    count(distinct s.user_hash)::bigint as players,
    count(s.id)::bigint as games
  from teams t
  cross join week w
  left join public.team_scores s
    on s.team_id = t.team_id
   and s.created_at >= w.starts_at
   and s.created_at < w.starts_at + interval '1 week'
  group by t.team_id
  order by total desc, t.team_id
$$;

revoke execute on function public.submit_team_score(text, text, integer) from public;
revoke execute on function public.weekly_team_ranking(integer) from public;
grant execute on function public.submit_team_score(text, text, integer) to anon, authenticated;
grant execute on function public.weekly_team_ranking(integer) to anon, authenticated;
