import { useEffect, useRef, useState } from "react";
import type { MinecraftSkin } from "./api";

/** Draw only the backend's bounded PNG data URI; never contact an avatar provider. */
export function MinecraftPortrait({ skin, name, body = false, loading = false }: {
  skin: MinecraftSkin | null;
  name: string;
  body?: boolean;
  loading?: boolean;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    setReady(false);
    const data = skin?.dataUrl;
    if (!data || data.length > 3_000_000 || !/^data:image\/png;base64,[A-Za-z0-9+/]+={0,2}$/.test(data)) return;
    let cancelled = false;
    const image = new Image();
    image.onload = () => {
      if (cancelled || image.width !== 64 || ![32, 64].includes(image.height)) return;
      const context = canvas.current?.getContext("2d");
      if (!context) return;
      context.clearRect(0, 0, body ? 160 : 64, body ? 320 : 64);
      context.imageSmoothingEnabled = false;
      const scale = body ? 10 : 8;
      const draw = (sx: number, sy: number, width: number, height: number, x: number, y: number, flip = false) => {
        context.save();
        if (flip) { context.translate((x + width) * scale, y * scale); context.scale(-1, 1); }
        context.drawImage(image, sx, sy, width, height, flip ? 0 : x * scale, flip ? 0 : y * scale, width * scale, height * scale);
        context.restore();
      };
      if (!body) {
        draw(8, 8, 8, 8, 0, 0); draw(40, 8, 8, 8, 0, 0);
      } else {
        const modern = image.height === 64;
        const slim = modern && skin?.model === "slim";
        const arm = slim ? 3 : 4;
        draw(8, 8, 8, 8, 4, 0);
        draw(20, 20, 8, 12, 4, 8);
        draw(44, 20, arm, 12, slim ? 1 : 0, 8);
        draw(modern ? 36 : 44, modern ? 52 : 20, arm, 12, 12, 8, !modern);
        draw(4, 20, 4, 12, 4, 20);
        draw(modern ? 20 : 4, modern ? 52 : 20, 4, 12, 8, 20, !modern);
        if (modern) {
          draw(20, 36, 8, 12, 4, 8); draw(44, 36, arm, 12, slim ? 1 : 0, 8);
          draw(52, 52, arm, 12, 12, 8); draw(4, 36, 4, 12, 4, 20); draw(4, 52, 4, 12, 8, 20);
        }
        draw(40, 8, 8, 8, 4, 0);
      }
      setReady(true);
    };
    image.src = data;
    return () => { cancelled = true; image.onload = null; image.src = ""; };
  }, [skin?.dataUrl, skin?.model, body]);
  return (
    <div className={`minecraft-portrait ${body ? "portrait-body" : "portrait-head"}`}>
      <canvas ref={canvas} width={body ? 160 : 64} height={body ? 320 : 64} className={ready ? "skin-visible" : "skin-hidden"} role="img" aria-label={`${name} Minecraft 스킨`} />
      {!ready ? <div className="skin-placeholder" aria-label={loading ? "스킨 불러오는 중" : "기본 아바타"}>
        <span>{name.slice(0, 1).toUpperCase() || "M"}</span>
        {body ? <small>{loading ? "스킨 불러오는 중" : "Minecraft 계정"}</small> : null}
      </div> : null}
    </div>
  );
}
