import type { ReactNode } from "react";
import type { DiscordConnection, DiscordLinkSession } from "./api";
import { discordRoleState } from "./discord";
import { Icon } from "./ui";

export function DiscordTarget({ account }: { account: Pick<DiscordConnection, "username" | "displayName"> }) {
  return <div className="discord-identity">
    <span className="discord-avatar" aria-hidden="true">{(account.displayName || account.username).slice(0, 1).toUpperCase()}</span>
    <div><strong>{account.displayName || account.username}</strong><p>@{account.username}</p></div>
  </div>;
}

export function DiscordCard({ connection, link, linkError, missingToken, enabled, active, schoolExpired, disabled, consent, consentReady, onConfirm, onAccount }: {
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
  onAccount: () => void;
}) {
  const role = discordRoleState(connection?.roleStatus);
  return <section className="panel" aria-labelledby="discord-heading">
    <div className="panel-head"><h2 id="discord-heading">Discord 계정</h2><span className="status-label">{connection ? "연결됨" : "연결 대기"}</span></div>
    {connection ? <>
      <DiscordTarget account={connection} />
      <div className={`discord-role role-${role.tone}`} role="status"><strong>{role.label}</strong><p>{role.message}</p></div>
      {link && connection.discordId !== link.discordId ? <p className="helper warning">다른 Discord 계정의 연동 링크입니다. 계정 변경은 관리자에게 문의해 주세요.</p> : null}
    </> : !enabled ? <div className="empty-state"><h3>Discord 연동 준비 중</h3><p>새 Discord 계정 연결을 아직 사용할 수 없습니다. 소모임 관리자에게 문의해 주세요.</p></div>
      : missingToken || linkError ? <div className="empty-state">
      <h3>새 Discord 연동 링크가 필요해요</h3>
      <p>{linkError || "확인 정보가 없습니다. 디스코드 서버에서 봇의 ‘연동하기’ 버튼을 다시 눌러 주세요."}</p>
    </div> : link ? <>
      <p className="account-eyebrow">연결할 Discord 계정</p>
      <DiscordTarget account={link} />
      {link.status === "linked" ? <p className="helper" role="status">연결 확인을 마쳤습니다. 계정과 역할 상태를 불러오고 있어요.</p>
        : !active ? <div className="empty-state"><p>학교 인증과 활성 회원 자격을 확인한 뒤 연결할 수 있습니다.</p><button className="text-button" onClick={onAccount}>{schoolExpired ? "회원 정보에서 학교 인증 갱신" : "회원 정보 확인"}</button></div>
          : <div className="connection-confirm discord-confirm"><p className="helper">본인의 Discord 계정인지 확인해 주세요. 연결 후 계정 변경·해제는 관리자에게 문의해야 합니다.</p>{consent}<button className="primary" disabled={disabled || !consentReady} onClick={onConfirm}>동의하고 이 Discord 계정 연결<Icon name="arrow" /></button></div>}
    </> : <div className="empty-state">
      <h3>디스코드 서버에서 연동을 시작하세요</h3>
      <p>봇의 <strong>연동하기</strong> 버튼을 누르고 본인에게만 보이는 링크를 열어 주세요. 학교 인증을 마치면 계정이 연결되고, 봇이 회원 역할을 반영합니다.</p>
    </div>}
    <p className="helper card-footnote">연결 해제나 계정 변경은 소모임 관리자에게 문의해 주세요.</p>
  </section>;
}
