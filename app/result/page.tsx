'use client';
import Link from 'next/link';
import { useState, type FormEvent } from 'react';
import { statusLabels } from '@/lib/shared';
export default function ResultPage() {
  const [busy, setBusy] = useState(false); const [error, setError] = useState('');
  const [result, setResult] = useState<{ status: keyof typeof statusLabels; reply: string; updated_at: string } | null>(null);
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); setBusy(true); setError(''); setResult(null);
    const receipt = String(new FormData(e.currentTarget).get('receipt') ?? '').trim().toLowerCase();
    try { const response = await fetch('/api/result', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ receipt }) }); const data = await response.json(); if (!response.ok) setError(data.error); else setResult(data.result); }
    catch { setError('연결을 확인하고 다시 시도해주세요.'); } finally { setBusy(false); }
  }
  return <div className="narrow"><Link className="back" href="/">← 건의함으로</Link><p className="eyebrow">JUST FOR YOU</p><h1 className="page-title">내 의견, 어떻게 됐을까요?</h1><p className="lead">제출할 때 받은 비밀 확인번호를 입력해주세요.</p><form className="form-panel" onSubmit={submit}><label className="field">비밀 확인번호<input name="receipt" required minLength={64} maxLength={64} autoComplete="off" spellCheck={false} placeholder="64자리 확인번호 붙여넣기"/></label><p className="helper">신원을 수집하지 않아 잃어버린 확인번호는 찾아드릴 수 없어요.</p><button className="button primary full" disabled={busy}>{busy ? '확인 중…' : '처리 결과 확인'}</button>{error && <p className="error" role="alert">{error}</p>}</form>{result && <section className="reply-box" aria-live="polite"><span className="tag">{statusLabels[result.status]}</span><h2>반장·부반장의 안내</h2><p className="prose">{result.reply || '아직 등록된 답변이 없어요. 조금만 기다려주세요.'}</p><p className="subtle">마지막 처리: {new Date(result.updated_at).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })}</p></section>}</div>;
}
