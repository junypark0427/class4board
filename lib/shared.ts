import { z } from 'zod';

export const categories = ['건의사항', '질문', '불편사항', '행사 아이디어', '칭찬·감사', '기타'] as const;
export const postInput = z.object({
  category: z.enum(categories),
  title: z.string().trim().min(2, '제목은 2자 이상 적어주세요.').max(80, '제목은 80자까지 쓸 수 있어요.'),
  content: z.string().trim().min(5, '내용은 5자 이상 적어주세요.').max(2000, '내용은 2,000자까지 쓸 수 있어요.'),
  teacher_requested: z.boolean(),
  reply_requested: z.boolean(),
  website: z.string().max(0).optional()
}).strict();

export type Post = {
  id: string; category: string; title: string; content: string;
  teacher_requested: boolean; reply_requested: boolean;
  status: 'unread' | 'reviewed' | 'forwarded' | 'completed';
  hidden: boolean; admin_note: string; reply: string;
  created_at: string; updated_at: string; version: number;
};
export const statusLabels = { unread: '미확인', reviewed: '확인 완료', forwarded: '선생님께 전달', completed: '처리 완료' };
export function dateLabel(date: string) {
  return new Intl.DateTimeFormat('ko-KR', { month: 'long', day: 'numeric', timeZone: 'Asia/Seoul' }).format(new Date(date));
}
