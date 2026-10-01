import { useEffect, useEffectEvent, useState } from "react";
import { api, ApiError, errorMessage } from "./api";

interface Settings { enabled: boolean; revision: string; consentGranted: boolean }
export function StatisticsSettings({ csrfToken, onSaved, onError }: { csrfToken: string | undefined; onSaved: () => void; onError?: (error: unknown) => void }) {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [stale, setStale] = useState(false);
  const [refresh, setRefresh] = useState(0);
  const failed = useEffectEvent((failure: unknown) => { setError(errorMessage(failure)); onError?.(failure); });
  useEffect(() => {
    const controller = new AbortController(); setLoading(true); setError(""); setNotice("");
    void api<Settings>("/me/statistics-settings", { signal: controller.signal }).then(result => {
      if (!controller.signal.aborted) { setSettings(result); setStale(false); }
    }).catch(failure => { if (!controller.signal.aborted) failed(failure); }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [refresh]);
  async function toggle() {
    if (!settings || !csrfToken || busy || loading || stale || (!settings.enabled && !settings.consentGranted)) return;
    setBusy(true); setError(""); setNotice("");
    try {
      const updated = await api<Settings>("/me/statistics-settings", { method: "PUT", csrfToken, body: { enabled: !settings.enabled, expectedRevision: settings.revision } });
      setSettings(updated); setNotice(updated.enabled ? "내 통계 수집을 켰습니다. 수집이 허용된 서버에서 기록됩니다." : "내 통계 수집을 껐습니다. 기존 기록은 유지됩니다."); onSaved();
    } catch (failure) { if (failure instanceof ApiError && failure.status === 409) setStale(true); setError(errorMessage(failure)); onError?.(failure); }
    finally { setBusy(false); }
  }
  return <section className="panel stats-collection" aria-labelledby="statistics-settings-title" aria-busy={loading || busy}>
    <div className="stats-collection-row"><div><h3 id="statistics-settings-title">내 통계 수집</h3><p>끄면 새 기록 수집을 중지하고 기존 기록은 유지합니다.</p></div>
      {settings ? <button className={`collection-switch${settings.enabled ? " is-enabled" : ""}`} type="button" role="switch" aria-label="내 통계 수집" aria-checked={settings.enabled} disabled={loading || busy || stale || !csrfToken || (!settings.enabled && !settings.consentGranted)} onClick={() => void toggle()}><span className="switch-track" aria-hidden="true"><span /></span><span>{busy ? "저장 중…" : settings.enabled ? "켜짐" : "꺼짐"}</span></button> : <span className="helper">{loading ? "확인 중…" : "확인 필요"}</span>}
    </div>
    {settings && !settings.consentGranted ? <p className="helper stats-setting-help">수집을 켜려면 내 계정에서 게임 정보 제공 동의를 완료해 주세요.</p> : null}
    {error ? <div className="stats-setting-error"><p className="error-text" role="alert">{error}</p><button disabled={busy || loading} onClick={() => setRefresh(value => value + 1)}>최신 설정 확인</button></div> : null}
    {notice ? <p className="stats-setting-help" role="status">{notice}</p> : null}
  </section>;
}
