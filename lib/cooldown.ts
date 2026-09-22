import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
const lifespan = 24 * 60 * 60 * 1000;
function sign(value: string, secret: string) { return createHmac('sha256', secret).update(value).digest('hex'); }
export function deviceToken(existing: string | undefined, secret: string, now = Date.now()) {
  if (existing) {
    const [id, expires, signature, extra] = existing.split('.');
    const payload = `${id}.${expires}`;
    if (!extra && /^[a-f0-9]{32}$/.test(id ?? '') && /^\d{13}$/.test(expires ?? '') &&
        /^[a-f0-9]{64}$/.test(signature ?? '') && Number(expires) > now && Number(expires) <= now + lifespan &&
        timingSafeEqual(Buffer.from(signature, 'hex'), Buffer.from(sign(payload, secret), 'hex'))) return existing;
  }
  const payload = `${randomBytes(16).toString('hex')}.${now + lifespan}`;
  return `${payload}.${sign(payload, secret)}`;
}
export function deviceHash(token: string, secret: string) { return sign(token.split('.')[0], secret); }
