import Link from 'next/link';
import { database } from '@/lib/server';
import { dateLabel, type ClassMessage } from '@/lib/shared';

export const dynamic = 'force-dynamic';

export default async function BoardPage() {
  let messages: Pick<ClassMessage, 'id' | 'content' | 'created_at'>[] = [];
  let unavailable = false;
  try {
    const { data, error } = await database().from('class_messages')
      .select('id,content,created_at').eq('moderation_state', 'approved').eq('hidden', false)
      .order('created_at', { ascending: false }).limit(100);
    if (error) unavailable = true;
    else messages = data ?? [];
  } catch { unavailable = true; }
  return <div className="message-board-page">
    <header className="message-board-hero"><p className="eyebrow">CLASS 4 · KIND WORDS</p><h1>4반 한마디 <span aria-hidden="true">💬</span></h1><p>우리 반 친구들이 나누는 생각과 응원을 만나보세요.<br/>반장과 부반장이 확인한 글만 보여요.</p><Link className="button primary" href="/board/write">익명으로 한마디 쓰기</Link></header>
    {unavailable ? <div className="empty board-empty"><h2>한마디를 불러오지 못했어요</h2><p>잠시 후 다시 방문해주세요.</p></div>
      : !messages.length ? <div className="empty board-empty"><h2>아직 공개된 한마디가 없어요</h2><p>첫 이야기를 남겨보세요. 관리자 확인 후 이곳에 나타나요.</p></div>
      : <section className="message-grid" aria-label="승인된 4반 한마디">{messages.map(message => <article className="message-card" key={message.id}><p>{message.content}</p><div><span>익명</span><time dateTime={message.created_at}>{dateLabel(message.created_at)}</time></div></article>)}</section>}
  </div>;
}
