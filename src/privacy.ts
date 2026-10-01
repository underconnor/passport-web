import type { PrivacyNotice } from "./api";

// Reject an incomplete notice instead of collecting consent to missing terms.
export function privacyNotice(value: unknown): PrivacyNotice {
  if (!value || typeof value !== "object") throw new Error("privacy_notice_invalid");
  const notice = value as Partial<PrivacyNotice>;
  if (![notice.version, notice.purpose, notice.retention, notice.withdrawal].every((item) => typeof item === "string" && item.trim()) ||
      !Array.isArray(notice.items) || !notice.items.length || !notice.items.every((item) => typeof item === "string" && item.trim()))
    throw new Error("privacy_notice_invalid");
  return notice as PrivacyNotice;
}
