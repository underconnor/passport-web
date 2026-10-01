import type { ReactNode } from "react";
import type { DiscordConnection, DiscordLinkSession, DiscordRoleStatus } from "./api";
import { discordNicknameState, discordRoleSummary } from "./discord";
import { Icon } from "./ui";

export function DiscordTarget({ account }: { account: Pick<DiscordConnection, "username" | "displayName"> }) {
  return <div className="discord-identity">
    <span className="discord-avatar" aria-hidden="true">{(account.displayName || account.username).slice(0, 1).toUpperCase()}</span>
    <div><strong>{account.displayName || account.username}</strong><p>@{account.username}</p></div>
  </div>;
}

function RoleRow({ label, state }: { label: string; state: DiscordRoleStatus | null }) {
  const labelText = state ? ({ pending: "처리 대기", granted: "지급 완료", revoked: "역할 없음", failed: "처리 실패" })[state.status] : "사용하지 않음";
  return <div className="discord-role-row"><span>{label}</span><strong className={state?.status === "failed" ? "warning" : ""}>{labelText}</strong></div>;
}

export function DiscordCard({ connection, link, linkError, missingToken, enabled, active, schoolExpired, disabled, consent, consentReady, onConfirm, onManagementConsent, onAccount }: {
  connection: DiscordConnection | null | undefined;
  link: DiscordLinkSession | null;
  linkError: string;
  missingToken: boolean;
  enabled: boolean;
  active: boolean;
  schoolExpired: boolean;
  disabled: boolean;
  consent: ReactNode;
  consentReady: boolean;
  onConfirm: () => void;
  onManagementConsent: () => void;
  onAccount: () => void;
}) {
  const role = discordRoleSummary(connection);
  const nickname = discordNicknameState(connection?.nickname?.status, connection?.nickname?.desired);
  return <section className="panel" aria-labelledby="discord-heading">
    <div className="panel-head"><h2 id="discord-heading">Discord 계정</h2><span className="status-label">{connection ? "연결됨" : "연결 대기"}</span></div>
    {connection ? <>
      <DiscordTarget account={connection} />
      <div className={`discord-role discord-role-summary role-${role.tone}`} role="status">
        {role.tone === "success" ? <span className="role-success-icon"><Icon name="check" /></span> : null}
        <div><strong>{role.label}</strong>{role.message ? <p>{role.message}</p> : null}</div>
      </div>
      {connection.roles && role.tone !== "success" ? <div className="discord-role-breakdown" aria-label="처리 중인 Discord 역할">
        {connection.roles.verification?.status === "pending" || connection.roles.verification?.status === "failed" ? <RoleRow label="학교 인증" state={connection.roles.verification} /> : null}
        {connection.roles.member?.status === "pending" || connection.roles.member?.status === "failed" ? <RoleRow label="Overworld 회원" state={connection.roles.member} /> : null}
        {connection.roles.semesters.filter(term => term.status === "pending" || term.status === "failed").map(term => <RoleRow key={term.semester} label={term.semester} state={term} />)}
      </div> : null}
      {connection.membershipSemesters?.length ? <div className="discord-semesters"><span>참여 학기</span>{connection.membershipSemesters.map(term => <strong key={term}>{term}</strong>)}</div> : null}
      {connection.managementConsentRequired ? <div className="connection-confirm discord-management-consent">
        <h3>Discord 관리 동의가 필요해요</h3><p className="helper">참여 학기 역할과 실명 기반 서버 닉네임을 반영하려면 새 안내를 확인해 주세요. 기존 계정 연결은 유지됩니다.</p>
        {consent}<button className="primary" disabled={disabled || !consentReady || !active} onClick={onManagementConsent}>동의하고 역할·닉네임 동기화</button>
        {!active ? <button className="text-button" onClick={onAccount}>학교 인증과 이용 상태 확인</button> : null}
      </div> : connection.nickname ? <div className={`discord-role role-${nickname.tone}`} role="status">
        <strong>{nickname.label}</strong>
        {connection.nickname.desired && connection.nickname.status !== "disabled" ? <p>{connection.nickname.status === "applied" ? "반영된 닉네임" : "반영할 닉네임"}: {connection.nickname.desired}</p> : null}
        {connection.nickname.status === "failed" ? <p>{connection.nickname.lastError === "not_manageable" ? "서버 소유자이거나 봇과 같거나 높은 역할을 가진 계정은 봇이 닉네임을 바꿀 수 없습니다. 관리자에게 역할 순서 확인을 요청해 주세요." : "봇이 서버 닉네임을 변경하지 못했습니다. 관리자에게 문의해 주세요."}</p> : null}
        <p className="helper">{connection.nickname.desired === null && connection.nickname.status === "applied" ? "현재 Passport가 서버 닉네임을 관리하지 않습니다." : "Minecraft 연결 시 실명 / 게임 이름, 미연결 시 실명으로 동기화됩니다."}</p>
      </div> : null}
      {link && connection.discordId !== link.discordId ? <p className="helper warning">다른 Discord 계정의 연동 링크입니다. 계정 변경은 운영진에게 문의바랍니다.</p> : null}
    </> : !enabled ? <div className="empty-state"><h3>Discord 연동 준비 중</h3><p>새 Discord 계정 연결을 아직 사용할 수 없습니다. 소모임 관리자에게 문의해 주세요.</p></div>
      : missingToken || linkError ? <div className="empty-state">
      <h3>새 Discord 연동 링크가 필요해요</h3>
      <p>{linkError || "확인 정보가 없습니다. 디스코드 서버에서 봇의 ‘연동하기’ 버튼을 다시 눌러 주세요."}</p>
    </div> : link ? <>
      <p className="account-eyebrow">연결할 Discord 계정</p>
      <DiscordTarget account={link} />
      {link.status === "linked" ? <p className="helper" role="status">연결 확인을 마쳤습니다. 계정과 역할 상태를 불러오고 있어요.</p>
        : !active ? <div className="empty-state"><p>유효한 학교 인증을 확인한 뒤 연결할 수 있습니다. 이용 정지 상태라면 관리자에게 문의해 주세요.</p><button className="text-button" onClick={onAccount}>{schoolExpired ? "학교 계정 정보에서 인증 갱신" : "학교 계정 정보 확인"}</button></div>
          : <div className="connection-confirm discord-confirm"><p className="helper">본인의 Discord 계정인지 확인해 주세요.</p>{consent}<button className="primary" disabled={disabled || !consentReady} onClick={onConfirm}>동의하고 이 Discord 계정 연결<Icon name="arrow" /></button></div>}
    </> : <div className="empty-state">
      <h3>디스코드 서버에서 연동을 시작하세요</h3>
      <p>봇의 <strong>연동하기</strong> 버튼을 누르고 본인에게만 보이는 링크를 열어 주세요. 학교 인증을 마치면 계정이 연결되고, 봇이 학교·회원·학기 역할과 서버 닉네임을 반영합니다.</p>
    </div>}
    <p className="helper card-footnote">연결 해제나 계정 변경은 운영진에게 문의바랍니다.</p>
  </section>;
}
