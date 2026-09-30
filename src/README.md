# 예정 소스 경계

아직 실행 소스는 없습니다. 부트스트랩 시 다음 경계로 구성합니다.

| 모듈 | 책임 |
| --- | --- |
| `app` | 라우팅, 공통 화면, 세션 초기화 |
| `features/link` | Minecraft 연결 요청, 학교 인증 진입, 게임 확인 대기 |
| `features/profile` | 회원 정보와 Discord ID 직접 입력 |
| `features/access` | 서버별 접근 상태 표시 |
| `shared/api` | 세션 기반 API 클라이언트, CSRF, 오류 변환 |
| `shared/ui` | 재사용 UI와 접근성 |

API 모델은 `passport-contracts`의 특정 버전 배포본을 사용합니다. 인접 저장소 소스에 대한 상대 경로 import나 학적 파서 구현은 포함하지 않습니다.
