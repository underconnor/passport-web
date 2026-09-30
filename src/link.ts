// Capture the fragment once, outside React rendering. A refresh intentionally loses
// the token: users must reopen the original game link, never a stored credential.
const pathname = window.location.pathname;
const match = /^\/link\/([0-9a-f-]{36})\/?$/i.exec(pathname);
const fragment = new URLSearchParams(window.location.hash.slice(1));
const token = fragment.get("token");
if (window.location.hash || window.location.search) {
  window.history.replaceState(null, "", pathname);
}
export const linkReference = match ? { id: match[1], token } : null;
export const invalidLinkPath = pathname.startsWith("/link/") && !match;
