'use client';
import { useState, type FormEvent } from 'react';
import Link from 'next/link';
import { classMessageInput } from '@/lib/shared';

export default function MessageForm({ ready }: { ready: boolean }) {
  const [length, setLength] = useState(0);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (busy || !ready) return;
    const fields = new FormData(event.currentTarget);
    const parsed = classMessageInput.safeParse({ content: fields.get('content'), website: fields.get('website') });
    if (!parsed.success) { setError(parsed.error.issues[0].message); return; }
    setBusy(true); setError('');
    try {
      const response = await fetch('/api/board', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(parsed.data) });
      const result = await response.json();
      if (!response.ok) setError(result.error ?? '다시 시도해주세요.');
      else setDone(true);
    } catch { setError('연결이 잠시 끊겼어요. 제출됐을 수도 있으니 바로 다시 보내지 말고 잠시 기다려주세요.'); }
    finally { setBusy(false); }
  }
  if (done) return <div className="form-panel success" role="status"><span className="success-mark">✓</span><h2>한마디 고마워요!</h2><p>관리자 확인 후 게시됩니다.</p><Link className="button primary" href="/board">게시판으로 돌아가기</Link></div>;
  return <form className="form-panel" onSubmit={submit}><span className="tag">이름 없이, 마음만</span><h2>전하고 싶은 말을 적어주세요</h2><p className="subtle">제출 즉시 공개되지 않고 반장과 부반장이 먼저 확인해요.</p>
    {!ready && <p className="notice" role="status">연결을 준비 중이에요. 지금은 제출할 수 없어요.</p>}
    <label className="field">한마디<textarea name="content" required minLength={2} maxLength={500} rows={7} placeholder="오늘 힘이 되는 말, 친구에게 전할 응원, 마음에 남은 이야기를 적어주세요." onChange={event => setLength(event.target.value.length)}/><span className="counter">{length} / 500</span></label>
    <label className="honeypot" aria-hidden="true">웹사이트<input name="website" tabIndex={-1} autoComplete="off"/></label>
    <p className="form-rule">이름·이메일·학생 번호는 묻지 않아요. 친구의 개인정보도 적지 말아주세요.</p>
    {error && <p className="error" role="alert">{error}</p>}
    <button className="button primary full" disabled={!ready || busy}>{busy ? '보내는 중…' : '익명으로 한마디 보내기'}</button>
    <p className="under-button">관리자 승인 후 4반 한마디에 공개돼요.</p>
  </form>;
}
