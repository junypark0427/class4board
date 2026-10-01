'use client';
import { useCallback, useEffect, useState } from 'react';
import { browserDatabase } from '@/lib/browser';
import { dateLabel, type ClassMessage } from '@/lib/shared';

type Action = { id: number; actor_name: string; created_at: string; changes: { moderation_state?: [string, string]; hidden?: boolean } };
const labels = { pending: '승인 대기', approved: '공개 중', rejected: '승인 거절' };

export default function ClassMessagesAdmin() {
  const [filter, setFilter] = useState<'pending' | 'approved' | 'rejected' | 'hidden'>('pending');
  const [items, setItems] = useState<ClassMessage[]>([]);
  const [selected, setSelected] = useState<ClassMessage | null>(null);
  const [actions, setActions] = useState<Action[]>([]);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const load = useCallback(async () => {
    const db = browserDatabase(); if (!db) return;
    setLoading(true); setError('');
    let query = db.from('class_messages').select('*').order('created_at', { ascending: false }).limit(100);
    query = filter === 'hidden' ? query.eq('hidden', true) : query.eq('hidden', false).eq('moderation_state', filter);
    const { data, error: readError } = await query;
    if (readError) { setItems([]); setError('한마디를 불러오지 못했어요. 관리자 권한과 SQL 마이그레이션을 확인해주세요.'); }
    else setItems((data ?? []) as ClassMessage[]);
    setLoading(false);
  }, [filter]);
  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    if (!selected) { setActions([]); return; }
    let alive = true;
    browserDatabase()!.from('class_message_actions').select('id,actor_name,created_at,changes')
      .eq('message_id', selected.id).order('created_at', { ascending: false }).limit(30)
      .then(({ data }) => { if (alive) setActions((data ?? []) as Action[]); });
    return () => { alive = false; };
  }, [selected]);
  async function moderate(state: ClassMessage['moderation_state'], hidden: boolean) {
    if (!selected || busy) return;
    setBusy(true); setError('');
    try {
      const { error: saveError } = await browserDatabase()!.rpc('moderate_class_message', {
        p_id: selected.id, p_version: selected.version, p_state: state, p_hidden: hidden
      });
      if (saveError) setError(saveError.message.includes('conflict_reload') ? '다른 관리자가 먼저 수정했어요. 새로고침한 뒤 다시 선택해주세요.' : '변경하지 못했어요. 관리자 권한과 연결을 확인해주세요.');
      else { setSelected(null); await load(); }
    } catch { setError('연결을 확인하고 다시 시도해주세요.'); }
    finally { setBusy(false); }
  }
  return <div className="class-admin"><div className="class-admin-filters" role="group" aria-label="한마디 필터">{(['pending','approved','rejected','hidden'] as const).map(value => <button className={filter === value ? 'active' : ''} key={value} onClick={() => { setFilter(value); setSelected(null); }}>{value === 'hidden' ? '숨긴 글' : labels[value]}</button>)}<button onClick={() => void load()}>새로고침</button></div>
    {error && <p className="error" role="alert">{error}</p>}
    <div className="admin-workspace"><section aria-label="4반 한마디 목록"><h2 className="list-heading">{filter === 'hidden' ? '숨긴 글' : labels[filter]} <span className="count">{items.length}</span></h2>{loading ? <p role="status">불러오는 중…</p> : !items.length ? <div className="empty"><h3>아직 해당하는 글이 없어요</h3></div> : <div className="inbox-list">{items.map(item => <button key={item.id} className={`inbox-item ${selected?.id === item.id ? 'active' : ''}`} onClick={() => setSelected(item)}><span className="post-meta"><span className="status">{labels[item.moderation_state]}{item.hidden ? ' · 숨김' : ''}</span><time dateTime={item.created_at}>{dateLabel(item.created_at)}</time></span><span className="excerpt message-excerpt">{item.content}</span></button>)}</div>}</section>
    {selected ? <section className="form-panel editor" aria-label="한마디 상세"><div className="post-meta"><span className="tag">4반 한마디</span><button className="text-button" onClick={() => setSelected(null)}>닫기 ✕</button></div><p className="subtle">{new Date(selected.created_at).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })} · 익명</p><p className="prose opinion-content">{selected.content}</p><p className="subtle">현재: {labels[selected.moderation_state]}{selected.hidden ? ' · 숨김' : ''}</p><div className="moderation-buttons"><button className="button primary" disabled={busy} onClick={() => void moderate('approved', false)}>공개 승인</button>{selected.moderation_state === 'approved' && <button className="button secondary" disabled={busy} onClick={() => void moderate('pending', false)}>공개 취소</button>}<button className="button secondary" disabled={busy} onClick={() => void moderate('rejected', false)}>승인 거절</button><button className="button secondary" disabled={busy} onClick={() => void moderate(selected.moderation_state, true)}>숨김</button>{selected.hidden && <button className="button secondary" disabled={busy} onClick={() => void moderate('pending', false)}>숨김 해제·재검토</button>}</div><div className="audit"><h3>관리자 작업 기록</h3>{!actions.length ? <p className="subtle">아직 변경 기록이 없어요.</p> : <ul>{actions.map(action => <li key={action.id}><strong>{action.actor_name}</strong><span>{action.changes.moderation_state && `${labels[action.changes.moderation_state[0] as keyof typeof labels]} → ${labels[action.changes.moderation_state[1] as keyof typeof labels]}`}{action.changes.hidden !== undefined && (action.changes.hidden ? ' · 숨김' : ' · 숨김 해제')}</span><time>{new Date(action.created_at).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })}</time></li>)}</ul>}</div></section> : <div className="editor-placeholder"><h2>한마디를 선택해주세요</h2><p>내용을 읽고 공개 여부를 결정할 수 있어요.</p></div>}</div>
  </div>;
}
