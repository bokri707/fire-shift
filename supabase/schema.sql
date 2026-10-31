-- 소방 교대달력 Supabase 구조 (2026-10-31 실제 서버에서 뽑아 정리한 것)
-- 새 프로젝트에 이 파일을 SQL 편집기에서 실행하면 같은 구조가 만들어집니다.
-- 접근 방식: 모든 표는 RLS를 켜고 정책을 만들지 않아 직접 읽고 쓸 수 없습니다.
--           앱은 아래 SECURITY DEFINER 함수(RPC)로만 접근합니다. 팀 코드가 사실상 유일한 비밀번호입니다.
-- 아래 함수들은 anon/authenticated가 실행할 수 있게 열려 있습니다. (Supabase 기본값)

create table if not exists public.teams (
  code text primary key,
  name text not null,
  base date,
  kind text not null default 'team' check (kind in ('team', 'meet')), -- team=근무 팀, meet=모임
  pair boolean not null default false, -- 부부(가족) 소모임 표시
  created_at timestamptz default now()
);

create table if not exists public.members (
  id text primary key,
  team_code text references public.teams(code) on delete cascade,
  name text not null,
  team integer not null,
  anchor date,
  ex jsonb default '{}'::jsonb,
  updated_at timestamptz default now()
);

create table if not exists public.polls (
  id text primary key,
  team_code text references public.teams(code) on delete cascade,
  title text not null,
  dates text[],
  final text default '',
  created_at timestamptz default now()
);

create table if not exists public.votes (
  poll_id text references public.polls(id) on delete cascade,
  member_id text references public.members(id) on delete cascade,
  dates text[] default '{}',
  primary key (poll_id, member_id)
);

-- 사용 횟수 합계 (개인 식별 정보 없음)
create table if not exists public.usage_daily (
  day date not null,
  kind text not null check (kind in ('open', 'cal', 'team', 'pair', 'set')),
  n bigint not null default 0,
  primary key (day, kind)
);

alter table public.teams enable row level security;
alter table public.members enable row level security;
alter table public.polls enable row level security;
alter table public.votes enable row level security;
alter table public.usage_daily enable row level security;

create or replace function public.create_team(p_code text, p_name text, p_base date)
returns void language plpgsql security definer set search_path = public as $$
begin
  if p_code !~ '^[가-힣A-Za-z0-9]{2,12}$' then raise exception 'bad code'; end if;
  if p_name is null or length(p_name) not between 1 and 20 then raise exception 'bad name'; end if;
  insert into teams(code, name, base) values (p_code, p_name, p_base);
end $$;

-- 종류를 받는 새 함수. 예전 create_team(3개 인자)도 서버에 남아 있습니다. (이 파일 맨 아래 참고)
create or replace function public.create_team_k(p_code text, p_name text, p_base date, p_kind text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if p_code !~ '^[가-힣A-Za-z0-9]{2,12}$' then raise exception 'bad code'; end if;
  if p_name is null or length(p_name) not between 1 and 20 then raise exception 'bad name'; end if;
  if p_kind not in ('team', 'meet') then raise exception 'bad kind'; end if;
  insert into teams(code, name, base, kind) values (p_code, p_name, p_base, p_kind);
end $$;

create or replace function public.set_team_kind(p_code text, p_kind text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if p_kind not in ('team', 'meet') then raise exception 'bad kind'; end if;
  update teams set kind = p_kind where code = p_code;
end $$;

create or replace function public.set_team_pair(p_code text, p_pair boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  update teams set pair = coalesce(p_pair, false) where code = p_code;
end $$;

create or replace function public.get_team(p_code text)
returns json language sql stable security definer set search_path = public as $$
  select row_to_json(t) from (select code, name, base, kind, pair from teams where code = p_code) t;
$$;

create or replace function public.upsert_member(p_code text, p_id text, p_name text, p_team integer, p_anchor date, p_ex jsonb)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from teams where code = p_code) then raise exception 'no team'; end if;
  if p_name is null or length(p_name) not between 1 and 20 then raise exception 'bad name'; end if;
  if p_team not between 1 and 3 then raise exception 'bad team'; end if;
  if length(p_ex::text) > 30000 then raise exception 'too big'; end if;
  insert into members(id, team_code, name, team, anchor, ex, updated_at)
  values (p_id, p_code, p_name, p_team, p_anchor, p_ex, now())
  on conflict (id) do update
    set name = excluded.name, team = excluded.team, anchor = excluded.anchor, ex = excluded.ex, updated_at = now()
    where members.team_code = p_code;
end $$;

create or replace function public.delete_member(p_code text, p_id text)
returns void language sql security definer set search_path = public as $$
  delete from members where id = p_id and team_code = p_code;
$$;

create or replace function public.insert_poll(p_code text, p_id text, p_title text, p_dates text[])
returns void language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from teams where code = p_code) then raise exception 'no team'; end if;
  if p_title is null or length(p_title) not between 1 and 30 then raise exception 'bad title'; end if;
  if coalesce(array_length(p_dates, 1), 0) not between 1 and 120 then raise exception 'bad dates'; end if;
  insert into polls(id, team_code, title, dates, final) values (p_id, p_code, p_title, p_dates, '');
end $$;

create or replace function public.update_poll(p_code text, p_id text, p_final text, p_dates text[], p_title text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if p_title is not null and length(p_title) not between 1 and 30 then raise exception 'bad title'; end if;
  if p_dates is not null and coalesce(array_length(p_dates, 1), 0) not between 1 and 120 then raise exception 'bad dates'; end if;
  update polls set
    final = coalesce(p_final, final),
    dates = coalesce(p_dates, dates),
    title = coalesce(p_title, title)
  where id = p_id and team_code = p_code;
end $$;

create or replace function public.delete_poll(p_code text, p_id text)
returns void language sql security definer set search_path = public as $$
  delete from polls where id = p_id and team_code = p_code;
$$;

create or replace function public.upsert_vote(p_code text, p_poll_id text, p_member_id text, p_dates text[])
returns void language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from polls where id = p_poll_id and team_code = p_code) then raise exception 'no poll'; end if;
  if not exists (select 1 from members where id = p_member_id and team_code = p_code) then raise exception 'no member'; end if;
  if coalesce(array_length(p_dates, 1), 0) > 120 then raise exception 'too many'; end if;
  insert into votes(poll_id, member_id, dates) values (p_poll_id, p_member_id, coalesce(p_dates, '{}'))
  on conflict (poll_id, member_id) do update set dates = excluded.dates;
end $$;

create or replace function public.fetch_team(p_code text)
returns json language sql stable security definer set search_path = public as $$
  select json_build_object(
    'kind', (select t.kind from teams t where t.code = p_code),
    'pair', (select t.pair from teams t where t.code = p_code),
    'members', coalesce((select json_agg(json_build_object('id', m.id, 'name', m.name, 'team', m.team, 'ex', m.ex) order by m.updated_at)
                         from members m where m.team_code = p_code), '[]'::json),
    'polls', coalesce((select json_agg(json_build_object('id', p.id, 'title', p.title, 'dates', p.dates, 'final', p.final, 'created_at', p.created_at) order by p.created_at desc)
                       from polls p where p.team_code = p_code), '[]'::json),
    'votes', coalesce((select json_agg(json_build_object('poll_id', v.poll_id, 'member_id', v.member_id, 'dates', v.dates))
                       from votes v join polls p on p.id = v.poll_id where p.team_code = p_code), '[]'::json)
  );
$$;

-- 내용이 바뀌지 않았으면 데이터를 다시 보내지 않아 전송량을 줄입니다.
create or replace function public.fetch_team_v2(p_code text, p_hash text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  r jsonb;
  h text;
begin
  r := to_jsonb(public.fetch_team(p_code));
  h := md5(r::text);
  if h = coalesce(p_hash, '') then
    return jsonb_build_object('same', true, 'hash', h);
  end if;
  return jsonb_build_object('same', false, 'hash', h, 'data', r);
end;
$$;

create or replace function public.bump_usage(p_kind text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if p_kind not in ('open', 'cal', 'team', 'pair', 'set') then
    return;
  end if;
  insert into public.usage_daily (day, kind, n)
  values ((now() at time zone 'Asia/Seoul')::date, p_kind, 1)
  on conflict (day, kind) do update set n = public.usage_daily.n + 1;
end;
$$;
revoke all on function public.bump_usage(text) from public;
grant execute on function public.bump_usage(text) to anon, authenticated;

-- 참고: 서버에는 예전 create_team(p_code, p_name, p_base)도 그대로 남아 있습니다. (옛 앱 호환용, 종류는 항상 team)
-- 위 create_team 정의는 새 서버에서는 없어도 됩니다.
