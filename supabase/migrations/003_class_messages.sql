-- 001, 002가 적용된 운영 DB에서 한 번 실행합니다. 기존 건의글과 기록은 삭제하지 않습니다.
begin;

-- 기존 건의함의 공개 사본은 보존하되 학생의 직접 조회 권한을 없앱니다.
revoke select on public.published_posts from anon;
drop policy if exists anonymous_read_published_posts on public.published_posts;

create table public.class_messages (
  id uuid primary key default gen_random_uuid(),
  content text not null check (char_length(btrim(content)) between 2 and 500),
  moderation_state text not null default 'pending'
    check (moderation_state in ('pending', 'approved', 'rejected')),
  hidden boolean not null default false,
  version integer not null default 1,
  created_at timestamptz not null default now(),
  moderated_at timestamptz
);
create index class_messages_latest_idx on public.class_messages(moderation_state, hidden, created_at desc);
alter table public.class_messages enable row level security;
revoke all on public.class_messages from public, anon, authenticated;
grant select on public.class_messages to anon, authenticated;
create policy approved_class_messages on public.class_messages for select to anon
  using (moderation_state = 'approved' and not hidden);
create policy admin_class_messages on public.class_messages for select to authenticated
  using ((select private.is_admin()));

create table public.class_message_actions (
  id bigint generated always as identity primary key,
  message_id uuid not null references public.class_messages(id) on delete cascade,
  actor_id uuid references auth.users(id) on delete set null,
  actor_name text not null,
  changes jsonb not null,
  created_at timestamptz not null default now()
);
create index class_message_actions_idx on public.class_message_actions(message_id, created_at desc);
alter table public.class_message_actions enable row level security;
revoke all on public.class_message_actions from public, anon, authenticated;
grant select on public.class_message_actions to authenticated;
create policy admin_class_message_actions on public.class_message_actions for select to authenticated
  using ((select private.is_admin()));

-- 학생은 서버 API의 비밀 키를 거쳐서만 제출합니다. 클라이언트에 INSERT 권한이 없습니다.
create function public.submit_class_message(p_content text, p_device_hash text)
returns void language plpgsql security definer set search_path = '' as $$
declare t timestamptz := clock_timestamp();
begin
  if p_device_hash is null or p_device_hash !~ '^[a-f0-9]{64}$' then raise exception 'invalid_device'; end if;
  if p_content is null or char_length(btrim(p_content)) not between 2 and 500 then raise exception 'invalid_content'; end if;
  perform pg_advisory_xact_lock(404040);
  delete from private.submission_limits where expires_at <= t;
  if exists(select 1 from private.submission_limits where bucket = 'message:' || p_device_hash) then raise exception 'cooldown'; end if;
  if exists(select 1 from private.submission_limits where bucket = 'message:global' and used >= 100) then raise exception 'board_busy'; end if;
  insert into private.submission_limits(bucket, expires_at) values('message:' || p_device_hash, t + interval '60 seconds');
  insert into private.submission_limits(bucket, expires_at) values('message:global', t + interval '1 hour')
    on conflict (bucket) do update set used = private.submission_limits.used + 1;
  insert into public.class_messages(content) values(btrim(p_content));
end;
$$;
revoke all on function public.submit_class_message(text,text) from public, anon, authenticated;
grant execute on function public.submit_class_message(text,text) to service_role;

create function public.moderate_class_message(p_id uuid, p_version integer, p_state text, p_hidden boolean)
returns void language plpgsql security definer set search_path = '' as $$
declare before_row public.class_messages; actor text; changes jsonb := '{}'::jsonb;
begin
  select display_name into actor from public.admin_members where user_id = auth.uid();
  if actor is null then raise exception 'not_authorized'; end if;
  if p_state not in ('pending','approved','rejected') or p_state is null or p_hidden is null then raise exception 'invalid_moderation'; end if;
  select * into before_row from public.class_messages where id = p_id for update;
  if not found then raise exception 'not_found'; end if;
  if p_version is distinct from before_row.version then raise exception 'conflict_reload'; end if;
  if before_row.moderation_state is distinct from p_state then
    changes := changes || jsonb_build_object('moderation_state', jsonb_build_array(before_row.moderation_state, p_state));
  end if;
  if before_row.hidden is distinct from p_hidden then changes := changes || jsonb_build_object('hidden', p_hidden); end if;
  if changes = '{}'::jsonb then return; end if;
  update public.class_messages set moderation_state = p_state, hidden = p_hidden,
    version = version + 1, moderated_at = clock_timestamp() where id = p_id;
  insert into public.class_message_actions(message_id, actor_id, actor_name, changes)
    values(p_id, auth.uid(), actor, changes);
end;
$$;
revoke all on function public.moderate_class_message(uuid,integer,text,boolean) from public, anon, authenticated;
grant execute on function public.moderate_class_message(uuid,integer,text,boolean) to authenticated;

commit;
