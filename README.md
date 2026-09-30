# Passport Web

Overworld 회원 인증과 Minecraft 계정 연결을 위한 독립 React·TypeScript·Vite 앱입니다.

## 현재 구현

- API의 HttpOnly 세션과 CSRF 토큰을 사용하는 로그인 상태 조회
- 서버가 명시적으로 허용한 환경에서만 표시되는 가상 회원·미등록 회원 개발 로그인
- Minecraft 일회용 링크 확인, 웹 연결 확인, 게임 확인 대기·완료 상태
- Discord 숫자 사용자 ID 입력·수정·삭제와 소유권 미확인 표시
- 실제 API 응답에 기반한 회원 상태와 허용 서버 표시
- 오류, 만료, 연결 누락, 비활성 회원 처리

**실제 학교 로그인, 학적 조회, Google Sheets 연동은 아직 제공하지 않습니다.** 개발 신원은 화면 전체에서 테스트용으로 표시합니다. 가상 로그인으로 실제 운영 서버 권한을 부여하면 안 됩니다.

## 로컬 개발

Node.js 24가 필요합니다. 별도 `passport-api`를 먼저 실행하고 개발 허용 Origin에 `http://localhost:5173` 또는 실제 접속할 주소를 등록합니다.

```sh
npm ci
npm run dev
```

기본 주소는 `http://localhost:5173`, API 프록시 대상은 `http://127.0.0.1:3000`입니다. 서버 쪽 환경 변수 `API_PROXY_TARGET`으로 프록시 대상을 변경할 수 있습니다. 브라우저 코드는 항상 같은 출처의 `/v1`만 호출합니다. 이 변수는 브라우저 번들에 API 비밀값을 넣는 용도가 아닙니다.

```sh
npm run check
npm run build
docker build -t passport-web:dev .
```

## 컨테이너 배포

Dockerfile은 정적 빌드 결과를 비특권 nginx 사용자로 8080 포트에서 제공합니다. `/v1/`는 같은 Docker 네트워크의 `api:3000`으로 전달합니다. 실제 요청의 Host와 Origin을 유지하므로 API에 프론트의 정확한 Origin을 등록해야 합니다. `/healthz`는 정적 웹 프로세스의 상태만 확인하며 API·DB 정상 여부를 뜻하지 않습니다.

운영 환경은 TLS와 Secure 세션 쿠키가 필요합니다. 개발 HTTP 환경은 실제 개인정보가 없는 제한된 네트워크에서만 사용합니다. 실제 운영 도메인·비밀값·인프라 Compose는 별도 비공개 운영 저장소에서 관리합니다.

## API 계약

프론트는 공개 실행 API를 사용하며 비공개 `passport-contracts` 저장소를 빌드 의존성으로 요구하지 않습니다. 런타임 응답에 맞춘 최소 TypeScript 타입은 `src/api.ts`에 있습니다.

| 요청 | 목적 |
| --- | --- |
| `GET /v1/auth/session` | 세션, CSRF, 사용 가능한 인증 모드 |
| `POST /v1/auth/development` | 개발용 가상 신원 선택 |
| `POST /v1/auth/logout` | 세션 종료 |
| `GET /v1/me` | 내 프로필 |
| `GET /v1/me/servers` | 허용 서버 |
| `PUT /v1/me/discord-id` / `DELETE /v1/me/discord-id` | 직접 입력한 ID 저장·삭제 |
| `POST /v1/link-sessions/:id/inspect` | 일회용 요청 조회 |
| `POST /v1/link-sessions/:id/web-confirm` | 웹에서 연결 확인 |

연결 URL은 `/link/:id#token=...`입니다. 토큰은 최초 로드 때 메모리로 읽은 뒤 주소에서 즉시 제거하며, API에는 POST body로만 전송합니다. localStorage·sessionStorage·분석 도구에 기록하지 않습니다. 새로고침으로 메모리의 토큰을 잃으면 게임에서 원래 링크를 다시 열어야 합니다. 웹 확인 후에도 같은 Minecraft 계정에서 `/passport confirm`을 실행해야 연결이 완료됩니다.

Discord ID는 문자열이며 숫자 형식·uint64 범위를 확인합니다. 입력값은 `self_reported`이고 로그인·회원 자격·서버 권한의 근거가 아닙니다.

## 다음 단계

학교 검증 어댑터, 회원 명부 동기화와 실제 클라이언트 연결 검증 후 운영 인증 화면을 연결합니다. 분리된 앱이므로 다른 저장소 소스를 상대 경로로 참조하지 않습니다.

## 화면 기준

ALMS v4 A의 중립 회색·블루 레이아웃과 사용자가 지정한 Pretendard를 적용했습니다. 서체·아이콘을 자체 호스팅하며 외부 CDN을 사용하지 않습니다. 치수·색상·출처는 [화면 기준과 에셋](docs/design-system.md)을 참고하세요.
