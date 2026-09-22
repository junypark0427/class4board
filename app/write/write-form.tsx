'use client';
import { useState, type FormEvent } from 'react';
import Link from 'next/link';
import { categories, postInput } from '@/lib/shared';
export default function WriteForm({ ready }: { ready: boolean }) {
  const [length, setLength] = useState(0);
  const [titleLength, setTitleLength] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);
  const [receipt, setReceipt] = useState('');
  const [copied, setCopied] = useState(false);
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); if (busy || !ready) return;
    setError('');
    const fd = new FormData(e.currentTarget);
    const parsed = postInput.safeParse({ category: fd.get('category'), title: fd.get('title'), content: fd.get('content'), teacher_requested: fd.get('teacher_requested') === 'on', reply_requested: fd.get('reply_requested') === 'on', website: fd.get('website') });
    if (!parsed.success) { setError(parsed.error.issues[0].message); return; }
    setBusy(true);
    try {
      const res = await fetch('/api/posts', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(parsed.data) });
      const result = await res.json();
      if (!res.ok) setError(result.error ?? '다시 시도해주세요.');
      else { setReceipt(result.receipt ?? ''); setDone(true); }
    } catch { setError('연결이 잠시 끊겼어요. 제출이 완료되었을 수도 있으니 바로 반복해서 보내지 말고 잠시 기다려주세요.'); }
    finally { setBusy(false); }
  }
  if (done) return <section className="form-panel success" role="status"><span className="success-mark">✓</span><p className="eyebrow">THANK YOU FOR YOUR VOICE</p><h2>소중한 의견 고마워요.<br/>반장과 부반장이 확인할게요.</h2><p>다른 학생들에게는 공개되지 않아요.</p>{receipt && <div className="receipt-box"><h3>나만의 비밀 확인번호</h3><p>이 번호로 처리 상태와 답변을 확인할 수 있어요.<br/>다시 발급할 수 없으니 안전하게 보관해주세요.</p><code className="receipt">{receipt}</code><button className="button secondary" onClick={async () => { try { await navigator.clipboard.writeText(receipt); setCopied(true); } catch { setCopied(false); } }}>{copied ? '복사했어요' : '확인번호 복사'}</button><p className="helper">번호를 아는 사람은 결과를 볼 수 있어요. 친구에게 공유하지 마세요.</p><Link className="text-link" href="/result">처리 결과 확인하기 ↗</Link></div>}<a className="button primary" href="/">처음으로</a></section>;
  return <form className="form-panel" onSubmit={submit}>
    <div className="form-heading"><span className="tag">익명으로 전달돼요</span><h2>어떤 마음을 전할까요?</h2><p>작은 의견도 괜찮아요. 편하게 적어주세요.</p></div>
    {!ready && <p className="notice" role="status">건의함 연결을 준비 중이에요. 지금은 화면을 살펴볼 수 있고, 아직 제출은 할 수 없어요.</p>}
    <label className="field">어떤 이야기인가요?<select name="category" required defaultValue="건의사항">{categories.map(c => <option key={c}>{c}</option>)}</select></label>
    <label className="field">제목<input name="title" required minLength={2} maxLength={80} placeholder="전하고 싶은 생각을 한 줄로 적어주세요" onChange={e => setTitleLength(e.target.value.length)}/><span className="counter">{titleLength} / 80</span></label>
    <label className="field">내용<textarea name="content" required minLength={5} maxLength={2000} rows={6} placeholder="어떤 점이 좋았나요? 무엇이 달라지면 좋을까요? 이름이나 연락처 같은 개인정보는 적지 말아주세요." onChange={e => setLength(e.target.value.length)}/><span className="counter">{length} / 2,000</span></label>
    <div className="choices"><label className="check"><input type="checkbox" name="teacher_requested"/><span><strong>선생님께 전달되면 좋겠어요</strong><small>반장·부반장이 내용을 확인하고 전달 여부를 판단해요.</small></span></label><label className="check"><input type="checkbox" name="reply_requested"/><span><strong>답변이나 처리 결과를 확인하고 싶어요</strong><small>제출 후 받는 비밀 확인번호로 나중에 확인할 수 있어요.</small></span></label></div>
    <label className="honeypot" aria-hidden="true">웹사이트<input name="website" tabIndex={-1} autoComplete="off"/></label>
    <p className="form-rule">이름·이메일을 입력하지 않아요. 다른 친구의 개인정보도 적지 말아주세요.</p>
    {error && <p className="error" role="alert">{error}</p>}
    <button className="button primary full" disabled={!ready || busy}>{busy ? '마음을 전하는 중…' : '익명으로 의견 보내기'}<span aria-hidden="true">↗</span></button>
    <p className="under-button">보낸 의견은 반장과 부반장만 확인할 수 있어요.</p>
  </form>;
}
