import type { Profile } from "./api";
import { accountAccess } from "./auth";
import { Icon } from "./ui";

export function MembershipCard({ profile, development }: { profile: Profile; development: boolean }) {
  const access = accountAccess(profile);
  return <section className="panel membership-card" aria-labelledby="membership-heading">
    <div className="membership-main">
      <span className={`membership-symbol ${access.membershipActive ? "is-member" : ""}`} aria-hidden="true"><Icon name={access.membershipActive ? "check" : "dashboard"} /></span>
      <div>
        <h2 id="membership-heading">소모임 회원 상태</h2>
        <strong className="membership-label">{development ? `개발용 · ${access.label}` : access.label}</strong>
        <p>{development ? "가상 명부를 사용한 테스트 결과입니다." : access.message}</p>
      </div>
    </div>
    <div className="membership-school">
      <span>학교 인증</span>
      <strong className={access.schoolValid ? "" : "warning"}>{development ? "개발용 가상 신원" : access.schoolExpired ? "유효기간 만료" : access.schoolValid ? "u-SAINT 인증 완료" : "인증 필요"}</strong>
      <p>서버 접속 권한은 아래 목록에서 확인하세요.</p>
    </div>
    {access.suspended ? <p className="membership-restriction" role="status">현재 서버 이용이 정지되어 있습니다. 소모임 운영자에게 문의해 주세요.</p> : null}
  </section>;
}
