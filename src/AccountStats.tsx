import { useEffect, useEffectEvent, useState } from "react";
import { api, errorMessage } from "./api";
import type { PlayStatistics } from "./statistics";
import { statisticsMetrics } from "./statistics";
import { MetricIcon } from "./MetricIcon";

export function AccountStats({ onDetails, onError }: { onDetails: () => void; onError: (failure: unknown) => void }) {
  const [data, setData] = useState<PlayStatistics | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const failed = useEffectEvent((failure: unknown) => { setError(errorMessage(failure)); onError(failure); });
  useEffect(() => {
    const controller = new AbortController();
    void api<PlayStatistics>("/me/stats", { signal: controller.signal }).then(result => {
      if (!controller.signal.aborted) setData(result);
    }).catch(failure => { if (!controller.signal.aborted) failed(failure); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, []);
  const metrics = data?.available ? statisticsMetrics(data.totals).filter(metric => metric.icon !== "damage" && metric.icon !== "deaths") : [];
  return <section className="panel account-stats" aria-labelledby="account-stats-heading" aria-busy={loading}>
    <div className="panel-head"><h2 id="account-stats-heading">내 플레이 기록</h2><button className="text-button" onClick={onDetails}>상세 보기</button></div>
    {loading ? <p className="account-stats-empty" role="status">기록을 불러오는 중입니다.</p>
      : error ? <p className="account-stats-empty" role="status">{error}</p>
      : !data?.available ? <p className="account-stats-empty">아직 플레이 기록이 없습니다.</p>
      : <><div className="account-stats-grid">{metrics.map(metric => <div className="account-stat" key={metric.label}><span className="stats-metric-label"><MetricIcon name={metric.icon} />{metric.label}</span><strong>{metric.value}</strong></div>)}</div>{data.collection?.enabled === false ? <p className="account-stats-note">내 통계 수집이 꺼져 있습니다. 기존 기록만 표시합니다.</p> : null}</>}
  </section>;
}
