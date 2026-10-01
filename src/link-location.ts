export type LinkLocation = {
  kind: "minecraft" | "discord";
  reference: { id: string; token: string | null } | null;
} | null;

export function parseLinkLocation(pathname: string, fragment: string): LinkLocation {
  const kind = pathname.startsWith("/discord/link/") ? "discord" : pathname.startsWith("/link/") ? "minecraft" : null;
  if (!kind) return null;
  const pattern = kind === "discord" ? /^\/discord\/link\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\/?$/i
    : /^\/link\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\/?$/i;
  const match = pattern.exec(pathname);
  const token = new URLSearchParams(fragment.replace(/^#/, "")).get("token");
  return { kind, reference: match ? { id: match[1], token } : null };
}
