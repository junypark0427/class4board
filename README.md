# 사랑하는 4반 익명 게시판

실제 서비스는 **학생의 의견을 반장·부반장이 함께 확인하는 비공개 익명 건의함**입니다.
학생 글 목록, 공개 상세 글, 댓글, 좋아요는 제공하지 않습니다.

## 현재 상태

- Next.js + TypeScript + Supabase 프로젝트. 학생 폼·결과 확인·관리자 화면·SQL 보안 규칙 구현.
- 실제 Supabase 연결이나 외부 배포는 아직 하지 않았습니다. 계정과 환경 변수 설정이 필요합니다.
- 연결 전에도 화면을 실행할 수 있지만 제출과 로그인은 비활성화됩니다. 가짜 저장 성공을 표시하지 않습니다.
- 최신 설계 변경 내용은 `docs/CHANGELOG.md`, 보안 구조는 `docs/SECURITY.md`를 보세요.

## 1. 화면부터 실행하기

Node.js 22 이상과 pnpm 11을 설치한 다음 터미널에서 실행합니다.

```sh
cd ~/Documents/Projects/class4board
npm install -g pnpm@11.19.0
pnpm install --frozen-lockfile
pnpm dev
```

- 학생 화면: http://localhost:3000
- 관리자 화면: http://localhost:3000/admin
- 비밀 확인번호 조회: http://localhost:3000/result
- 이용 안내: http://localhost:3000/privacy

기존 `node_modules`가 있다면 재설치는 생략할 수 있습니다. 이미 3000번 포트에서 미리보기가 켜져 있다면 해당 미리보기를 종료하고 개발 서버를 실행하세요.

## 2. Supabase 프로젝트 만들기

1. Supabase에서 새 프로젝트를 만듭니다. 이 앱 전용 프로젝트를 권장합니다.
2. SQL Editor에서 [`supabase/migrations/001_suggestion_box.sql`](supabase/migrations/001_suggestion_box.sql) 전체를 그대로 붙여넣어 한 번 실행합니다. 이 파일 하나가 테이블, 인덱스, RLS, 제출·조회·관리 함수와 권한을 모두 만듭니다.
3. 이 SQL은 **새 데이터베이스에 최초 설치하는 스키마**입니다. 초기 공개 게시판 코드는 아직 DB를 만들지 않은 상태였으므로 이전 운영 데이터 마이그레이션은 없습니다. 다른 DB에 같은 이름의 테이블이 있다면 덮어쓰거나 삭제하지 말고 별도 프로젝트를 만드세요.
4. Data API에 `private` 스키마를 노출하지 마세요. `public`만 사용합니다.
5. Authentication 설정에서 공개 회원가입(Allow new users to sign up)과 Anonymous Sign-Ins를 끕니다. 학생은 Supabase Auth 계정을 만들지 않습니다.

## 3. 반장·부반장 계정 등록

1. Supabase Authentication → Users에서 **서로 다른 두 이메일/비밀번호 계정**을 직접 생성합니다. `Add user`에서 직접 만들거나 각 관리자에게 초대 메일을 보내고, 이메일 확인이 완료되도록 합니다. 이 이메일은 관리자 로그인에만 사용됩니다.
2. 각 계정의 User UID를 복사해 SQL Editor에서 아래 쿼리에 넣습니다. 비밀번호는 SQL이나 소스 코드에 넣지 않습니다.

```sql
insert into public.admin_members (user_id, display_name)
values
  ('반장_USER_UID로_교체', '반장'),
  ('부반장_USER_UID로_교체', '부반장')
on conflict (user_id) do update
set display_name = excluded.display_name;
```

두 계정은 같은 권한을 가집니다. 이메일 주소, 표시 이름, 가입 시 입력한 metadata만으로는 관리자 권한이 생기지 않습니다. 로그인 JWT의 `auth.uid()`가 `admin_members.user_id`에 등록되어 있는지 DB에서 매번 확인합니다. 관리자를 해제하려면 해당 UID 행을 `admin_members`에서 삭제하세요.

비밀번호를 분실하면 프로젝트 소유자가 Supabase 관리 화면에서 재설정 절차를 진행하세요. 이 앱에는 공개 회원가입이나 관리자 계정 생성 기능이 없습니다. 공용 컴퓨터에서는 사용 후 로그아웃하세요.

### 관리자 로그인이 안 될 때

브라우저에 표시되는 오류는 계정 존재 여부나 내부 설정을 노출하지 않도록 항상 일반 문구를 사용합니다. 로컬 개발 모드에서는 브라우저 개발자 도구의 Console에 `[admin-auth]` 로그로 Supabase의 실제 `code`, `status`, `message`가 기록됩니다. URL 전체와 키 값은 기록하지 않으며 프로젝트 origin과 키 종류만 표시합니다.

1. Netlify의 `NEXT_PUBLIC_SUPABASE_URL`이 관리자 사용자를 만든 **같은 Supabase 프로젝트**의 Project URL인지 확인합니다.
2. `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`에는 그 프로젝트의 publishable key(`sb_publishable_…`) 또는 legacy `anon` key만 넣습니다. secret/service role key는 절대 넣지 않습니다. 값을 수정하면 새 배포를 실행해야 합니다.
3. Supabase **Authentication → Users**에서 해당 사용자의 `Email confirmed at` 또는 `Confirmed at`이 비어 있지 않은지 확인합니다. 확인되지 않은 사용자는 기본 설정에서 로그인할 수 없습니다.
4. **Authentication → Providers → Email**에서 Email provider가 활성화되어 있는지 확인합니다. 공개 가입 허용은 꺼도 기존 관리자의 이메일/비밀번호 로그인에는 영향을 주지 않습니다.

로그의 `code`가 `email_not_confirmed`이면 이메일 확인을 마쳐야 합니다. `invalid_credentials`이면 Supabase는 계정 없음과 잘못된 비밀번호를 의도적으로 구분하지 않으므로 이메일과 비밀번호를 함께 다시 확인합니다. `Invalid API key` 또는 네트워크 오류면 먼저 위의 URL·키 조합을 고칩니다.

`NEXT_PUBLIC_` 변수에 `sb_secret_…` 키를 잘못 넣은 경우 그 키는 이미 브라우저 번들에 노출된 것으로 간주해야 합니다. 올바른 publishable key로 교체한 뒤 새 secret key를 발급하고, 서버 전용 `SUPABASE_SECRET_KEY`를 새 값으로 바꿔 재배포한 다음 이전 secret key를 폐기하세요.

복구 메일이 동작하지 않을 때는 관리자 계정을 안전하게 다시 만들 수 있습니다.

1. Supabase **Authentication → Users → Add user → Create new user**를 엽니다.
2. 관리자 이메일과 새 비밀번호를 입력하고 **Auto Confirm User**를 켠 뒤 생성합니다.
3. 새 사용자의 UID를 복사하고, 위의 `admin_members` 등록 SQL로 새 UID를 먼저 추가합니다.
4. 새 계정으로 `/admin` 로그인을 확인한 다음에만 이전 관리자 행과 이전 Auth 사용자를 정리합니다.

UID를 새로 등록해도 RLS와 두 관리자 동등 권한 구조는 그대로 유지됩니다. 비밀번호나 secret key를 SQL, 소스 코드, 개발 로그에 넣지 마세요.

## 4. 환경 변수 설정

```sh
cp .env.example .env.local
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

`.env.local`에 다음 값을 채웁니다.

| 변수 | 값 | 노출 범위 |
|---|---|---|
| NEXT_PUBLIC_SUPABASE_URL | 프로젝트 URL | 공개 가능 |
| NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY | publishable key 또는 legacy anon key | 공개 가능, RLS로 권한 제한 |
| SUPABASE_SECRET_KEY | 현재 `sb_secret_…` 키 또는 legacy service_role key | **서버 전용 비밀** |
| COOLDOWN_SECRET | 위 명령으로 생성한 64자리 무작위 문자열 | **서버 전용 비밀** |
| APP_ORIGIN | `http://localhost:3000` | 서버 설정 |

`APP_ORIGIN`은 실제 브라우저 주소의 origin과 정확히 같아야 합니다. 끝의 `/`는 빼세요. `localhost`와 `127.0.0.1`은 다른 주소입니다. 설정을 바꾼 뒤 서버를 재시작하세요.

`NEXT_PUBLIC_`가 붙은 값은 브라우저에 포함됩니다. secret/service role 키, 쿠키 서명 키, 비밀번호에 이 접두어를 붙이지 마세요. `.env.local`은 Git에서 제외되어 있습니다.

## 5. 데이터 접근 구조

- 학생은 로그인하지 않고 `/api/posts`에 제출합니다. 서버가 입력 길이·출처·도배 제한을 검사한 뒤 서버 전용 키로 제한된 `submit_post` 함수만 호출합니다.
- `anon` 역할에는 `posts`, `admin_members`, `admin_actions` 테이블 권한이 없습니다. 따라서 학생 브라우저나 공개 키만으로는 어떤 의견도 조회할 수 없습니다.
- 로그인만 했다고 관리자가 되지는 않습니다. `authenticated` 사용자는 `admin_members`에 자신의 UID가 등록된 경우에만 RLS를 통과해 전체 의견과 작업 기록을 읽을 수 있습니다.
- 의견 수정은 직접 테이블 UPDATE가 아니라 `moderate_post` 함수를 거칩니다. 함수가 관리자 등록 여부를 다시 확인하고 변경자를 작업 기록에 남깁니다.
- `/admin` 주소 자체는 로그인 화면을 보여주기 위해 공개됩니다. 인증 전에는 대시보드 데이터 요청이 실행되지 않으며, API를 직접 호출해도 DB 권한과 RLS가 내용을 차단합니다. 등록되지 않은 계정은 즉시 로그아웃됩니다.
- 작성자 결과 조회는 서버 전용 함수가 비밀 확인번호 해시와 일치하는 글의 상태·작성자용 답변·수정 시각만 반환합니다. 원문과 관리자 메모는 반환하지 않습니다.

## 6. 사용 흐름

**학생**: 카테고리 → 제목 → 내용 → 선생님 전달 희망/결과 확인 희망 선택 → 제출.

결과 확인을 선택한 경우에만 제출 직후 64자리 비밀 확인번호를 한 번 발급합니다. 번호는 `/result`에 붙여넣습니다. 번호를 분실하면 복구할 수 없습니다. 학생의 신원이나 연락처가 없어 개별 알림은 보내지 않습니다. 네트워크가 제출 직후 끊기면 번호를 받지 못할 수 있으며, 글 자체는 접수되었을 수 있습니다.

**관리자**: `/admin` 로그인 → 의견 선택 → 미확인/확인 완료/선생님께 전달/처리 완료 지정 → 메모·작성자용 답변 → 저장.

- ‘선생님께 전달’ 상태는 실제 전달 후 관리자가 기록합니다. 자동 이메일·메시지 전송은 없습니다.
- 선생님 전달 희망을 선택하지 않은 의견도 필요하면 관리자가 판단해 전달할 수 있음을 이용 안내에 명시했습니다.
- 관리자 메모는 내부 전용입니다. 작성자용 답변만 비밀 확인번호로 조회할 수 있습니다.
- 장난성 글은 숨기고, ‘숨긴 의견’ 필터에서 복구할 수 있습니다. 숨김은 삭제가 아니며 기존 확인번호 조회를 막지 않습니다.
- 상태·메모·답변·숨김 변경은 누가 언제 바꿨는지 기록합니다. 메모/답변의 이전 본문은 감사 기록에 복제하지 않습니다.
- 동시에 같은 의견을 수정하면 나중 저장은 거절됩니다. 입력 내용을 따로 보관하고 최신 의견을 다시 선택해야 합니다.

## 7. 배포하기 — Netlify + Supabase

Next.js Route Handler가 필요하므로 정적 파일 호스팅이나 `output: export`로 배포하지 마세요. Netlify는 현재 Next.js App Router와 Route Handler를 OpenNext 어댑터로 자동 지원합니다. 저장소의 `netlify.toml`은 빌드 명령과 Node/pnpm 버전만 고정하며 어댑터 버전은 고정하지 않습니다.

1. 프로젝트를 본인 Git 저장소에 올립니다. `.env.local`, `node_modules`, `.next`는 제외합니다.
2. Netlify에서 **Add new project → Import an existing project**를 선택하고 `junypark0427/class4board` 저장소를 연결합니다.
3. Base directory는 저장소 루트로 둡니다. `netlify.toml`에 따라 빌드 명령은 `pnpm build`, Publish directory는 `.next`, Node는 22, pnpm은 11.19.0이 됩니다. 별도 Functions directory나 Next.js 플러그인은 저장소에 추가하지 않습니다.
4. Netlify **Project configuration → Environment variables**에 `.env.example`의 다섯 변수를 추가합니다. 민감한 값은 `netlify.toml`이나 GitHub에 넣지 않습니다.
5. `APP_ORIGIN`은 최종 Production URL과 정확히 같게 입력합니다(예: `https://class4board.netlify.app`, 끝 `/` 없음). Deploy Preview URL은 매번 달라지므로 운영 Supabase 비밀값을 Preview에 제공하지 않는 것을 권장합니다.
6. 첫 배포 후 실제 Production URL을 확인해 `APP_ORIGIN`이 다르면 수정하고 **Clear cache and deploy site**로 다시 배포합니다. `NEXT_PUBLIC_` 값 변경도 재빌드가 필요합니다.
7. Supabase Authentication URL 설정의 Site URL을 최종 주소로 맞춥니다. 현재 이메일/비밀번호 로그인은 리디렉션 흐름을 사용하지 않습니다.
8. 아래 실제 연결 점검을 마친 뒤에만 친구들에게 주소를 공유합니다.

배포는 사용자의 Supabase/Netlify 계정에서 진행해야 하며, GitHub 소스 저장소와 별개로 실제 웹 서비스 배포는 아직 하지 않았습니다.

## 8. 검사

```sh
pnpm test
pnpm typecheck
pnpm build
pnpm start
```

자동 테스트는 메모리 PostgreSQL(PGlite)에서 실제 스키마와 역할·RLS를 적용해 권한, 동등 관리자 접근, 수정 충돌, 확인번호 조회, 도배 제한을 검사합니다. 실제 Supabase 인증 서비스나 Netlify 배포를 대신 검증하는 테스트는 아닙니다.

**실제 연결 후 점검**

- 학생으로 의견 제출 → 다른 학생 화면에 목록이나 글 본문이 나타나지 않음.
- 로그아웃 상태에서 `/admin` → 로그인 화면만 보이며 의견 제목·내용은 응답 HTML이나 화면에 나타나지 않음.
- 관리자 목록 REST 요청을 공개 키만으로 실행 → 권한 거부. 일반 로그인 계정 → 빈 결과 또는 관리자 화면에서 로그아웃.
- 두 관리자 각각 로그인 → 같은 글 확인, 메모/상태 변경, 변경자 이름 확인.
- 숨김 → 기본 목록 제외 → 숨김 필터에서 다시 표시/복구.
- 결과 확인 희망 글의 번호로 상태/답변 조회 → 내부 메모는 미표시.
- 결과 확인을 원하지 않은 글은 번호가 발급되지 않음.
- 잘못된 번호나 `/posts/임의의_ID`로는 본문을 볼 수 없음.
- 같은 브라우저에서 1분 이내 다시 제출하면 429 안내.
- 휴대폰에서 입력, 체크박스 선택, 관리자 상세와 저장 확인.

## 9. 구조

```text
app/                       학생·결과·관리자 페이지와 제출 API
lib/                       입력 규칙, DB 타입/클라이언트, 쿠키 서명
supabase/migrations/       DB 테이블, RLS, 제출·조회·관리 함수
tests/                     실제 SQL 보안/권한 테스트
docs/                      설계 변경·운영/보안 안내
docs/legacy/               비활성 공개 화면 보관본 (.txt, 실행 안 됨)
.env.example               환경 변수 예시
netlify.toml               Netlify 빌드/런타임 버전 설정
```

브라우저 동작 검사 재현 방법과 검증 범위는 `docs/TESTING.md`에 있습니다.

## 참고한 공식 문서

- [Next.js 설치](https://nextjs.org/docs/app/getting-started/installation)
- [Supabase RLS](https://supabase.com/docs/guides/database/postgres/row-level-security)
- [Supabase 데이터베이스 함수](https://supabase.com/docs/guides/database/functions)
- [Supabase 공개 키와 비밀 키](https://supabase.com/docs/guides/getting-started/api-keys)
- [Netlify의 Next.js 지원](https://docs.netlify.com/build/frameworks/framework-setup-guides/nextjs/overview/)
- [Netlify 파일 기반 설정](https://docs.netlify.com/build/configure-builds/file-based-configuration/)
