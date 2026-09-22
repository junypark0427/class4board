import Link from 'next/link';
export default function NotFound() { return <div className="narrow empty"><h1>공개된 글은 없어요</h1><p>의견은 반장·부반장만 확인해요. 내 처리 결과는 비밀 확인번호로 확인해주세요.</p><Link className="button primary" href="/">건의함으로</Link></div>; }
