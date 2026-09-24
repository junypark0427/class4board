-- 관리자 승인형 익명 게시판 마이그레이션
-- 001_suggestion_box.sql을 이미 적용한 운영 DB에서 그대로 실행할 수 있습니다.
-- 기존 글은 모두 비공개 상태로 유지됩니다.
begin;

alter table public.posts
  add column is_public boolean not null default false,
  add column published_at timestamptz;

alter table public.posts
  add constraint posts_publication_time_check
  check ((is_public and published_at is not null) or (not is_public and published_at is null));

create index posts_publication_idx
  on public.posts(is_public, hidden, created_at desc);

-- 공개용 사본에는 학생에게 보여도 되는 열만 저장합니다. 원본의 관리자 메모,
-- 전달 희망 여부, 결과 확인 희망 여부, 버전 정보는 이 테이블에 존재하지 않습니다.
create table public.published_posts (
  post_id uuid primary key references public.posts(id) on delete cascade,
  category text not null check (category in ('건의사항','질문','불편사항','행사 아이디어','칭찬·감사','기타')),
  title text not null,
  content text not null,
  status text not null check (status in ('unread','reviewed','forwarded','completed')),
  reply text not null default '',
  created_at timestamptz not null,
  published_at timestamptz not null,
  updated_at timestamptz not null
);
create index published_posts_latest_idx on public.published_posts(created_at desc);
create index published_posts_category_idx on public.published_posts(category, created_at desc);
alter table public.published_posts enable row level security;

revoke all on public.published_posts from public, anon, authenticated;
grant select on public.published_posts to anon;
create policy anonymous_read_published_posts
  on public.published_posts for select to anon using (true);

create function private.sync_published_post() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.is_public and not new.hidden then
    insert into public.published_posts(
      post_id, category, title, content, status, reply,
      created_at, published_at, updated_at
    ) values (
      new.id, new.category, new.title, new.content, new.status, new.reply,
      new.created_at, new.published_at, new.updated_at
    )
    on conflict (post_id) do update set
      category = excluded.category,
      title = excluded.title,
      content = excluded.content,
      status = excluded.status,
      reply = excluded.reply,
      published_at = excluded.published_at,
      updated_at = excluded.updated_at;
  else
    delete from public.published_posts where post_id = new.id;
  end if;
  return new;
end;
$$;
revoke all on function private.sync_published_post() from public, anon, authenticated;

create trigger sync_published_post_after_write
after insert or update of category, title, content, status, reply, hidden, is_public, published_at
on public.posts for each row execute function private.sync_published_post();

-- 이전 함수 시그니처를 제거하고 공개 승인 값을 함께 저장하는 버전으로 교체합니다.
drop function public.moderate_post(uuid,integer,text,boolean,text,text);
create function public.moderate_post(
  p_id uuid, p_version integer, p_status text, p_hidden boolean,
  p_is_public boolean, p_admin_note text, p_reply text
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
  if before_row.is_public is distinct from p_is_public then change_data := change_data || jsonb_build_object('is_public',p_is_public); end if;
  if before_row.admin_note is distinct from p_admin_note then change_data := change_data || '{"admin_note_changed":true}'::jsonb; end if;
  if before_row.reply is distinct from p_reply then change_data := change_data || '{"reply_changed":true}'::jsonb; end if;
  if change_data = '{}'::jsonb then return; end if;
  update public.posts set
    status=p_status,
    hidden=p_hidden,
    is_public=p_is_public,
    published_at=case
      when p_is_public and not before_row.is_public then clock_timestamp()
      when p_is_public then before_row.published_at
      else null
    end,
    admin_note=p_admin_note,
    reply=p_reply,
    version=version+1,
    updated_at=clock_timestamp()
  where id=p_id;
  insert into public.admin_actions(post_id,actor_id,actor_name,changes)
    values(p_id,auth.uid(),actor,change_data);
end;
$$;
revoke all on function public.moderate_post(uuid,integer,text,boolean,boolean,text,text) from public, anon, authenticated;
grant execute on function public.moderate_post(uuid,integer,text,boolean,boolean,text,text) to authenticated;

commit;
