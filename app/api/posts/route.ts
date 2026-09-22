import { NextRequest, NextResponse } from 'next/server';
import { configured, database } from '@/lib/server';
import { postInput } from '@/lib/shared';
import { deviceToken, deviceHash } from '@/lib/cooldown';
import { createHash, randomBytes } from 'node:crypto';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  if (!configured()) return NextResponse.json({ error: '게시판을 준비 중이에요. 아직 글을 저장할 수 없어요.' }, { status: 503 });
  if (request.headers.get('origin') !== process.env.APP_ORIGIN) return NextResponse.json({ error: '게시판에서 다시 시도해주세요.' }, { status: 403 });
  if (!request.headers.get('content-type')?.startsWith('application/json')) return NextResponse.json({ error: '잘못된 요청이에요.' }, { status: 415 });
  // Count streamed bytes too: Content-Length is untrusted and may be omitted.
  const reader = request.body?.getReader();
  if (!reader) return NextResponse.json({ error: '내용을 입력해주세요.' }, { status: 400 });
  let size = 0;
  const chunks: Uint8Array[] = [];
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 16000) { await reader.cancel(); return NextResponse.json({ error: '글이 너무 길어요.' }, { status: 413 }); }
      chunks.push(value);
    }
    const parsed = postInput.safeParse(JSON.parse(Buffer.concat(chunks).toString('utf8')));
    if (!parsed.success) return NextResponse.json({ error: '분류와 글의 길이를 확인해주세요. 제목 2~80자, 내용 5~2,000자예요.' }, { status: 400 });
    const secret = process.env.COOLDOWN_SECRET!;
    const token = deviceToken(request.cookies.get('board_cooldown')?.value, secret);
    const p = parsed.data;
    const receipt = p.reply_requested ? randomBytes(32).toString('hex') : null;
    const { error } = await database(true).rpc('submit_post', {
      p_category: p.category, p_title: p.title, p_content: p.content,
      p_teacher_requested: p.teacher_requested, p_reply_requested: p.reply_requested,
      p_device_hash: deviceHash(token, secret),
      p_receipt_hash: receipt ? createHash('sha256').update(receipt).digest('hex') : null
    });
    const throttled = error?.message.includes('cooldown') || error?.message.includes('board_busy');
    const response = error
      ? NextResponse.json({ error: throttled ? '잠시 쉬었다가 다시 보내주세요. 연속 제출은 1분 뒤에 가능해요. 게시판이 붐비면 조금 더 기다려주세요.' : '저장하지 못했어요. 잠시 후 다시 시도해주세요.' }, { status: throttled ? 429 : 503 })
      : NextResponse.json({ ok: true, receipt }, { status: 201 });
    response.headers.set('Cache-Control', 'no-store');
    if (throttled) response.headers.set('Retry-After', '60');
    response.cookies.set('board_cooldown', token, { httpOnly: true, sameSite: 'strict', secure: process.env.NODE_ENV === 'production', path: '/', maxAge: 86400 });
    return response;
  } catch {
    return NextResponse.json({ error: '요청을 처리하지 못했어요. 입력 내용을 확인하고 다시 시도해주세요.' }, { status: 400 });
  }
}
