// Capture the fragment once, outside React rendering. A refresh intentionally loses
// the token: users must reopen the original game link, never a stored credential.
import { parseLinkLocation } from "./link-location";
const pathname = window.location.pathname;
const location = parseLinkLocation(pathname, window.location.hash);
// Capture the safe callback code before removing the query. School credentials
// are handled by the API callback and never passed to the frontend.
export const universityAuthError = new URLSearchParams(window.location.search).get("auth_error");
export const automaticLinkError = new URLSearchParams(window.location.search).get("link_error");
export const automaticDiscordError = new URLSearchParams(window.location.search).get("discord_link_error");
if (window.location.hash || window.location.search) {
  window.history.replaceState(null, "", pathname);
}
export const linkReference = location?.kind === "minecraft" ? location.reference : null;
export const discordLinkReference = location?.kind === "discord" ? location.reference : null;
export const invalidLinkPath = location?.kind === "minecraft" && !location.reference;
export const invalidDiscordLinkPath = location?.kind === "discord" && !location.reference;
