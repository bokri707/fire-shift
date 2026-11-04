-- 소방 교대달력 문의 게시판 (2026-11-04 서버에 적용했습니다. 이 파일은 기록용이며, 다시 실행해도 같은 결과입니다.)
-- 새 표 1개와 새 함수 3개만 만들고, 기존 표·함수·기록은 건드리지 않습니다.
-- 접근 방식: 표는 RLS만 켜고 정책을 만들지 않아 직접 읽고 쓸 수 없습니다. 앱은 아래 함수로만 접근합니다.
-- 접속 주소(IP) 등 다른 식별 정보는 저장하지 않습니다. 폰이 만든 임의 번호(device_id)만 구분에 씁니다.

create table if not exists public.cs_posts (
  id uuid primary key default gen_random_uuid(),
  device_id text not null check (device_id ~ '^[A-Za-z0-9_-]{16,64}$'),
  category text not null check (category in ('bug', 'idea', 'howto', 'privacy', 'etc')),
  body text not null check (char_length(body) between 1 and 500),
  app_ver text check (app_ver is null or char_length(app_ver) <= 20),
  platform text check (platform is null or char_length(platform) <= 20),
  status text not null default 'new' check (status in ('new', 'read', 'answered', 'closed', 'deleted')),
  reply text check (reply is null or char_length(reply) <= 2000),
  replied_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists cs_posts_device_idx on public.cs_posts (device_id, created_at desc);
alter table public.cs_posts enable row level security;
revoke all on table public.cs_posts from public, anon, authenticated;

-- 보내기: 같은 폰은 한국 시간 기준 하루 3건까지
create or replace function public.cs_submit(p_device text, p_category text, p_body text, p_app_ver text, p_platform text)
returns json language plpgsql volatile security definer set search_path = public as $$
declare
  b text := btrim(coalesce(p_body, ''));
  today_start timestamptz := date_trunc('day', now() at time zone 'Asia/Seoul') at time zone 'Asia/Seoul';
  n integer;
  new_id uuid;
begin
  if p_device is null or p_device !~ '^[A-Za-z0-9_-]{16,64}$' then raise exception 'bad device'; end if;
  if p_category not in ('bug', 'idea', 'howto', 'privacy', 'etc') then raise exception 'bad category'; end if;
  if char_length(b) < 5 then raise exception 'too short'; end if;
  if char_length(b) > 500 then raise exception 'too long'; end if;
  select count(*) into n from cs_posts where device_id = p_device and created_at >= today_start;
  if n >= 3 then raise exception 'daily_limit'; end if;
  -- 임의 번호를 바꿔 가며 도배하는 것을 막는 전체 한도: 최근 1시간에 100건을 넘으면 잠시 받지 않습니다.
  select count(*) into n from cs_posts where created_at >= now() - interval '1 hour';
  if n >= 100 then raise exception 'busy'; end if;
  insert into cs_posts(device_id, category, body, app_ver, platform)
  values (p_device, p_category, b, left(p_app_ver, 20), left(p_platform, 20))
  returning id into new_id;
  return json_build_object('id', new_id);
end $$;

-- 내 문의 목록: 이 폰의 글만, 최신 50건
create or replace function public.cs_my_posts(p_device text)
returns json language plpgsql stable security definer set search_path = public as $$
begin
  if p_device is null or p_device !~ '^[A-Za-z0-9_-]{16,64}$' then raise exception 'bad device'; end if;
  return coalesce((
    select json_agg(json_build_object(
      'id', x.id, 'category', x.category, 'body', x.body, 'status', x.status,
      'reply', x.reply, 'replied_at', x.replied_at, 'created_at', x.created_at) order by x.created_at desc)
    from (select * from cs_posts where device_id = p_device and status <> 'deleted' order by created_at desc limit 50) x
  ), '[]'::json);
end $$;

-- 내 글 삭제: 이 폰의 글만. 내용과 답변은 지우고 빈 껍데기만 남겨, 지웠다 다시 보내서 하루 3건 제한을 넘기는 것을 막습니다.
create or replace function public.cs_delete(p_device text, p_id uuid)
returns void language plpgsql volatile security definer set search_path = public as $$
begin
  if p_device is null or p_device !~ '^[A-Za-z0-9_-]{16,64}$' then raise exception 'bad device'; end if;
  update cs_posts set body = '(삭제됨)', reply = null, replied_at = null, status = 'deleted'
   where id = p_id and device_id = p_device;
end $$;

revoke all on function public.cs_submit(text, text, text, text, text) from public;
revoke all on function public.cs_my_posts(text) from public;
revoke all on function public.cs_delete(text, uuid) from public;
grant execute on function public.cs_submit(text, text, text, text, text) to anon, authenticated;
grant execute on function public.cs_my_posts(text) to anon, authenticated;
grant execute on function public.cs_delete(text, uuid) to anon, authenticated;

-- 되돌리기(문의 게시판을 통째로 없앨 때만. 쌓인 문의도 같이 지워집니다):
-- drop function if exists public.cs_submit(text, text, text, text, text);
-- drop function if exists public.cs_my_posts(text);
-- drop function if exists public.cs_delete(text, uuid);
-- drop table if exists public.cs_posts;
