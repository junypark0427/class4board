import Link from 'next/link';

export default function HomePage() {
  return <div className="home-page">
    <div className="home-intro"><p className="eyebrow">OUR CLASS, OUR VOICES</p><h1>사랑하는 4반<br/><span>익명 게시판</span></h1><p className="lead">편하게 마음을 전하고, 좋은 말을 함께 나누는 공간이에요.</p></div>
    <div className="home-choices">
      <Link className="home-choice" href="/suggestions"><span className="home-emoji" aria-hidden="true">💌</span><span className="tag">반장·부반장에게만</span><h2>익명 건의함</h2><p>건의사항과 고민을 익명으로 전달해요. 내용은 관리자만 확인합니다.</p><span className="home-arrow">의견 보내기 →</span></Link>
      <Link className="home-choice message-choice" href="/board"><span className="home-emoji" aria-hidden="true">💬</span><span className="tag">우리 반과 함께</span><h2>4반 한마디</h2><p>응원, 좋은 말, 함께 나누고 싶은 이야기를 익명으로 올려요. 관리자 확인 후 공개됩니다.</p><span className="home-arrow">한마디 보러 가기 →</span></Link>
    </div>
    <p className="home-note">두 공간 모두 이름이나 이메일을 묻지 않아요. 다른 친구의 개인정보도 적지 말아주세요.</p>
  </div>;
}
