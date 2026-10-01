import type { Profile } from "./api";

const callbackErrors: Record<string, string> = {
  expired: "학교 로그인 시간이 만료되었습니다. 다시 로그인해 주세요.",
  invalid_state: "로그인을 시작한 브라우저에서 다시 시도해 주세요.",
  state_invalid: "로그인을 시작한 브라우저에서 다시 시도해 주세요.",
  state_expired: "학교 로그인 시간이 만료되었습니다. 다시 로그인해 주세요.",
  request_expired: "학교 로그인 시간이 만료되었습니다. 다시 로그인해 주세요.",
  request_consumed: "이미 처리된 로그인 요청입니다. 다시 로그인해 주세요.",
  token_consumed: "이미 처리된 학교 인증 정보입니다. 다시 로그인해 주세요.",
  invalid_callback: "학교 인증 정보를 확인하지 못했습니다. 다시 로그인해 주세요.",
  rejected: "학교 인증을 확인하지 못했습니다. 학교 계정으로 다시 로그인해 주세요.",
  parser_changed: "학교 정보를 확인하지 못했습니다. 잠시 후 다시 시도해 주세요.",
  unavailable: "학교 인증 서버가 응답하지 않습니다. 잠시 후 다시 시도해 주세요.",
  busy: "학교 로그인 요청이 많습니다. 잠시 후 다시 시도해 주세요.",
  replayed: "이미 처리된 로그인 요청입니다. 다시 로그인해 주세요.",
};

export function universityCallbackError(code: string | null): string {
  if (code === null) return "";
  // Never render an arbitrary callback value, school token, URL, or server trace.
  const key = code.startsWith("university_") ? code.slice("university_".length) : code;
  return Object.hasOwn(callbackErrors, key) ? callbackErrors[key] : "학교 로그인을 완료하지 못했습니다. 다시 시도해 주세요.";
}

export function linkCallbackError(code: string | null): string {
  if (code === null) return "";
  const messages: Record<string, string> = {
    link_expired: "연결 요청이 만료되었습니다. 게임에서 새 링크를 받아 주세요.",
    link_consumed: "이미 처리되거나 취소된 연결 요청입니다. 게임에서 새 링크를 받아 주세요.",
    link_not_found: "연결 요청을 찾을 수 없습니다. 게임에서 새 링크를 받아 주세요.",
    web_confirmation_consumed: "웹 확인은 이미 완료되었습니다. 연결 상태를 확인하고 있어요.",
    membership_required: "접속 가능한 서버가 없어 게임 계정을 연결할 수 없습니다. 학교 인증과 접속 서버를 확인해 주세요.",
    subject_already_linked: "이 학교 계정에는 다른 Minecraft 계정이 연결되어 있습니다. 운영자에게 문의해 주세요.",
    confirming_session_expired: "연결 확인 시간이 지났습니다. 게임에서 새 링크를 받아 주세요.",
    consent_version_mismatch: "개인정보 안내가 변경되었습니다. 최신 안내를 확인하고 다시 연결해 주세요.",
  };
  return Object.hasOwn(messages, code) ? messages[code] : "계정 연결을 완료하지 못했습니다. 아래 연결 상태를 확인하고 다시 시도해 주세요.";
}

export function schoolLoginDestination(value: string): string {
  const url = new URL(value);
  if (url.origin !== "https://smartid.ssu.ac.kr" || url.pathname !== "/Symtra_sso/smln.asp" || url.username || url.password || url.hash) {
    throw new Error("학교 로그인 주소를 확인하지 못했습니다. 잠시 후 다시 시도해 주세요.");
  }
  return url.toString();
}

function future(value: string | null | undefined, now: number): boolean {
  if (!value) return false;
  return Number.isFinite(Date.parse(value)) && Date.parse(value) > now;
}

export function accountAccess(profile: Profile, now = Date.now()) {
  const schoolVerified = profile.identityProvider === "usaint";
  const schoolExpired = schoolVerified && !future(profile.universityVerifiedUntil, now);
  const schoolValid = schoolVerified && !schoolExpired;
  const suspended = profile.accessSuspended || profile.membership.status === "suspended" || profile.membership.effectiveStatus === "suspended";
  const rosterMatched = profile.membership.status === "active" && profile.membership.effectiveStatus !== "revoked";
  const rosterExpired = rosterMatched && (!future(profile.membership.verifiedUntil, now) || profile.membership.effectiveStatus === "stale");
  const membershipActive = rosterMatched && !rosterExpired;
  // Club membership is independent of school identity and per-server authorization.
  const canLinkDiscord = !suspended && schoolValid;
  const label = profile.membership.status === "suspended" ? "회원 이용 정지"
    : !rosterMatched ? "소모임 비회원"
    : rosterExpired ? "회원 확인 갱신 대기" : "소모임 회원";
  const message = profile.membership.status === "suspended" ? "소모임 회원 이용이 정지되어 있습니다. 운영자에게 문의해 주세요."
    : !rosterMatched ? "현재 소모임 회원 명부에서 확인되지 않습니다. 회원이라면 운영자에게 명부 확인을 요청해 주세요."
    : rosterExpired ? "회원 명부의 확인 기간이 지났습니다. 명부 갱신 후 회원 상태가 반영됩니다."
    : "Overworld 회원 명부에서 확인되었습니다.";
  return { schoolVerified, schoolValid, schoolExpired, suspended, rosterMatched, rosterExpired, membershipActive, canLinkDiscord, label, message };
}

export function minecraftEligibility(profile: Profile, serverCount: number, development = false, now = Date.now()) {
  const access = accountAccess(profile, now);
  const schoolReady = access.schoolValid || (development && profile.identityProvider === "development");
  const message = access.suspended ? "서버 이용이 정지되어 있습니다. 소모임 운영자에게 문의해 주세요."
    : !schoolReady ? "학교 인증을 확인해야 합니다. 학교 계정으로 다시 로그인해 주세요."
    : serverCount < 1 ? "접속 가능한 서버가 없어 게임 계정을 연결할 수 없습니다."
    : "";
  return { allowed: !access.suspended && schoolReady && serverCount > 0, message };
}
