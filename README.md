# 사랑하는 4반 익명 게시판

두 공간을 운영합니다. **익명 건의함**은 학생이 보낸 의견을 반장·부반장만 읽고 처리합니다. **4반 한마디**는 짧은 익명 글을 관리자가 확인한 뒤 승인한 것만 공개합니다. 댓글·좋아요·학생 계정은 없습니다.

## 화면

| 주소 | 기능 |
|---|---|
| `/` | 두 공간 선택 |
| `/suggestions` | 비공개 익명 건의함 제출 (`/write`도 기존 링크로 유지) |
| `/result` | 건의함 비밀 확인번호로 처리 상태·답변 조회 |
| `/board` | 승인된 4반 한마디 카드 목록 |
| `/board/write` | 익명 한마디 제출, 관리자 승인 전 비공개 |
| `/admin` | 반장·부반장 로그인, 건의함 처리와 한마디 승인 |

## 로컬 실행

Node.js 22 이상과 pnpm 11이 필요합니다.

```sh
cd /Users/parkjunhoo/Documents/Projects/class4board
pnpm install --frozen-lockfile
cp .env.example .env.local
# .env.local에 실제 프로젝트 설정을 입력합니다. 파일은 Git에 포함되지 않습니다.
pnpm dev
```

연결 값이 없으면 화면은 볼 수 있지만 제출과 로그인이 비활성화됩니다. 가짜 저장 성공을 표시하지 않습니다.

## Supabase 데이터베이스

기존 운영 DB는 **001, 002를 다시 실행하지 마세요.** Supabase 프로젝트의 **SQL Editor → New query**에서 [`supabase/migrations/003_class_messages.sql`](supabase/migrations/003_class_messages.sql) 전체를 붙여넣고 한 번 실행합니다. 기존 `posts`, `admin_actions`, 비밀 확인번호, 과거 공개 사본은 삭제하지 않습니다. 003은 기존 건의함 공개 사본의 익명 읽기 권한을 제거하고, `class_messages`와 별도 작업 기록·RLS·제출/관리 함수를 추가합니다. 앱 배포 전에 적용하는 것이 좋습니다.

새 Supabase 프로젝트를 처음부터 만드는 경우에는 `001_suggestion_box.sql` → `002_admin_approved_board.sql` → `003_class_messages.sql` 순서로 실행합니다. Data API에 `private` 스키마를 노출하지 말고, **Authentication → Providers**에서 공개 회원가입과 익명 Auth 가입을 끕니다. 학생은 Supabase Auth를 사용하지 않습니다.

반장과 부반장은 **Authentication → Users → Add user**에서 서로 다른 이메일·비밀번호로 각각 생성하고 이메일 확인을 완료합니다. 두 User UID를 아래 SQL로 등록합니다. 비밀번호는 SQL이나 Git에 넣지 않습니다.

```sql
insert into public.admin_members (user_id, display_name)
values
  ('반장_USER_UID', '반장'),
  ('부반장_USER_UID', '부반장')
on conflict (user_id) do update set display_name = excluded.display_name;
```

두 계정은 동일한 권한을 가집니다. 이메일이나 Auth 로그인만으로 관리자 권한이 생기지 않고, DB가 `auth.uid()`와 `admin_members.user_id`의 일치를 검사합니다. 비밀번호가 맞는데 로그인이 안 되면 **Authentication → Users**의 이메일 확인 상태, **Providers → Email** 활성화 상태, Netlify의 `SUPABASE_URL`/`SUPABASE_PUBLISHABLE_KEY`가 같은 Supabase 프로젝트의 값인지 확인하세요. 로컬 개발 모드의 브라우저 Console에는 `[admin-auth]` 코드·상태만 진단용으로 표시됩니다. 운영 화면은 일반 오류 문구를 유지합니다.

## 환경 변수

`.env.example`의 다섯 변수만 사용합니다.

| 변수 | 용도 |
|---|---|
| `SUPABASE_URL` | Supabase 프로젝트 URL |
| `SUPABASE_PUBLISHABLE_KEY` | 공개 가능한 publishable key 또는 legacy anon key |
| `DATABASE_ADMIN_KEY` | **서버 전용** Supabase secret/service role key |
| `COOLDOWN_SECRET` | **서버 전용** 32자 이상의 무작위 문자열 |
| `APP_ORIGIN` | 실제 사이트 origin, 예: `https://class4board.netlify.app` (끝 `/` 없음) |

서버는 URL과 공개 키 형식을 확인한 뒤 두 값만 관리자 클라이언트에 전달합니다. `DATABASE_ADMIN_KEY`, `COOLDOWN_SECRET` 및 비밀번호에 `NEXT_PUBLIC_` 접두어를 붙이지 마세요. `.env.local`과 빌드 산출물은 `.gitignore`에서 제외됩니다. 비밀 키는 `lib/server.ts`의 server-only 모듈에서만 읽습니다.

## 접근 권한과 운영

- 익명 건의함은 `/api/posts`가 길이·출처·도배 제한을 확인한 뒤 서버 전용 키로 `submit_post`를 호출합니다. 학생은 `posts`, `published_posts`, 관리자 메모·작업 기록을 직접 읽을 권한이 없습니다. 비밀 확인번호로는 상태·작성자용 답변·수정 시각만 조회합니다.
- 4반 한마디는 `/api/board`가 같은 출처·길이·1분 간격 제한을 확인하고 서버 전용 키로 `submit_class_message`를 호출합니다. 글에는 작성자 이름·이메일·학생 번호·IP 컬럼이 없습니다. 기본 상태는 `pending`입니다.
- 익명 사용자의 `class_messages` 직접 조회는 DB RLS가 `approved`이면서 숨기지 않은 행만 반환합니다. 승인 전 글·거절 글·숨긴 글·작업 기록은 읽을 수 없습니다. 브라우저 직접 INSERT/UPDATE/DELETE 권한도 없습니다.
- `/admin`은 로그인 화면 주소이므로 URL 자체는 열립니다. 관리 데이터는 등록된 관리자만 RLS를 통과합니다. `moderate_class_message`와 기존 `moderate_post`도 함수 안에서 관리자 UID를 다시 확인하며, 변경자를 기록하고 동시 수정 충돌을 거부합니다.
- 건의함의 처리 상태(`미확인 → 확인 완료 → 선생님께 전달 → 처리 완료`)와 관리자 메모·숨김·결과 확인은 유지됩니다. ‘선생님께 전달’은 실제 전달 후 관리자가 기록하며 자동 전송하지 않습니다. 과거 건의함 공개 데이터는 보존하지만 003 이후 학생에게 공개하지 않습니다.
- 4반 한마디 관리자는 승인 대기·공개 중·거절·숨김 목록을 보고 공개 승인, 공개 취소, 거절, 숨김·해제를 할 수 있습니다. 공개 취소 즉시 익명 조회에서 빠집니다. 실제 삭제 기능은 제공하지 않아 감사 기록이 남습니다.
- 앱은 학생 신원과 IP를 저장하지 않습니다. 무작위 쿠키의 해시를 별도 제한 테이블에 잠시 보관해 도배를 줄입니다. 호스팅/DB 업체의 인프라 로그는 별도일 수 있습니다. 개인정보나 비방은 글에 적지 않도록 안내합니다.

## Netlify 배포

저장소 `origin/main`을 Netlify에 연결합니다. `netlify.toml`의 `pnpm build`와 `.next` publish 설정을 사용하고 별도의 Functions directory나 Next.js 플러그인을 수동으로 추가하지 않습니다. **Project configuration → Environment variables**에 위 다섯 값을 설정하고 `APP_ORIGIN`을 실제 Production URL과 일치시킨 뒤 재배포합니다. Route Handler가 있으므로 `output: export`는 사용하지 않습니다. 운영 DB에는 003 SQL을 먼저 적용하세요.

```sh
pnpm test
pnpm typecheck
pnpm build
pnpm test:bundle-security
```

배포 후 학생으로 건의함을 제출해 다른 학생에게 노출되지 않는지, 한마디를 제출해 승인 전 `/board`에 나타나지 않는지 확인하세요. 두 관리자 계정으로 각각 로그인해 승인·취소·숨김과 작업 기록을 확인하고, 로그아웃 상태에서 관리자 데이터 직접 조회도 차단되는지 점검합니다. 자동 테스트는 PGlite에 실제 마이그레이션을 적용해 이 권한을 검사합니다.
