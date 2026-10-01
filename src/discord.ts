import type { DiscordConnection } from "./api";

export function discordLinkError(code: string | null): string {
  if (code === null) return "";
  const messages: Record<string, string> = {
    link_expired: "Discord 연동 링크가 만료되었습니다. 디스코드 서버에서 봇의 ‘연동하기’ 버튼을 다시 눌러 주세요.",
    link_not_found: "Discord 연동 요청을 찾을 수 없습니다. 봇의 ‘연동하기’ 버튼으로 새 링크를 받아 주세요.",
    link_consumed: "이미 처리되거나 취소된 Discord 연동 요청입니다. 연결된 계정 또는 봇의 새 링크를 확인해 주세요.",
    invalid_token: "유효하지 않은 Discord 연동 링크입니다. 봇에서 받은 원래 링크를 다시 열어 주세요.",
    invalid_link: "유효하지 않은 Discord 연동 링크입니다. 봇에서 받은 원래 링크를 다시 열어 주세요.",
    membership_required: "학교 인증과 활성 회원 자격이 필요합니다. 회원 정보를 확인하거나 소모임 운영자에게 문의해 주세요.",
    subject_already_linked: "이 회원 계정에 다른 Discord 계정이 연결되어 있습니다. 변경은 관리자에게 문의해 주세요.",
    discord_already_linked: "이 Discord 계정은 이미 연결되어 있습니다. 계정 변경은 관리자에게 문의해 주세요.",
    discord_guild_mismatch: "연동을 요청한 디스코드 서버를 확인할 수 없습니다. 소모임 관리자에게 문의해 주세요.",
    discord_not_configured: "Discord 연동이 아직 준비되지 않았습니다. 소모임 관리자에게 문의해 주세요.",
    discord_subject_already_linked: "이 회원 계정에 다른 Discord 계정이 연결되어 있습니다. 변경은 관리자에게 문의해 주세요.",
    confirming_session_expired: "연결 확인 시간이 지났습니다. 봇의 ‘연동하기’ 버튼으로 새 링크를 받아 주세요.",
    consent_required: "개인정보 안내를 읽고 동의를 선택해 주세요.",
    consent_version_mismatch: "개인정보 안내가 변경되었습니다. 최신 내용을 확인하고 다시 동의해 주세요.",
    web_confirmation_consumed: "이미 확인된 Discord 연동 요청입니다. 연결된 계정 상태를 확인해 주세요.",
    university_verification_expired: "학교 인증이 만료되었습니다. 회원 정보에서 학교 인증을 갱신해 주세요.",
  };
  const key = code.startsWith("discord_") && !Object.hasOwn(messages, code) ? code.slice(8) : code;
  return Object.hasOwn(messages, key) ? messages[key] : "Discord 연동을 완료하지 못했습니다. 연결 상태를 확인하고 다시 시도해 주세요.";
}

export function discordRoleState(status: DiscordConnection["roleStatus"] | undefined) {
  switch (status) {
    case "granted": return { label: "역할 지급 완료", message: "봇이 디스코드 서버의 회원 역할을 지급했습니다.", tone: "success" };
    case "revoked": return { label: "역할 회수됨", message: "계정 연결은 유지되지만 회원 역할이 회수되었습니다. 회원 상태를 확인하거나 관리자에게 문의해 주세요.", tone: "warning" };
    case "failed": return { label: "역할 처리 확인 필요", message: "계정 연결은 완료됐지만 봇이 역할을 처리하지 못했습니다. 관리자에게 문의해 주세요.", tone: "warning" };
    case "pending": return { label: "역할 처리 대기", message: "계정은 연결되었습니다. 봇이 회원 자격에 맞는 역할을 반영하고 있습니다.", tone: "pending" };
    default: return { label: "역할 상태 확인 필요", message: "계정 연결과 별개로 현재 역할 상태를 확인할 수 없습니다. 잠시 후 새로고침해 주세요.", tone: "warning" };
  }
}
