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
  return callbackErrors[key] ?? "학교 로그인을 완료하지 못했습니다. 다시 시도해 주세요.";
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
  const suspended = profile.accessSuspended || profile.membership.status === "suspended" || profile.membership.effectiveStatus === "suspended";
  const rosterMatched = profile.membership.status === "active" && profile.membership.effectiveStatus !== "revoked";
  const rosterExpired = rosterMatched && (!future(profile.membership.verifiedUntil, now) || (profile.membership.effectiveStatus === "stale" && !schoolExpired));
  const canAccess = !suspended && rosterMatched && !rosterExpired && !schoolExpired;
  const label = suspended ? "이용 정지"
    : schoolExpired ? "학교 인증 만료"
    : !rosterMatched ? "명부 미등록"
    : rosterExpired ? "명부 갱신 대기" : "활성 회원";
  const message = suspended ? "서버 이용이 정지되어 있습니다. 소모임 운영자에게 문의해 주세요."
    : schoolExpired ? "학교 인증 유효기간이 지났습니다. 학교 계정으로 다시 로그인해 주세요."
    : !rosterMatched ? "학교 인증은 완료되었지만 회원 명부에서 확인되지 않았습니다. 소모임 운영자에게 명부 확인을 요청해 주세요."
    : rosterExpired ? "회원 명부의 확인 기간이 지났습니다. 명부가 갱신되면 접속 권한이 다시 반영됩니다."
    : "회원 명부에 따라 접속할 수 있는 서버가 표시됩니다.";
  return { schoolVerified, schoolExpired, suspended, rosterMatched, rosterExpired, canAccess, label, message };
}
