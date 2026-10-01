import { useEffect, useState } from "react";

const minecraftAddress = "overworld.flyjung.kr";

export function ServerAddress() {
  const [copyState, setCopyState] = useState<"idle" | "copying" | "copied" | "failed">("idle");
  useEffect(() => {
    if (copyState !== "copied") return;
    const timeout = setTimeout(() => setCopyState("idle"), 3000);
    return () => clearTimeout(timeout);
  }, [copyState]);
  async function copyAddress() {
    setCopyState("copying");
    try {
      await navigator.clipboard.writeText(minecraftAddress);
      setCopyState("copied");
    } catch {
      setCopyState("failed");
    }
  }
  return <div className="server-connection">
    <div className="server-address-heading"><span>Minecraft 서버 주소</span><button type="button" disabled={copyState === "copying"} onClick={() => void copyAddress()}>{copyState === "copied" ? "복사 완료" : copyState === "copying" ? "복사 중…" : "주소 복사"}</button></div>
    <strong>{minecraftAddress}</strong>
    <p className={`server-copy-feedback${copyState === "failed" ? " warning" : ""}`} role="status">{copyState === "copied" ? "서버 주소를 복사했습니다." : copyState === "failed" ? "복사할 수 없습니다. 주소를 선택해 복사해 주세요." : ""}</p>
  </div>;
}
