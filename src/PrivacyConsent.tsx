import type { PrivacyNotice } from "./api";

export function PrivacyConsent({ notice, accepted, onChange, loading, error, onRetry, disabled = false, renewal = false }: {
  notice: PrivacyNotice | null;
  accepted: boolean;
  onChange: (accepted: boolean) => void;
  loading: boolean;
  error: string;
  onRetry: () => void;
  disabled?: boolean;
  renewal?: boolean;
}) {
  if (!notice) return (
    <div className="privacy-unavailable" role="status">
      <p>{loading ? "개인정보 안내를 불러오고 있어요." : error || "개인정보 안내를 확인한 뒤 진행할 수 있습니다."}</p>
      {!loading ? <button className="text-button" onClick={onRetry}>안내 다시 불러오기</button> : null}
    </div>
  );
  return (
    <div className="privacy-consent">
      <div className="privacy-heading"><span>개인정보 수집·이용</span><span className="required-label">필수</span></div>
      <p className="privacy-purpose">{notice.purpose}</p>
      <details className="privacy-details">
        <summary>수집 항목과 보관 안내 보기</summary>
        <dl>
          <div><dt>수집 항목</dt><dd><ul>{notice.items.map((item, index) => <li key={index}>{item}</li>)}</ul></dd></div>
          <div><dt>보유 기간</dt><dd>{notice.retention}</dd></div>
          <div><dt>철회·삭제 요청</dt><dd>{notice.withdrawal}</dd></div>
        </dl>
        <p className="privacy-version">안내 버전 {notice.version}</p>
      </details>
      <label className="consent-checkbox">
        <input type="checkbox" checked={accepted} disabled={disabled || loading} onChange={(event) => onChange(event.target.checked)} />
        <span>개인정보 수집·이용에 동의합니다.</span>
      </label>
      <p className="privacy-choice">{renewal ? "동의 후 게임 내 실명 표시와 플레이 기록 집계를 이용할 수 있습니다." : "동의하지 않으면 로그인과 계정 연결을 진행할 수 없습니다."}</p>
    </div>
  );
}
