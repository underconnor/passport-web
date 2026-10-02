import { useEffect, useState } from "react";
import { api, errorMessage } from "./api";
import { notionEmbed, notionPage } from "./manual";
import type { ManualSettings } from "./manual";
import { Icon } from "./ui";

export function ManualView() {
  const [manual, setManual] = useState<ManualSettings | null>(null);
  const [error, setError] = useState("");
  const [refresh, setRefresh] = useState(0);
  useEffect(() => {
    const controller = new AbortController(); setManual(null); setError("");
    void api<ManualSettings>("/manual", { signal: controller.signal }).then(value => { if (!controller.signal.aborted) setManual(value); }).catch(failure => { if (!controller.signal.aborted) setError(errorMessage(failure)); });
    return () => controller.abort();
  }, [refresh]);
  const page = notionPage(manual?.notionUrl ?? null);
  const embed = notionEmbed(manual?.embedUrl ?? null, page);
  if (error) return <section className="panel empty-state"><h2>매뉴얼을 불러오지 못했습니다.</h2><p role="alert">{error}</p><button onClick={() => setRefresh(value => value + 1)}>다시 불러오기</button></section>;
  if (!manual) return <section className="panel empty-state" role="status"><h2>매뉴얼을 불러오고 있어요</h2></section>;
  if (!manual.configured || !page) return <section className="panel empty-state"><Icon name="book" /><h2>등록된 매뉴얼이 없습니다.</h2><p>운영진이 이용 안내를 준비하고 있습니다.</p></section>;
  return <section className="manual-view" aria-label={manual.title}><div className="panel manual-heading"><div><span className="manual-kicker">OVERWORLD GUIDE</span><h2>{manual.title}</h2></div>{embed ? <a className="manual-open" href={page} target="_blank" rel="noopener noreferrer" referrerPolicy="no-referrer">Notion에서 열기 <Icon name="arrow" /></a> : null}</div>{embed ? <><iframe className="manual-frame" src={embed} title={manual.title} referrerPolicy="no-referrer" sandbox="allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox" loading="lazy" /><p className="helper">문서가 보이지 않으면 Notion에서 열어 주세요.</p></> : <div className="panel manual-link-card"><Icon name="book" /><h3>이용 안내를 확인하세요.</h3><p>등록된 Notion 문서를 새 탭에서 볼 수 있습니다.</p><a className="manual-open" href={page} target="_blank" rel="noopener noreferrer" referrerPolicy="no-referrer">매뉴얼 열기 <Icon name="arrow" /></a></div>}</section>;
}
