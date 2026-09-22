-- 사랑하는 4반 익명 게시판: 초기 설정 SQL
-- Supabase SQL Editor에서 새 프로젝트에 한 번만 전체 실행하세요.
-- 기존 공개 게시판 초안은 DB를 만든 적이 없어 데이터 이전 단계가 없습니다.
begin;
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create table public.admin_members (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null check (char_length(display_name) between 1 and 40)
);
alter table public.admin_members enable row level security;

create function private.is_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.admin_members where user_id = auth.uid());
$$;
revoke all on function private.is_admin() from public;
grant usage on schema private to authenticated;
grant execute on function private.is_admin() to authenticated;

create table public.posts (
  id uuid primary key default gen_random_uuid(),
  category text not null check (category in ('건의사항','질문','불편사항','행사 아이디어','칭찬·감사','기타')),
  title text not null check (char_length(btrim(title)) between 2 and 80),
  content text not null check (char_length(btrim(content)) between 5 and 2000),
  teacher_requested boolean not null default false,
  reply_requested boolean not null default false,
  status text not null default 'unread' check (status in ('unread','reviewed','forwarded','completed')),
  hidden boolean not null default false,
  admin_note text not null default '' check (char_length(admin_note) <= 4000),
  reply text not null default '' check (char_length(reply) <= 2000),
  version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index posts_filter_idx on public.posts(hidden, status, created_at desc);
create index posts_category_idx on public.posts(category, created_at desc);
alter table public.posts enable row level security;

create table public.admin_actions (
  id bigint generated always as identity primary key,
  post_id uuid not null references public.posts(id) on delete cascade,
  actor_id uuid references auth.users(id) on delete set null,
  actor_name text not null,
  changes jsonb not null,
  created_at timestamptz not null default now()
);
create index actions_post_idx on public.admin_actions(post_id, created_at desc);
alter table public.admin_actions enable row level security;

-- These records cannot be joined to a device or to a student's identity.
create table private.receipts (
  receipt_hash text primary key check (receipt_hash ~ '^[a-f0-9]{64}$'),
  post_id uuid not null unique references public.posts(id) on delete cascade
);
create table private.submission_limits (
  bucket text primary key,
  expires_at timestamptz not null,
  used integer not null default 1
);
alter table private.receipts enable row level security;
alter table private.submission_limits enable row level security;
revoke all on all tables in schema private from public, anon, authenticated;

-- Authenticated is NOT synonymous with admin. Only allowlisted accounts can read.
revoke all on public.posts, public.admin_members, public.admin_actions from public, anon, authenticated;
grant select on public.posts, public.admin_members, public.admin_actions to authenticated;
create policy admin_read_posts on public.posts for select to authenticated using ((select private.is_admin()));
create policy admin_read_members on public.admin_members for select to authenticated using ((select private.is_admin()));
create policy admin_read_actions on public.admin_actions for select to authenticated using ((select private.is_admin()));
-- anon has no table grant at all. Authenticated non-admins receive zero rows through RLS.
-- No client INSERT/UPDATE/DELETE grants or policies exist.

create function public.submit_post(
  p_category text, p_title text, p_content text, p_teacher_requested boolean,
  p_reply_requested boolean, p_device_hash text, p_receipt_hash text
) returns void language plpgsql security definer set search_path = '' as $$
declare new_id uuid; t timestamptz := clock_timestamp();
begin
  if p_device_hash is null or p_device_hash !~ '^[a-f0-9]{64}$' then raise exception 'invalid_device'; end if;
  if p_reply_requested is null or (p_reply_requested and (p_receipt_hash is null or p_receipt_hash !~ '^[a-f0-9]{64}$'))
     or (not p_reply_requested and p_receipt_hash is not null) then raise exception 'invalid_receipt'; end if;
  -- One shared transactional lock: concurrent requests cannot outrun either limit.
  perform pg_advisory_xact_lock(404040);
  delete from private.submission_limits where expires_at <= t;
  if exists(select 1 from private.submission_limits where bucket = p_device_hash) then raise exception 'cooldown'; end if;
  if exists(select 1 from private.submission_limits where bucket = 'global' and used >= 100) then raise exception 'board_busy'; end if;
  insert into private.submission_limits(bucket, expires_at) values(p_device_hash, t + interval '60 seconds');
  insert into private.submission_limits(bucket, expires_at) values('global', t + interval '1 hour')
    on conflict (bucket) do update set used = private.submission_limits.used + 1;
  insert into public.posts(category,title,content,teacher_requested,reply_requested)
    values(p_category,btrim(p_title),btrim(p_content),p_teacher_requested,p_reply_requested) returning id into new_id;
  if p_reply_requested then insert into private.receipts(receipt_hash,post_id) values(p_receipt_hash,new_id); end if;
end;
$$;
revoke all on function public.submit_post(text,text,text,boolean,boolean,text,text) from public, anon, authenticated;
grant execute on function public.submit_post(text,text,text,boolean,boolean,text,text) to service_role;

create function public.lookup_result(p_receipt_hash text)
returns table(status text, reply text, updated_at timestamptz)
language sql stable security definer set search_path = '' as $$
  select p.status, p.reply, p.updated_at
  from private.receipts r join public.posts p on p.id = r.post_id
  where r.receipt_hash = p_receipt_hash and p.reply_requested;
$$;
revoke all on function public.lookup_result(text) from public, anon, authenticated;
grant execute on function public.lookup_result(text) to service_role;

create function public.moderate_post(
  p_id uuid, p_version integer, p_status text, p_hidden boolean, p_admin_note text, p_reply text
) returns void language plpgsql security definer set search_path = '' as $$
declare before_row public.posts; actor text; change_data jsonb := '{}'::jsonb;
begin
  select display_name into actor from public.admin_members where user_id = auth.uid();
  if actor is null then raise exception 'not_authorized'; end if;
  select * into before_row from public.posts where id = p_id for update;
  if not found then raise exception 'not_found'; end if;
  if p_version is distinct from before_row.version then raise exception 'conflict_reload'; end if;
  if not before_row.reply_requested and p_reply <> '' then raise exception 'reply_not_requested'; end if;
  if before_row.status is distinct from p_status then change_data := change_data || jsonb_build_object('status',jsonb_build_array(before_row.status,p_status)); end if;
  if before_row.hidden is distinct from p_hidden then change_data := change_data || jsonb_build_object('hidden',p_hidden); end if;
  if before_row.admin_note is distinct from p_admin_note then change_data := change_data || '{"admin_note_changed":true}'::jsonb; end if;
  if before_row.reply is distinct from p_reply then change_data := change_data || '{"reply_changed":true}'::jsonb; end if;
  if change_data = '{}'::jsonb then return; end if;
  update public.posts set status=p_status,hidden=p_hidden,admin_note=p_admin_note,reply=p_reply,
    version=version+1,updated_at=clock_timestamp() where id=p_id;
  insert into public.admin_actions(post_id,actor_id,actor_name,changes)
    values(p_id,auth.uid(),actor,change_data);
end;
$$;
revoke all on function public.moderate_post(uuid,integer,text,boolean,text,text) from public, anon, authenticated;
grant execute on function public.moderate_post(uuid,integer,text,boolean,text,text) to authenticated;
commit;
