import Link from 'next/link';
import { database } from '@/lib/server';
import { categories, dateLabel, statusLabels, type PublicPost } from '@/lib/shared';

export const dynamic = 'force-dynamic';

type BoardPageProps = {
  searchParams: Promise<{ category?: string | string[] }>;
};

export default async function BoardPage({ searchParams }: BoardPageProps) {
  const requested = (await searchParams).category;
  const category = typeof requested === 'string' && categories.includes(requested as (typeof categories)[number])
    ? requested
    : '';
  let posts: PublicPost[] = [];
  let unavailable = false;

  try {
    let query = database()
      .from('published_posts')
      .select('post_id,category,title,content,status,reply,created_at,published_at,updated_at')
      .order('created_at', { ascending: false })
      .limit(100);
    if (category) query = query.eq('category', category);
    const { data, error } = await query;
    if (error) unavailable = true;
    else posts = (data ?? []) as PublicPost[];
  } catch {
    unavailable = true;
  }

  return <div className="board-page">
    <header className="board-hero">
      <p className="eyebrow">CLASS 4 · OPEN BOARD</p>
      <h1>우리 반 익명 게시판</h1>
      <p>반장과 부반장이 확인하고 공개를 승인한 의견만 볼 수 있어요.<br/>작성자의 정보와 관리자 메모는 공개되지 않아요.</p>
      <Link className="button primary" href="/write">익명으로 의견 보내기</Link>
    </header>

    <nav className="category-filter" aria-label="게시판 카테고리">
      <Link className={!category ? 'active' : ''} href="/board">전체</Link>
      {categories.map(item => <Link className={category === item ? 'active' : ''} key={item} href={`/board?category=${encodeURIComponent(item)}`}>{item}</Link>)}
    </nav>

    {unavailable ? <div className="empty board-empty"><h2>게시판을 불러오지 못했어요</h2><p>잠시 후 다시 확인해주세요.</p></div>
      : posts.length === 0 ? <div className="empty board-empty"><h2>{category ? `${category} 글이 아직 없어요` : '공개된 글이 아직 없어요'}</h2><p>관리자가 확인하고 공개한 의견이 이곳에 표시돼요.</p></div>
      : <section className="board-list" aria-label="공개된 익명 의견">
        {posts.map(post => <article className="board-card" key={post.post_id}>
          <div className="post-meta"><span className="tag">{post.category}</span><time dateTime={post.created_at}>{dateLabel(post.created_at)}</time></div>
          <h2>{post.title}</h2>
          <p className="prose">{post.content}</p>
          <div className="board-card-footer"><span className={`status status-${post.status}`}>{statusLabels[post.status]}</span><span>익명</span></div>
          {post.reply && <div className="public-reply"><strong>반장·부반장 답변</strong><p className="prose">{post.reply}</p></div>}
        </article>)}
      </section>}
  </div>;
}
