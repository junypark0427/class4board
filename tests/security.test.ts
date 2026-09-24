import { before, after, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { deviceToken, deviceHash } from '../lib/cooldown';
import { postInput } from '../lib/shared';

const db = new PGlite();
const president = '00000000-0000-4000-8000-000000000001';
const deputy = '00000000-0000-4000-8000-000000000002';
const outsider = '00000000-0000-4000-8000-000000000003';
let postId: string;
async function asRole(role: string, user?: string) {
  await db.exec('reset role');
  await db.query("select set_config('request.jwt.claim.sub', $1, false)", [user ?? '']);
  await db.exec(`set role ${role}`);
}
before(async () => {
  await db.exec(`create role anon; create role authenticated; create role service_role;
    create schema auth; create table auth.users(id uuid primary key);
    create function auth.uid() returns uuid language sql stable as $$
      select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid;
    $$;
    grant usage on schema auth to anon, authenticated, service_role;
    grant execute on function auth.uid() to anon, authenticated, service_role;
    insert into auth.users values ('${president}'),('${deputy}'),('${outsider}');`);
  await db.exec(await readFile(new URL('../supabase/migrations/001_suggestion_box.sql', import.meta.url), 'utf8'));
  await db.exec(await readFile(new URL('../supabase/migrations/002_admin_approved_board.sql', import.meta.url), 'utf8'));
  await db.query('insert into public.admin_members values ($1,$2),($3,$4)', [president,'반장',deputy,'부반장']);
});
after(async () => { await db.close(); });
test('server submission creates private unread opinion; cooldown is transactional', async () => {
  await asRole('service_role');
  await db.query('select public.submit_post($1,$2,$3,$4,$5,$6,$7)', ['건의사항','새로운 의견','함께 확인할 의견입니다',true,true,'a'.repeat(64),'b'.repeat(64)]);
  await assert.rejects(db.query('select public.submit_post($1,$2,$3,$4,$5,$6,$7)', ['질문','또 다른 의견','중복 제출은 막아주세요',false,false,'a'.repeat(64),null]), /cooldown/);
  await asRole('authenticated',president);
  const result = await db.query<{id:string;status:string;is_public:boolean}>('select * from public.posts');
  assert.equal(result.rows.length,1); assert.equal(result.rows[0].status,'unread'); assert.equal(result.rows[0].is_public,false); postId=result.rows[0].id;
});
test('anonymous cannot read content, members, audit, receipts or bypass submission API', async () => {
  await asRole('anon');
  for (const table of ['posts','admin_members','admin_actions']) {
    await assert.rejects(db.query(`select * from public.${table}`), /permission denied/);
  }
  await assert.rejects(db.exec('select * from private.receipts'), /permission denied/);
  assert.equal((await db.query('select * from public.published_posts')).rows.length,0);
  await assert.rejects(db.exec("insert into public.posts(category,title,content) values('질문','제목','비인가 직접 제출')"), /permission denied/);
  await assert.rejects(db.query('select public.submit_post($1,$2,$3,$4,$5,$6,$7)', ['질문','제목','비인가 직접 제출',false,false,'c'.repeat(64),null]), /permission denied/);
  await assert.rejects(db.query('select * from public.lookup_result($1)',['b'.repeat(64)]), /permission denied/);
});
test('ordinary authenticated users have no admin access or self-promotion', async () => {
  await asRole('authenticated',outsider);
  assert.equal((await db.exec('select * from public.posts'))[0].rows.length,0);
  await assert.rejects(db.query('insert into public.admin_members values ($1,$2)',[outsider,'가짜 반장']), /permission denied/);
  await assert.rejects(db.query('select public.moderate_post($1,1,$2,false,false,$3,$4)',[postId,'completed','','']), /not_authorized/);
  await assert.rejects(db.query('select * from public.published_posts'), /permission denied/);
});
test('both admins have equal access; notes are private and changes are attributed', async () => {
  await asRole('authenticated',president);
  await db.query('select public.moderate_post($1,1,$2,false,true,$3,$4)',[postId,'reviewed','비공개 관리자 메모','확인했어요.']);
  await asRole('authenticated',deputy);
  assert.equal((await db.query<{admin_note:string}>('select admin_note from public.posts')).rows[0].admin_note,'비공개 관리자 메모');
  await db.query('select public.moderate_post($1,2,$2,false,true,$3,$4)',[postId,'forwarded','전달 완료 메모','선생님께 전달했어요.']);
  const history = await db.query<{actor_name:string;changes:object}>('select actor_name, changes from public.admin_actions order by id');
  assert.deepEqual(history.rows.map(x=>x.actor_name),['반장','부반장']);
  assert.ok(!JSON.stringify(history.rows).includes('비공개 관리자 메모'));
  await assert.rejects(db.exec('delete from public.admin_actions'), /permission denied/);
  await assert.rejects(db.exec("update public.posts set status='completed'"), /permission denied/);
});
test('anonymous sees only the approved safe projection with current status and reply', async () => {
  await asRole('anon');
  const result = await db.query<Record<string,unknown>>('select * from public.published_posts');
  assert.equal(result.rows.length,1);
  assert.deepEqual(Object.keys(result.rows[0]).sort(),['category','content','created_at','post_id','published_at','reply','status','title','updated_at']);
  assert.equal(result.rows[0].status,'forwarded');
  assert.equal(result.rows[0].reply,'선생님께 전달했어요.');
  await assert.rejects(db.query('select admin_note from public.published_posts'), /does not exist/);
  await assert.rejects(db.query('select * from public.posts'), /permission denied/);
});
test('stale saves are rejected and hide/unhide is audited without changing workflow', async () => {
  await asRole('authenticated',president);
  await assert.rejects(db.query('select public.moderate_post($1,1,$2,false,true,$3,$4)',[postId,'completed','','']), /conflict_reload/);
  await db.query('select public.moderate_post($1,3,$2,true,true,$3,$4)',[postId,'forwarded','전달 완료 메모','선생님께 전달했어요.']);
  assert.equal((await db.query<{hidden:boolean}>('select hidden from public.posts')).rows[0].hidden,true);
  await asRole('anon');
  assert.equal((await db.query('select * from public.published_posts')).rows.length,0);
  await asRole('authenticated',president);
  await db.query('select public.moderate_post($1,4,$2,false,false,$3,$4)',[postId,'completed','전달 완료 메모','처리했어요.']);
  const history = await db.query<{changes:object}>('select changes from public.admin_actions order by id');
  assert.ok(JSON.stringify(history.rows).includes('"is_public":true'));
  assert.ok(JSON.stringify(history.rows).includes('"is_public":false'));
});
test('receipt exposes only status/reply/date; incorrect tokens expose nothing', async () => {
  await asRole('service_role');
  const result = await db.query<{status:string;reply:string;updated_at:string}>('select * from public.lookup_result($1)',['b'.repeat(64)]);
  assert.equal(result.rows.length,1); assert.deepEqual(Object.keys(result.rows[0]).sort(),['reply','status','updated_at']);
  assert.equal(result.rows[0].status,'completed');
  assert.equal((await db.query('select * from public.lookup_result($1)',['c'.repeat(64)])).rows.length,0);
});
test('database length checks roll back throttle and reject invalid states', async () => {
  await asRole('service_role');
  await assert.rejects(db.query('select public.submit_post($1,$2,$3,$4,$5,$6,$7)', ['질문','x'.repeat(81),'유효하지 않은 제목',false,false,'d'.repeat(64),null]), /check constraint/);
  await db.query('select public.submit_post($1,$2,$3,$4,$5,$6,$7)', ['기타','정상 제목','실패한 요청은 제한을 소모하지 않습니다',false,false,'d'.repeat(64),null]);
  await asRole('authenticated',deputy);
  await assert.rejects(db.query('select public.moderate_post($1,5,$2,false,false,$3,$4)',[postId,'published','','']), /check constraint/);
});
test('class-wide cap survives new cookies', async () => {
  await asRole('postgres');
  await db.exec("update private.submission_limits set used=100 where bucket='global'");
  await asRole('service_role');
  await assert.rejects(db.query('select public.submit_post($1,$2,$3,$4,$5,$6,$7)', ['질문','정상 제목','전체 제출 한도를 검증합니다',false,false,'e'.repeat(64),null]), /board_busy/);
});
test('input rejects identity fields, old public visibility and invalid lengths', () => {
  const value = {category:'기타',title:'좋은 생각',content:'우리 반을 위한 의견',teacher_requested:false,reply_requested:true};
  assert.equal(postInput.safeParse(value).success,true);
  for (const extra of [{email:'student@example.com'},{name:'name'},{visibility:'public'},{content:'a'.repeat(2001)},{website:'spam'}]) assert.equal(postInput.safeParse({...value,...extra}).success,false);
});
test('signed cooldown cookie rejects tampering/expiration without using IP', () => {
  const secret='test-secret'.repeat(4);const now=1800000000000;
  const token=deviceToken(undefined,secret,now);
  assert.equal(deviceToken(token,secret,now+1000),token);
  assert.notEqual(deviceToken(token+'f',secret,now),token+'f');
  assert.notEqual(deviceToken(token,secret,now+86400001),token);
  assert.match(deviceHash(token,secret),/^[a-f0-9]{64}$/);
});
