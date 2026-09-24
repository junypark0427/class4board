import type { Metadata } from 'next';
import Link from 'next/link';
import './globals.css';
export const metadata: Metadata = {
  title: '사랑하는 4반 익명 게시판', description: '우리 반의 작은 생각이 모이는 곳',
  robots: { index: false, follow: false }
};
export default function Layout({ children }: { children: React.ReactNode }) {
  return <html lang="ko"><body>
    <a className="skip" href="#main">본문으로 바로 가기</a>
    <header className="header"><div className="header-inner">
      <Link href="/" className="brand"><span className="brand-icon" aria-hidden="true">4</span><span>사랑하는 4반<span className="brand-sub">우리 반 익명 건의함</span></span></Link>
      <nav aria-label="주 메뉴"><Link href="/board">게시판</Link><Link href="/result">결과 확인</Link><Link className="admin-link" href="/admin">관리자</Link></nav>
    </div></header>
    <main id="main">{children}</main>
    <footer><span>서로의 마음을 조금 더 가까이.</span><Link href="/privacy">익명성·이용 안내</Link><span>사랑하는 4반</span></footer>
  </body></html>;
}
