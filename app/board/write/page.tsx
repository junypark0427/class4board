import Link from 'next/link';
import { configured } from '@/lib/server';
import MessageForm from './message-form';

export const dynamic = 'force-dynamic';
export default function BoardWritePage() {
  return <div className="narrow"><Link className="back" href="/board">← 4반 한마디로 돌아가기</Link><div className="message-write-intro"><p className="eyebrow">A NOTE FOR CLASS 4</p><h1>우리 반에 한마디 남겨요</h1><p className="lead">응원이나 칭찬, 함께 나누고 싶은 작은 이야기를 적어주세요.</p></div><MessageForm ready={configured()}/></div>;
}
