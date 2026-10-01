import { useEffect, useState } from "react";
import type { PrivacyNotice } from "./api";
import { PrivacyConsent } from "./PrivacyConsent";

export function GameConsentNotice({ notice, busy, onConfirm }: { notice: PrivacyNotice; busy: boolean; onConfirm: (version: string) => void }) {
  const [accepted, setAccepted] = useState(false);
  useEffect(() => setAccepted(false), [notice.version]);
  return <section className="panel privacy-renewal"><h2>새로운 게임 기능을 확인해 주세요</h2><p className="helper">게임 내 실명·학번 연도 표시와 플레이 기록 집계가 추가됐습니다. 적용 전에 변경된 개인정보 안내를 확인해 주세요.</p>
    <PrivacyConsent notice={notice} accepted={accepted} onChange={setAccepted} loading={false} error="" onRetry={() => {}} disabled={busy} renewal />
    <button className="primary" disabled={busy || !accepted} onClick={() => { if (accepted) onConfirm(notice.version); }}>동의하고 게임 기능 사용</button>
  </section>;
}
