# Passport Web

소모임 회원이 학교 인증과 Minecraft 계정 연결을 진행하고, 본인의 회원 상태와 접속 가능한 서버를 확인하는 사용자 웹입니다.

**현재 상태: 개발 준비 문서만 작성했습니다.** 실행 코드, 패키지 설정, 빌드 설정, 배포 환경은 아직 없습니다.

## 역할

- Minecraft에서 받은 개인별 일회용 링크로 계정 연결을 시작합니다.
- 학교 로그인은 `passport-api`를 통해 진행하고, 서버가 확인한 학적 정보와 회원 명부 대조 결과를 표시합니다.
- 웹에서 연결 내용을 확인한 뒤 게임에서 `/passport confirm`을 실행해야 Minecraft 연결이 확정됩니다.
- 사용자가 Discord 숫자 ID를 직접 입력·수정할 수 있습니다. ID는 문자열로 처리하고, 소유권이 확인되지 않은 사용자 입력 정보로 표시합니다.
- 회원 상태, 연결한 Minecraft 계정, 허용된 서버 목록, 연결 해제 상태를 제공합니다.

Discord OAuth와 Discord 계정 소유권 검증은 이번 범위에 없습니다. 입력한 Discord ID로 로그인하거나 접속 권한을 부여하지 않습니다.

## 예정 스택

- React + TypeScript + Vite
- `passport-api`가 관리하는 HttpOnly 세션 쿠키
- `passport-contracts`의 버전이 고정된 API 계약·타입 배포본

학교 비밀번호와 학교 세션 토큰은 프론트 저장소·로그·분석 도구에 남기지 않습니다. 브라우저 입력만으로 학번이나 회원 자격을 확정하지 않습니다.

## 다음 구현 순서

1. API 계약에서 연결 상태와 오류 응답을 확정합니다.
2. Vite 프로젝트와 세션·CSRF 처리 기반을 만듭니다.
3. 일회용 링크 → 학교 인증 → 웹 확인 → 게임 확인 흐름을 구현합니다.
4. 회원 상태, 서버 목록, Discord ID 직접 입력 화면을 구현합니다.
5. 만료·중복 연결·명부 불일치 화면과 실제 연동을 검증합니다.

세부 범위는 [구현 계획](docs/implementation-plan.md), 소스 경계는 [src 안내](src/README.md)를 참고하세요.

## 관련 저장소

개인 계정의 관련 저장소입니다.

- [passport-api](https://github.com/underconnor/passport-api): 인증·회원·접근 정책 API
- [passport-contracts](https://github.com/underconnor/passport-contracts): API 계약과 배포 타입
- [passport-admin](https://github.com/underconnor/passport-admin): 운영자 웹
- [passport-velocity](https://github.com/underconnor/passport-velocity): Minecraft 연결 시작과 최종 확인

각 저장소는 독립적으로 빌드·배포합니다. 다른 저장소의 `../src`를 직접 import하지 않습니다.
