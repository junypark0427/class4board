import Link from 'next/link';
import { configured } from '@/lib/server';
import WriteForm from './write-form';
export const dynamic = 'force-dynamic';
export default function WritePage() {
  return <div className="student-layout"><section className="student-intro"><p className="eyebrow">A LITTLE NOTE, A BETTER CLASS</p><h1>사랑하는 4반<br/><span>익명 게시판</span><span className="heart" aria-hidden="true">♥</span></h1><p className="lead">우리 반이 조금 더 좋아지는 생각,<br/>이름 없이 편하게 들려주세요.</p><div className="intro-note"><strong>제출한 글은 먼저 비공개로 검토해요.</strong><p>반장과 부반장이 확인한 뒤, 문제없는 글만 익명 게시판에 공개할 수 있어요.</p></div><ol className="steps"><li><span>01</span>마음 편히 의견 남기기</li><li><span>02</span>반장·부반장이 함께 확인하기</li><li><span>03</span>승인된 의견은 익명으로 공개하기</li></ol><Link className="text-link" href="/board">승인된 의견 보기 →</Link><p className="subtle desktop-note">말하기 어려웠던 것도 괜찮아요.<br/>서로를 존중하는 마음으로 적어주세요.</p></section><section className="student-form" aria-label="의견 제출"><WriteForm ready={configured()}/></section></div>;
}
