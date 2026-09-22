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
2. SQL Editor에서 `supabase/migrations/001_suggestion_box.sql` 전체를 한 번 실행합니다.
3. 이 SQL은 **새 데이터베이스에 최초 설치하는 스키마**입니다. 초기 공개 게시판 코드는 아직 DB를 만들지 않은 상태였으므로 이전 운영 데이터 마이그레이션은 없습니다. 다른 DB에 같은 이름의 테이블이 있다면 덮어쓰거나 삭제하지 말고 별도 프로젝트를 만드세요.
4. Data API에 `private` 스키마를 노출하지 마세요. `public`만 사용합니다.
5. Authentication 설정에서 공개 회원가입(Allow new users to sign up)과 Anonymous Sign-Ins를 끕니다. 학생은 Supabase Auth 계정을 만들지 않습니다.

## 3. 반장·부반장 계정 등록

1. Supabase Authentication → Users에서 **서로 다른 두 이메일/비밀번호 계정**을 직접 생성합니다. 이메일 확인 완료 상태로 생성하세요. 이 이메일은 관리자 로그인에만 사용됩니다.
2. 각 계정의 User UID를 복사해 SQL Editor에서 아래 쿼리에 넣습니다. 비밀번호는 SQL이나 소스 코드에 넣지 않습니다.

```sql
insert into public.admin_members (user_id, display_name)
values
  ('반장_USER_UID로_교체', '반장'),
  ('부반장_USER_UID로_교체', '부반장');
```

두 계정은 같은 권한을 가집니다. 이메일 주소, 표시 이름, 가입 시 입력한 metadata만으로는 관리자 권한이 생기지 않습니다. `admin_members` 등록 여부를 DB에서 매번 확인합니다.

비밀번호를 분실하면 프로젝트 소유자가 Supabase 관리 화면에서 재설정 절차를 진행하세요. 이 앱에는 공개 회원가입이나 관리자 계정 생성 기능이 없습니다. 공용 컴퓨터에서는 사용 후 로그아웃하세요.

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
| SUPABASE_SERVICE_ROLE_KEY | secret key 또는 legacy service_role key | **서버 전용 비밀** |
| COOLDOWN_SECRET | 위 명령으로 생성한 64자리 무작위 문자열 | **서버 전용 비밀** |
| APP_ORIGIN | `http://localhost:3000` | 서버 설정 |

`APP_ORIGIN`은 실제 브라우저 주소의 origin과 정확히 같아야 합니다. 끝의 `/`는 빼세요. `localhost`와 `127.0.0.1`은 다른 주소입니다. 설정을 바꾼 뒤 서버를 재시작하세요.

`NEXT_PUBLIC_`가 붙은 값은 브라우저에 포함됩니다. service role/secret key, 쿠키 서명 키, 비밀번호에 이 접두어를 붙이지 마세요. `.env.local`은 Git에서 제외되어 있습니다.

## 5. 사용 흐름

**학생**: 카테고리 → 제목 → 내용 → 선생님 전달 희망/결과 확인 희망 선택 → 제출.

결과 확인을 선택한 경우에만 제출 직후 64자리 비밀 확인번호를 한 번 발급합니다. 번호는 `/result`에 붙여넣습니다. 번호를 분실하면 복구할 수 없습니다. 학생의 신원이나 연락처가 없어 개별 알림은 보내지 않습니다. 네트워크가 제출 직후 끊기면 번호를 받지 못할 수 있으며, 글 자체는 접수되었을 수 있습니다.

**관리자**: `/admin` 로그인 → 의견 선택 → 미확인/확인 완료/선생님께 전달/처리 완료 지정 → 메모·작성자용 답변 → 저장.

- ‘선생님께 전달’ 상태는 실제 전달 후 관리자가 기록합니다. 자동 이메일·메시지 전송은 없습니다.
- 선생님 전달 희망을 선택하지 않은 의견도 필요하면 관리자가 판단해 전달할 수 있음을 이용 안내에 명시했습니다.
- 관리자 메모는 내부 전용입니다. 작성자용 답변만 비밀 확인번호로 조회할 수 있습니다.
- 장난성 글은 숨기고, ‘숨긴 의견’ 필터에서 복구할 수 있습니다. 숨김은 삭제가 아니며 기존 확인번호 조회를 막지 않습니다.
- 상태·메모·답변·숨김 변경은 누가 언제 바꿨는지 기록합니다. 메모/답변의 이전 본문은 감사 기록에 복제하지 않습니다.
- 동시에 같은 의견을 수정하면 나중 저장은 거절됩니다. 입력 내용을 따로 보관하고 최신 의견을 다시 선택해야 합니다.

## 6. 배포하기 — Vercel + Supabase

Next.js 서버 API가 필요하므로 정적 파일 호스팅이나 `output: export`로 배포하지 마세요.

1. 프로젝트를 본인 Git 저장소에 올립니다. `.env.local`, `node_modules`, `.next`는 제외합니다.
2. Vercel에서 해당 저장소를 Import하고 Framework Preset을 Next.js로 선택합니다.
3. Node.js 22 이상을 사용하고, 빌드 명령은 `pnpm build`, 설치 명령은 `pnpm install --frozen-lockfile`로 둡니다.
4. `.env.example`의 다섯 변수를 Vercel의 환경 변수 설정에 추가합니다. `APP_ORIGIN`은 최종 배포 주소(예: `https://class4-example.vercel.app`)로 설정합니다.
5. Deploy합니다. 처음 배포 후 주소를 알게 되었다면 `APP_ORIGIN`을 수정하고 Redeploy합니다. `NEXT_PUBLIC_` 값 변경도 재빌드가 필요합니다.
6. Supabase Authentication URL 설정의 Site URL을 최종 주소로 맞춥니다. 현재 이메일/비밀번호 로그인은 리디렉션 흐름을 사용하지 않습니다.
7. 아래 실제 연결 점검을 마친 뒤에만 친구들에게 주소를 공유합니다. Preview 배포는 별도 Supabase 프로젝트를 사용하거나 환경 변수를 비워 제출을 막으세요.

배포는 사용자의 Supabase/Vercel 계정에서 진행해야 하며, GitHub 소스 저장소와 별개로 실제 웹 서비스 배포는 아직 하지 않았습니다.

## 7. 검사

```sh
pnpm test
pnpm typecheck
pnpm build
pnpm start
```

자동 테스트는 메모리 PostgreSQL(PGlite)에서 실제 스키마와 역할·RLS를 적용해 권한, 동등 관리자 접근, 수정 충돌, 확인번호 조회, 도배 제한을 검사합니다. 실제 Supabase 인증 서비스나 Vercel 배포를 대신 검증하는 테스트는 아닙니다.

**실제 연결 후 점검**

- 학생으로 의견 제출 → 다른 학생 화면에 목록이나 글 본문이 나타나지 않음.
- 두 관리자 각각 로그인 → 같은 글 확인, 메모/상태 변경, 변경자 이름 확인.
- 숨김 → 기본 목록 제외 → 숨김 필터에서 다시 표시/복구.
- 결과 확인 희망 글의 번호로 상태/답변 조회 → 내부 메모는 미표시.
- 결과 확인을 원하지 않은 글은 번호가 발급되지 않음.
- 잘못된 번호나 `/posts/임의의_ID`로는 본문을 볼 수 없음.
- 같은 브라우저에서 1분 이내 다시 제출하면 429 안내.
- 휴대폰에서 입력, 체크박스 선택, 관리자 상세와 저장 확인.

## 구조

```text
app/                       학생·결과·관리자 페이지와 제출 API
lib/                       입력 규칙, DB 타입/클라이언트, 쿠키 서명
supabase/migrations/       DB 테이블, RLS, 제출·조회·관리 함수
tests/                     실제 SQL 보안/권한 테스트
docs/                      설계 변경·운영/보안 안내
docs/legacy/               비활성 공개 화면 보관본 (.txt, 실행 안 됨)
.env.example               환경 변수 예시
```

브라우저 동작 검사 재현 방법과 검증 범위는 `docs/TESTING.md`에 있습니다.

## 참고한 공식 문서

- [Next.js 설치](https://nextjs.org/docs/app/getting-started/installation)
- [Supabase RLS](https://supabase.com/docs/guides/database/postgres/row-level-security)
- [Supabase 데이터베이스 함수](https://supabase.com/docs/guides/database/functions)
- [Supabase 공개 키와 비밀 키](https://supabase.com/docs/guides/getting-started/api-keys)
- [Next.js의 Vercel 배포](https://vercel.com/docs/frameworks/full-stack/nextjs)
