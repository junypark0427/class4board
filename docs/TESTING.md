# 검증 결과와 재현

최종 경로: `/Users/parkjunhoo/Documents/Projects/class4board`

## 완료한 검사

- 이 경로에서 Next.js 배포 빌드 및 TypeScript 검사 통과.
- PGlite 실제 PostgreSQL 엔진으로 스키마/RLS 보안 테스트 10개 통과.
- 빌드 결과를 이 경로에서 실행하고 학생 화면·관리자 로그인 화면 응답 확인.
- 1440px 데스크톱, 390px/320px 모바일 화면 확인. 가로 넘침 없음.
- 테스트 응답으로 학생 제출 완료·확인번호·결과 확인, 관리자 로그인·상태/메모/답변 저장·숨김·숨김 필터·작업 기록·로그아웃 검사 통과.
- 실제 Next.js API의 잘못된 Origin 403, 잘못된 입력 400, 16KB 초과 413, 짧은 확인번호 400, 미설정 503 확인.
- 테스트용 Supabase 요청은 브라우저에서 가로채고 가상 응답을 반환했으며 실제 Supabase에 전송하지 않았습니다.

아직 실제 Supabase 계정 로그인/원격 DB 연동이나 Netlify 배포를 검증한 것은 아닙니다. 배포 전 README의 실제 연결 점검을 진행하세요.

## 기본 검사 재실행

```sh
pnpm test
pnpm typecheck
pnpm build
```

## 선택적 화면 검사

`tests/browser-check.cjs`는 별도로 설치된 Playwright가 필요합니다. 기본 테스트나 앱 실행에는 필요하지 않습니다. Playwright 모듈이 이미 설치되어 있다면 `PLAYWRIGHT_MODULE_PATH`로 그 경로를 지정할 수 있고, `CHROME_PATH`를 지정하면 기존 Chrome 실행 파일을 사용합니다. 지정하지 않으면 Playwright의 Chromium 설치가 필요합니다.

이 검사는 `.env.local`이 없는 전용 테스트 환경에서만 실행하세요. 기본 포트 3000에는 설정 없는 빌드를 실행합니다. 포트 3001에는 아래 **가짜 테스트 설정**으로 개발 서버를 실행합니다. 값들은 실제 API 키가 아닙니다.

```sh
SUPABASE_URL=https://class4-test.supabase.co \
SUPABASE_PUBLISHABLE_KEY=test-publishable-key \
DATABASE_ADMIN_KEY=test-service-key \
COOLDOWN_SECRET=test-only-secret-not-a-real-key-123456789 \
APP_ORIGIN=http://127.0.0.1:3001 \
pnpm dev --port 3001
```

다른 터미널에서 `node tests/browser-check.cjs`를 실행합니다. 확인용 이미지는 Git에서 제외된 `docs/previews`에 저장됩니다. 관리자 화면 이미지의 의견·계정은 모두 테스트용입니다. 검사 후 3001 테스트 서버를 종료하세요.

확인번호·비밀 키·비밀번호를 실제 운영 값으로 대체해 테스트 코드에 저장하지 마세요.
