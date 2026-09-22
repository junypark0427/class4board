import { NextRequest, NextResponse } from 'next/server';
import { createHash } from 'node:crypto';
import { configured, database } from '@/lib/server';
export const dynamic = 'force-dynamic';
export async function POST(req: NextRequest) {
  const respond = (body: object, status = 200) => NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store' } });
  if (!configured()) return respond({ error: '건의함을 준비 중이에요.' }, 503);
  if (req.headers.get('origin') !== process.env.APP_ORIGIN) return respond({ error: '건의함에서 다시 시도해주세요.' }, 403);
  if (!req.headers.get('content-type')?.startsWith('application/json')) return respond({ error: '잘못된 요청이에요.' }, 415);
  try {
    const reader = req.body?.getReader();
    if (!reader) return respond({ error: '확인번호를 입력해주세요.' }, 400);
    const chunks: Uint8Array[] = []; let size = 0;
    while (true) { const { done, value } = await reader.read(); if (done) break; size += value.length; if (size > 512) { await reader.cancel(); return respond({ error: '확인번호를 확인해주세요.' }, 400); } chunks.push(value); }
    const body = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    if (typeof body.receipt !== 'string' || !/^[a-f0-9]{64}$/.test(body.receipt)) return respond({ error: '확인번호 64자리를 그대로 입력해주세요.' }, 400);
    const { data, error } = await database(true).rpc('lookup_result', { p_receipt_hash: createHash('sha256').update(body.receipt).digest('hex') });
    if (error) return respond({ error: '잠시 후 다시 확인해주세요.' }, 503);
    if (!data?.length) return respond({ error: '일치하는 확인번호를 찾을 수 없어요.' }, 404);
    return respond({ result: data[0] });
  } catch { return respond({ error: '확인번호를 다시 확인해주세요.' }, 400); }
}
