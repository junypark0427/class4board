'use client';
export default function ErrorPage({ reset }: { reset: () => void }) { return <div className="narrow empty" role="alert"><h1>잠시 연결이 어려워요</h1><p>조금 후 다시 시도해주세요.</p><button className="button primary" onClick={reset}>다시 시도</button></div>; }
