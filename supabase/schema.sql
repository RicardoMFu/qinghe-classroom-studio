-- 15班工作台：先在 Supabase SQL Editor 执行本文件，再配置邀请账号。
-- 浏览器只使用 publishable key；service_role key 禁止写入前端或 GitHub。

create extension if not exists pgcrypto;

create table if not exists public.classrooms (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  school text not null,
  grade_label text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.classroom_members (
  classroom_id uuid not null references public.classrooms(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('owner', 'editor', 'viewer')),
  created_at timestamptz not null default now(),
  primary key (classroom_id, user_id)
);

create index if not exists classroom_members_user_id_idx
  on public.classroom_members(user_id);

create table if not exists public.classroom_states (
  classroom_id uuid primary key references public.classrooms(id) on delete cascade,
  revision bigint not null default 1,
  payload jsonb not null default '{"students":[],"exams":[],"activeExamId":null,"seats":[],"tasks":[],"schedule":[]}'::jsonb,
  updated_by uuid references auth.users(id),
  updated_at timestamptz not null default now()
);

create table if not exists public.classroom_state_history (
  id bigint generated always as identity primary key,
  classroom_id uuid not null references public.classrooms(id) on delete cascade,
  revision bigint not null,
  payload jsonb not null,
  changed_by uuid references auth.users(id),
  changed_at timestamptz not null default now()
);

create index if not exists classroom_state_history_class_revision_idx
  on public.classroom_state_history(classroom_id, revision desc);

alter table public.classrooms enable row level security;
alter table public.classroom_members enable row level security;
alter table public.classroom_states enable row level security;
alter table public.classroom_state_history enable row level security;

revoke all on public.classrooms, public.classroom_members, public.classroom_states, public.classroom_state_history from anon;
grant select on public.classrooms, public.classroom_members, public.classroom_states to authenticated;
grant select on public.classroom_state_history to authenticated;

drop policy if exists classrooms_member_read on public.classrooms;
create policy classrooms_member_read on public.classrooms
for select to authenticated
using (exists (
  select 1 from public.classroom_members m
  where m.classroom_id = classrooms.id and m.user_id = (select auth.uid())
));

drop policy if exists classroom_members_self_read on public.classroom_members;
create policy classroom_members_self_read on public.classroom_members
for select to authenticated
using (user_id = (select auth.uid()));

drop policy if exists classroom_states_member_read on public.classroom_states;
create policy classroom_states_member_read on public.classroom_states
for select to authenticated
using (exists (
  select 1 from public.classroom_members m
  where m.classroom_id = classroom_states.classroom_id and m.user_id = (select auth.uid())
));

drop policy if exists classroom_history_member_read on public.classroom_state_history;
create policy classroom_history_member_read on public.classroom_state_history
for select to authenticated
using (exists (
  select 1 from public.classroom_members m
  where m.classroom_id = classroom_state_history.classroom_id and m.user_id = (select auth.uid())
));

create or replace function public.save_classroom_state(
  p_classroom_id uuid,
  p_expected_revision bigint,
  p_payload jsonb
)
returns table(revision bigint, payload jsonb, updated_at timestamptz)
language plpgsql
security definer
set search_path = public
as $$
declare
  current_state public.classroom_states%rowtype;
begin
  if coalesce(jsonb_typeof(p_payload) <> 'object', true)
    or coalesce(jsonb_typeof(p_payload -> 'students') <> 'array', true)
    or coalesce(jsonb_typeof(p_payload -> 'seats') <> 'array', true)
    or coalesce(jsonb_typeof(p_payload -> 'tasks') <> 'array', true)
    or coalesce(jsonb_typeof(p_payload -> 'schedule') <> 'array', true)
    or octet_length(p_payload::text) > 1000000 then
    raise exception 'invalid classroom payload' using errcode = '22023';
  end if;

  if not exists (
    select 1 from public.classroom_members
    where classroom_id = p_classroom_id
      and user_id = (select auth.uid())
      and role in ('owner', 'editor')
  ) then
    raise exception 'write permission denied' using errcode = '42501';
  end if;

  select * into current_state
  from public.classroom_states
  where classroom_id = p_classroom_id
  for update;

  if current_state.revision <> p_expected_revision then
    raise exception 'revision conflict' using errcode = '40001';
  end if;

  insert into public.classroom_state_history(classroom_id, revision, payload, changed_by)
  values (current_state.classroom_id, current_state.revision, current_state.payload, (select auth.uid()));

  update public.classroom_states
  set payload = p_payload,
      revision = current_state.revision + 1,
      updated_by = (select auth.uid()),
      updated_at = now()
  where classroom_id = p_classroom_id
  returning classroom_states.revision, classroom_states.payload, classroom_states.updated_at
  into revision, payload, updated_at;
  return next;
end;
$$;

revoke all on function public.save_classroom_state(uuid, bigint, jsonb) from public, anon;
grant execute on function public.save_classroom_state(uuid, bigint, jsonb) to authenticated;

insert into public.classrooms(slug, name, school, grade_label)
values ('class-15', '15班', '重庆市涪陵第五中学', '七年级')
on conflict (slug) do update set name = excluded.name, school = excluded.school, grade_label = excluded.grade_label;

insert into public.classroom_states(classroom_id)
select id from public.classrooms where slug = 'class-15'
on conflict (classroom_id) do nothing;

-- 登录后，在 Auth > Users 复制账号 UUID，再执行：
-- insert into public.classroom_members(classroom_id, user_id, role)
-- select id, '用户UUID'::uuid, 'owner' from public.classrooms where slug = 'class-15';

-- Supabase Dashboard > Database > Replication 中将 classroom_states 加入 realtime publication。
