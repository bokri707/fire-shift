-- 소모임 코드 추측 제한을 되돌리는 SQL입니다.
-- 함수 2개를 제한 적용 전 정의로 돌려놓고, 새로 만든 표와 도우미 함수를 지웁니다.
-- fetch_team_v2는 바꾸지 않았으므로 되돌릴 것이 없습니다.
-- 기존 소모임·팀원·투표 데이터는 건드리지 않습니다.

create or replace function public.get_team(p_code text)
returns json language sql stable security definer set search_path = public as $$
  select row_to_json(t) from (select code, name, base, kind, pair from teams where code = p_code) t;
$$;

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

drop function if exists public._guard_code(text);
drop function if exists public._client_ip();
drop table if exists public.miss_log;

notify pgrst, 'reload schema';
