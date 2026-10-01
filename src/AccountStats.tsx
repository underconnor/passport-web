import { useEffect, useEffectEvent, useState } from "react";
import { api, errorMessage } from "./api";
import type { PlayStatistics } from "./StatsView";
import { playTime, travelDistance } from "./StatsView";

const number = (value: number) => new Intl.NumberFormat("ko-KR").format(value);

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
  const metrics = data?.available ? [
    { label: "플레이 시간", value: playTime(data.totals.playSeconds) },
    { label: "캔 블록", value: number(data.totals.blocksBroken) },
    { label: "설치한 블록", value: number(data.totals.blocksPlaced) },
    { label: "처치한 몹", value: number(data.totals.mobKills) },
    { label: "플레이어 처치", value: number(data.totals.playerKills ?? 0) },
    { label: "이동 거리", value: travelDistance(data.totals.distanceCm) },
  ] : [];
  return <section className="panel account-stats" aria-labelledby="account-stats-heading" aria-busy={loading}>
    <div className="panel-head"><h2 id="account-stats-heading">내 플레이 기록</h2><button className="text-button" onClick={onDetails}>상세 보기</button></div>
    {loading ? <p className="account-stats-empty" role="status">기록을 불러오는 중입니다.</p>
      : error ? <p className="account-stats-empty" role="status">{error}</p>
      : !data?.available ? <p className="account-stats-empty">아직 플레이 기록이 없습니다.</p>
      : <div className="account-stats-grid">{metrics.map(metric => <div className="account-stat" key={metric.label}><span>{metric.label}</span><strong>{metric.value}</strong></div>)}</div>}
  </section>;
}
