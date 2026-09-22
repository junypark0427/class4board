import { notFound } from 'next/navigation';
// Reserved legacy route. No query is made; student content is never public.
export default function DisabledPublicDetail() { notFound(); }
