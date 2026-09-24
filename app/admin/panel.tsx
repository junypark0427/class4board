'use client';
import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { browserDatabase, logAdminAuthError } from '@/lib/browser';
import type { BrowserDatabaseConfig } from '@/lib/server';
import { categories, dateLabel, statusLabels, type Post } from '@/lib/shared';
type Action = { id: number; actor_name: string; created_at: string; changes: { status?: [keyof typeof statusLabels, keyof typeof statusLabels]; hidden?: boolean; is_public?: boolean; admin_note_changed?: boolean; reply_changed?: boolean } };
export default function AdminApp({ databaseConfig }: { databaseConfig: BrowserDatabaseConfig | null }) {
  const [phase, setPhase] = useState<'loading'|'login'|'admin'>('loading');
  const [name, setName] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [category, setCategory] = useState(''); const [status, setStatus] = useState('');
  const [hidden, setHidden] = useState('active'); const [page, setPage] = useState(0);
  const [posts, setPosts] = useState<Post[]>([]); const [count, setCount] = useState(0);
  const [selected, setSelected] = useState<Post | null>(null);
  const [loading, setLoading] = useState(false);
  const requestId = useRef(0);
  useEffect(() => {
    const db = browserDatabase(databaseConfig); if (!db) { setPhase('login'); return; }
    let alive = true;
    async function check() {
      try {
        const { data: { user }, error: userError } = await db!.auth.getUser();
        if (!alive) return;
        if (userError) {
          logAdminAuthError('session-validation', userError);
          requestId.current++; setPosts([]); setSelected(null); setPhase('login');
          setMessage('로그인 상태를 확인하지 못했어요. 다시 로그인해주세요.');
          return;
        }
        if (!user) { requestId.current++; setPosts([]); setSelected(null); setPhase('login'); return; }
        const { data, error } = await db!.from('admin_members').select('display_name').eq('user_id',user.id).maybeSingle();
        if (!alive) return;
        if (error || !data) {
          if (error) logAdminAuthError('admin-membership', error);
          else logAdminAuthError('admin-membership', new Error('Authenticated user is not registered in admin_members'));
          requestId.current++; setPosts([]); setSelected(null); setPhase('login'); setMessage('관리자 권한을 확인할 수 없어요. 계정 등록 상태를 확인해주세요.'); await db!.auth.signOut();
        }
        else { setName(data.display_name); setPhase('admin'); }
      } catch (error) { logAdminAuthError('session-check', error); if (alive) { setPhase('login'); setMessage('연결을 확인하고 다시 로그인해주세요.'); } }
    }
    void check();
    const { data: { subscription } } = db.auth.onAuthStateChange(() => { setTimeout(() => { if (alive) void check(); }, 0); });
    return () => { alive = false; subscription.unsubscribe(); };
  }, [databaseConfig]);
  const load = useCallback(async () => {
    const db = browserDatabase(); if (!db) return;
    const id = ++requestId.current; setLoading(true); setMessage('');
    try {
      let query = db.from('posts').select('*', { count: 'exact' });
      if (category) query = query.eq('category',category);
      if (status) query = query.eq('status',status as Post['status']);
      if (hidden !== 'all') query = query.eq('hidden',hidden === 'hidden');
      const { data, count: total, error } = await query.order('created_at',{ ascending:false }).order('id').range(page*20,page*20+19);
      if (id !== requestId.current) return;
      if (error) { setPosts([]); setCount(0); setMessage('의견을 불러오지 못했어요. 새로고침하거나 다시 로그인해주세요.'); }
      else { setPosts((data ?? []) as Post[]); setCount(total ?? 0); }
    } catch { if (id === requestId.current) setMessage('연결을 확인하고 다시 시도해주세요.'); }
    finally { if (id === requestId.current) setLoading(false); }
  }, [category, status, hidden, page]);
  useEffect(() => { if (phase === 'admin') void load(); }, [phase, load]);
  async function login(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); const db = browserDatabase(databaseConfig); if (!db) return;
    const fd = new FormData(e.currentTarget); setBusy(true); setMessage('');
    try {
      const { data, error } = await db.auth.signInWithPassword({ email:String(fd.get('email')).trim(),password:String(fd.get('password')) });
      if (error) {
        logAdminAuthError('password-sign-in', error);
        setMessage('로그인하지 못했어요. 이메일과 비밀번호를 확인하거나 잠시 후 다시 시도해주세요.');
      } else if (!data.session || !data.user) {
        logAdminAuthError('password-sign-in', new Error('Supabase returned no session after sign-in'));
        setMessage('로그인하지 못했어요. 이메일과 비밀번호를 확인하거나 잠시 후 다시 시도해주세요.');
      }
    }
    catch (error) { logAdminAuthError('password-sign-in-request', error); setMessage('연결을 확인하고 다시 시도해주세요.'); } finally { setBusy(false); }
  }
  async function logout() {
    setBusy(true);
    try { const { error } = await browserDatabase()!.auth.signOut(); if (error) { setMessage('로그아웃하지 못했어요. 다시 시도해주세요.'); return; } requestId.current++; setSelected(null); setPosts([]); setPhase('login'); setMessage(''); }
    finally { setBusy(false); }
  }
  if (phase === 'loading') return <div className="narrow empty" role="status">관리자 계정을 확인하고 있어요…</div>;
  if (phase === 'login') return <div className="login-layout"><div><p className="eyebrow">TOGETHER, WE LISTEN</p><h1>친구들의 마음을<br/><span>함께 살펴봐요.</span></h1><p className="lead">반장과 부반장이 함께 쓰는 관리 공간이에요.<br/>각자 계정으로 로그인해주세요.</p><p className="intro-note">두 관리자에게 같은 관리 권한이 있어요.<br/>승인한 의견만 공개되고 관리자 메모는 항상 비공개예요.</p></div><form className="form-panel" onSubmit={login}><span className="tag">반장 · 부반장 전용</span><h2>관리자 로그인</h2>{!databaseConfig && <p className="notice">건의함 연결을 준비 중이에요. 연결 후 로그인할 수 있어요.</p>}<label className="field">관리자 이메일<input type="email" name="email" autoComplete="username" required placeholder="관리자 계정 이메일"/></label><label className="field">비밀번호<input type="password" name="password" autoComplete="current-password" required maxLength={128} placeholder="비밀번호 입력"/></label>{message && <p className="error" role="alert">{message}</p>}<button className="button primary full" disabled={busy || !databaseConfig}>{busy ? '로그인 중…' : '로그인'}</button><p className="helper">학생은 로그인하지 않아도 의견을 보낼 수 있어요.</p></form></div>;
  return <div className="container admin-container"><div className="admin-heading"><div><p className="eyebrow">CLASS 4 · INBOX</p><h1 className="page-title">우리 반의 목소리</h1><p className="subtle">{name}님, 반장·부반장이 함께 확인하는 공간이에요.</p></div><button className="button secondary" onClick={logout} disabled={busy}>로그아웃</button></div>
    <div className="status-guide">미확인 <span>→</span> 확인 완료 <span>→</span> 선생님께 전달 <span>→</span> 처리 완료<small>전달이 필요 없는 의견은 바로 처리 완료로 바꿀 수 있어요.</small></div>
    <div className="admin-filters"><label>카테고리<select value={category} onChange={e=>{setCategory(e.target.value);setPage(0);}}><option value="">전체 카테고리</option>{categories.map(c=><option key={c}>{c}</option>)}</select></label><label>처리 상태<select value={status} onChange={e=>{setStatus(e.target.value);setPage(0);}}><option value="">전체 상태</option>{Object.entries(statusLabels).map(([k,v])=><option key={k} value={k}>{v}</option>)}</select></label><label>표시 범위<select value={hidden} onChange={e=>{setHidden(e.target.value);setPage(0);}}><option value="active">숨김 제외</option><option value="hidden">숨긴 의견</option><option value="all">모든 의견</option></select></label><button className="button secondary" onClick={()=>void load()}>새로고침</button></div>
    {message && <p className="error" role="alert">{message}</p>}
    <div className="admin-workspace"><section aria-label="접수된 의견"><h2 className="list-heading">접수된 의견 <span className="count">{count}</span></h2>{loading ? <p role="status">의견을 불러오는 중…</p> : !posts.length ? <div className="empty"><h3>해당하는 의견이 없어요</h3><p>새 의견이 오면 이곳에서 확인할 수 있어요.</p></div> : <div className="inbox-list">{posts.map(p=><button className={`inbox-item ${selected?.id===p.id?'active':''}`} key={p.id} onClick={()=>setSelected(p)}><span className="post-meta"><span className={`status status-${p.status}`}>{statusLabels[p.status]}</span><time dateTime={p.created_at}>{dateLabel(p.created_at)}</time></span><strong>{p.title}</strong><span className="excerpt">{p.content}</span><span className="inbox-tags">{p.category}{p.is_public?' · 공개 승인':' · 비공개'}{p.teacher_requested && ' · 전달 희망'}{p.reply_requested && ' · 결과 확인 희망'}{p.hidden && ' · 숨김'}</span></button>)}</div>}<nav className="pagination" aria-label="의견 페이지"><button disabled={page===0} onClick={()=>setPage(page-1)}>← 이전</button><span>{page+1} 페이지</span><button disabled={(page+1)*20>=count} onClick={()=>setPage(page+1)}>다음 →</button></nav></section>
      {selected ? <Editor key={`${selected.id}-${selected.version}`} post={selected} onClose={()=>setSelected(null)} onSaved={async()=>{setSelected(null);await load();}}/> : <div className="editor-placeholder"><span aria-hidden="true">↖</span><h2>의견을 선택해주세요</h2><p>내용을 읽고 처리 상태와 공개 여부를 정해주세요.<br/>선생님께 실제로 전달한 뒤 상태를 바꿔주세요.</p></div>}
    </div></div>;
}
function Editor({ post, onClose, onSaved }: { post:Post; onClose:()=>void; onSaved:()=>Promise<void> }) {
  const [status,setStatus] = useState(post.status); const [note,setNote] = useState(post.admin_note);
  const [reply,setReply] = useState(post.reply); const [hidden,setHidden] = useState(post.hidden);
  const [isPublic,setIsPublic] = useState(post.is_public);
  const [busy,setBusy] = useState(false); const [message,setMessage] = useState('');
  const [actions,setActions] = useState<Action[]>([]); const [auditError,setAuditError] = useState(false);
  useEffect(()=>{let alive=true; browserDatabase()!.from('admin_actions').select('id,actor_name,created_at,changes').eq('post_id',post.id).order('created_at',{ascending:false}).limit(30).then(({data,error})=>{if(alive){setActions((data??[]) as Action[]);setAuditError(Boolean(error));}});return()=>{alive=false;};},[post.id]);
  async function save(e:FormEvent) {
    e.preventDefault(); setBusy(true);setMessage('');
    try { const {error}=await browserDatabase()!.rpc('moderate_post',{p_id:post.id,p_version:post.version,p_status:status,p_hidden:hidden,p_is_public:isPublic,p_admin_note:note,p_reply:reply});
      if(error) setMessage(error.message.includes('conflict_reload')?'다른 관리자가 먼저 수정했어요. 작성 내용을 복사해 보관한 뒤 목록을 새로고침하고 이 의견을 다시 선택해주세요.':'저장하지 못했어요. 관리자 권한과 연결을 확인해주세요.');
      else await onSaved();
    } catch {setMessage('연결을 확인하고 다시 시도해주세요.');} finally {setBusy(false);}
  }
  return <section className="form-panel editor" aria-label="의견 상세"><div className="post-meta"><span className="tag">{post.category}</span><button className="text-button" onClick={onClose}>닫기 ✕</button></div><h2>{post.title}</h2><p className="subtle">{new Date(post.created_at).toLocaleString('ko-KR',{timeZone:'Asia/Seoul'})} · 익명</p><p className="prose opinion-content">{post.content}</p><div className="request-badges"><span>{post.teacher_requested?'선생님 전달 희망':'선생님 전달 요청 없음'}</span><span>{post.reply_requested?'결과 확인 희망':'결과 확인 요청 없음'}</span><span>{post.is_public?'공개 승인됨':'비공개'}</span></div><form onSubmit={save}><label className="field">처리 상태<select value={status} onChange={e=>setStatus(e.target.value as Post['status'])}>{Object.entries(statusLabels).map(([k,v])=><option key={k} value={k}>{v}</option>)}</select></label>{status==='forwarded' && <p className="notice">선생님께 실제로 전달했을 때 선택해주세요. 자동으로 전송되지는 않아요.</p>}<label className="check public-check"><input type="checkbox" checked={isPublic} onChange={e=>setIsPublic(e.target.checked)}/><span>익명 게시판 공개 승인<small>승인한 글만 학생 게시판에 보여요. 관리자 메모와 요청 정보는 공개되지 않아요.</small></span></label><label className="field">관리자 메모 <span className="field-hint">반장·부반장만 볼 수 있어요</span><textarea rows={4} maxLength={4000} value={note} onChange={e=>setNote(e.target.value)} placeholder="확인한 내용, 선생님께 전달할 요점 등을 기록해주세요."/></label>{post.reply_requested && <label className="field">작성자에게 전할 답변 <span className="field-hint">비밀 확인번호와 공개 승인된 게시판에서 볼 수 있어요. 개인정보는 적지 마세요.</span><textarea rows={4} maxLength={2000} value={reply} onChange={e=>setReply(e.target.value)} placeholder="어떻게 처리했는지 알려주세요."/></label>}<label className="check"><input type="checkbox" checked={hidden} onChange={e=>setHidden(e.target.checked)}/><span>이 의견 숨기기<small>관리자 기본 목록과 공개 게시판에서 제외돼요. 숨긴 의견 필터로 다시 찾을 수 있어요.</small></span></label>{message && <p className="error" role="alert">{message}</p>}<button className="button primary full" disabled={busy}>{busy?'저장 중…':'변경사항 저장'}</button></form><div className="audit"><h3>관리자 작업 기록</h3><p className="helper">최근 30건 · 메모와 답변의 본문은 기록에 복사하지 않아요.</p>{auditError ? <p className="error">기록을 불러오지 못했어요.</p> : !actions.length ? <p className="subtle">아직 변경 기록이 없어요.</p> : <ul>{actions.map(a=><li key={a.id}><strong>{a.actor_name}</strong><span>{a.changes.status && `${statusLabels[a.changes.status[0]]} → ${statusLabels[a.changes.status[1]]}`}{a.changes.is_public!==undefined && (a.changes.is_public?' · 공개 승인':' · 공개 취소')}{a.changes.hidden!==undefined && (a.changes.hidden?' · 숨김':' · 숨김 해제')}{a.changes.admin_note_changed && ' · 메모 수정'}{a.changes.reply_changed && ' · 답변 수정'}</span><time>{new Date(a.created_at).toLocaleString('ko-KR',{timeZone:'Asia/Seoul'})}</time></li>)}</ul>}</div></section>;
}
