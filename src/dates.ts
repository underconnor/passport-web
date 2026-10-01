// Verification expires exclusively at the next semester's Korean midnight.
export function schoolExpiryDate(value: string): string {
  const expiry = Date.parse(value);
  if (!Number.isFinite(expiry)) return "확인 필요";
  return new Intl.DateTimeFormat("ko-KR", {
    year: "numeric", month: "long", day: "numeric", timeZone: "Asia/Seoul",
  }).format(new Date(expiry - 1));
}
