import { useCallback, useEffect, useEffectEvent, useRef, useState } from "react";
import { api, ApiError, errorMessage } from "./api";
import type { AuthSession, DiscordLinkSession, LinkSession, LinkSummary, MinecraftSkin, PrivacyNotice, Profile, Server, UniversityStart } from "./api";
import { accountAccess, minecraftEligibility, linkCallbackError, schoolLoginDestination, universityCallbackError } from "./auth";
import { automaticDiscordError, automaticLinkError, discordLinkReference, invalidDiscordLinkPath, invalidLinkPath, linkReference, universityAuthError } from "./link";
import { discordLinkError as discordFailureMessage, discordSynchronizationPending } from "./discord";
import { DiscordCard, DiscordTarget } from "./DiscordCard";
import { pollLink } from "./link-polling";
import { privacyNotice } from "./privacy";
import { PrivacyConsent } from "./PrivacyConsent";
import { MembershipCard } from "./MembershipCard";
import { MinecraftPortrait } from "./MinecraftPortrait";
import { AppShell, Brand, DevelopmentStrip, Icon } from "./ui";
import type { IconName } from "./ui";
type View = "dashboard" | "minecraft" | "discord" | "servers";
const navigation: { id: View; label: string; icon: IconName }[] = [
  { id: "dashboard", label: "내 계정", icon: "dashboard" },
  { id: "minecraft", label: "Minecraft 연결", icon: "check" },
  { id: "discord", label: "Discord 연결", icon: "settings" },
  { id: "servers", label: "접속 서버", icon: "book" },
];
const automaticMoveNotice = "계정 연결이 완료되었습니다. 게임에 접속 중이면 허용된 로비로 자동 이동합니다.";

const formatDate = (value: string | null) =>
  value
    ? new Intl.DateTimeFormat("ko-KR", {
        month: "long",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      }).format(new Date(value))
    : "확인 대기";

export function App() {
  const [view, setView] = useState<View>(
    discordLinkReference || invalidDiscordLinkPath ? "discord" : linkReference || invalidLinkPath ? "minecraft" : "dashboard",
  );
  const [session, setSession] = useState<AuthSession | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [servers, setServers] = useState<Server[]>([]);
  const [serversState, setServersState] = useState<"loading" | "ready" | "error">("loading");
  const accountGeneration = useRef(0);
  const [link, setLink] = useState<LinkSession | null>(null);
  const [linkError, setLinkError] = useState("");
  const [linkPollError, setLinkPollError] = useState("");
  const [error, setError] = useState("");
  const [authError, setAuthError] = useState(() => universityCallbackError(universityAuthError));
  const [callbackLinkError, setCallbackLinkError] = useState(() => linkCallbackError(automaticLinkError));
  const [discordLink, setDiscordLink] = useState<DiscordLinkSession | null>(null);
  const [discordLinkError, setDiscordLinkError] = useState("");
  const [callbackDiscordError, setCallbackDiscordError] = useState(() => discordFailureMessage(automaticDiscordError));
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState("");
  const [loading, setLoading] = useState(true);
  const [privacy, setPrivacy] = useState<PrivacyNotice | null>(null);
  const [privacyLoading, setPrivacyLoading] = useState(true);
  const [privacyError, setPrivacyError] = useState("");
  const [consentAccepted, setConsentAccepted] = useState(false);
  const [skin, setSkin] = useState<MinecraftSkin | null>(null);
  const [skinLoading, setSkinLoading] = useState(false);

  const loadPrivacy = useCallback(async (signal?: AbortSignal) => {
    setPrivacyLoading(true);
    setConsentAccepted(false);
    setPrivacy(null);
    setPrivacyError("");
    try {
      const result = privacyNotice(await api<unknown>("/privacy", { signal }));
      if (!signal?.aborted) setPrivacy(result);
    } catch {
      if (!signal?.aborted) setPrivacyError("개인정보 안내를 불러오지 못했습니다. 안내를 다시 확인한 뒤 진행해 주세요.");
    } finally {
      if (!signal?.aborted) setPrivacyLoading(false);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    void loadPrivacy(controller.signal);
    return () => controller.abort();
  }, [loadPrivacy]);

  const fetchAccount = useCallback(async (signal?: AbortSignal, generation = ++accountGeneration.current) => {
    try {
      const [me, allowed] = await Promise.all([
        api<Profile>("/me", { signal }),
        api<{ servers: Server[] }>("/me/servers", { signal }),
      ]);
      if (signal?.aborted || generation !== accountGeneration.current) return null;
      setProfile(me);
      setServers(allowed.servers);
      setServersState("ready");
      return me;
    } catch (failure) {
      if (signal?.aborted || generation !== accountGeneration.current) return null;
      // Old permissions are not evidence that a failed refresh still allows access.
      setServers([]);
      setServersState("error");
      throw failure;
    }
  }, []);

  const refresh = useCallback(async (signal?: AbortSignal) => {
    const generation = ++accountGeneration.current;
    const current = () => !signal?.aborted && generation === accountGeneration.current;
    setError("");
    setServersState("loading");
    let auth: AuthSession;
    try {
      auth = await api<AuthSession>("/auth/session", { signal });
      if (!current()) return;
      setSession(auth);
      if (auth.authenticated) {
        await fetchAccount(signal, generation);
      } else {
        setProfile(null);
        setServers([]);
        setServersState("ready");
      }
    } catch (failure) {
      if (!current()) return;
      setServers([]);
      setServersState("error");
      throw failure;
    }
    if (!current()) return;
    if (linkReference?.token) {
      try {
        const inspected = await api<LinkSession>(
          `/link-sessions/${linkReference.id}/inspect`,
          {
            method: "POST",
            body: { token: linkReference.token },
            csrfToken: auth.csrfToken,
            signal,
          },
        );
        if (current()) {
          setLink(inspected);
          setLinkError("");
          setLinkPollError("");
        }
      } catch (failure) {
        if (current()) {
          setLink(null);
          setLinkError(errorMessage(failure));
        }
      }
    }
    if (!current()) return;
    if (discordLinkReference?.token) {
      try {
        const inspected = await api<DiscordLinkSession>(`/discord/link-sessions/${discordLinkReference.id}/inspect`, {
          method: "POST", body: { token: discordLinkReference.token }, csrfToken: auth.csrfToken, signal,
        });
        if (current()) { setDiscordLink(inspected); setDiscordLinkError(""); }
      } catch (failure) {
        if (current()) {
          setDiscordLink(null);
          setDiscordLinkError(failure instanceof ApiError ? discordFailureMessage(failure.code) : errorMessage(failure));
        }
      }
    }
  }, [fetchAccount]);

  useEffect(() => {
    const controller = new AbortController();
    refresh(controller.signal)
      .catch((failure) => {
        if (!controller.signal.aborted) setError(errorMessage(failure));
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [refresh]);

  function clearAuthenticatedState() {
    ++accountGeneration.current;
    setProfile(null);
    setServers([]);
    setServersState("loading");
    setDiscordLink(null);
    setDiscordLinkError("");
    setLink(null);
    setLinkError("");
    setLinkPollError("");
    setSession(null);
    setConsentAccepted(false);
    setSkin(null);
    setView("dashboard");
  }

  async function perform(name: string, action: () => Promise<void>) {
    setBusy(name);
    setError("");
    setNotice("");
    try {
      await action();
    } catch (failure) {
      if (failure instanceof ApiError && ["consent_required", "consent_version_mismatch", "privacy_version_mismatch"].includes(failure.code)) {
        await loadPrivacy();
      }
      if (failure instanceof ApiError && failure.status === 401) {
        clearAuthenticatedState();
        try {
          await refresh();
        } catch (recoveryFailure) {
          setError(errorMessage(recoveryFailure));
          return;
        }
      }
      setError(name === "discord-confirm" && failure instanceof ApiError && failure.status !== 401
        ? discordFailureMessage(failure.code) : errorMessage(failure));
    } finally {
      setBusy("");
    }
  }

  const csrfToken = profile?.csrfToken ?? session?.csrfToken;
  const signedIn = profile !== null;
  const access = profile ? accountAccess(profile) : null;
  const canLinkDiscord = access?.canLinkDiscord ?? false;
  const minecraftAccess = profile ? minecraftEligibility(profile, serversState === "ready" ? servers.length : 0, session?.authMode === "development") : null;
  const hasLink = linkReference !== null || invalidLinkPath;
  const missingToken = hasLink && !linkReference?.token;
  const linkExpired = link
    ? new Date(link.expiresAt).getTime() <= Date.now()
    : false;
  const disabled = Boolean(busy) || loading;
  const consentReady = Boolean(privacy && consentAccepted && !privacyLoading);
  const targetLinkId = !missingToken && !linkError && !linkExpired ? link?.id : null;
  const hasDiscordLink = discordLinkReference !== null || invalidDiscordLinkPath;
  const discordEnabled = session?.features?.discordLinking === true;
  const missingDiscordToken = hasDiscordLink && !discordLinkReference?.token;
  const discordExpired = discordLink ? Date.parse(discordLink.expiresAt) <= Date.now() : false;
  const targetDiscordId = discordEnabled && !missingDiscordToken && !discordLinkError && !discordExpired ? discordLink?.id : null;
  const minecraftUuid = profile?.minecraft?.uuid;
  useEffect(() => {
    const controller = new AbortController();
    setSkin(null);
    if (!minecraftUuid && (!targetLinkId || !linkReference?.token || !csrfToken)) {
      setSkinLoading(false);
      return;
    }
    setSkinLoading(true);
    const request = targetLinkId
      ? api<MinecraftSkin>(`/link-sessions/${targetLinkId}/skin`, {
        method: "POST", body: { token: linkReference?.token }, csrfToken, signal: controller.signal,
      })
      : api<MinecraftSkin>("/me/minecraft-skin", { signal: controller.signal });
    request.then((result) => {
      if (!controller.signal.aborted) setSkin(result);
    }).catch(() => {
      // A cosmetic lookup must never prevent a member from authenticating.
    }).finally(() => {
      if (!controller.signal.aborted) setSkinLoading(false);
    });
    return () => controller.abort();
  }, [minecraftUuid, targetLinkId, csrfToken]);

  const pollingResult = useEffectEvent((current: LinkSession) => {
    setLink((previous) => previous?.id === current.id && previous.status === "linked" ? previous : current);
    setLinkPollError("");
    if (current.status === "linked") setCallbackLinkError("");
    return current.status === "linked" ? "stop" as const : "continue" as const;
  });
  const pollingError = useEffectEvent((failure: unknown) => {
    if (failure instanceof ApiError && failure.status === 401) {
      void perform("session-recovery", async () => { throw failure; });
      return "stop" as const;
    }
    if (failure instanceof ApiError && [403, 404, 409, 410].includes(failure.status)) {
      setLinkError(errorMessage(failure));
      return "stop" as const;
    }
    setLinkPollError(`${errorMessage(failure)} 연결 상태를 자동으로 다시 확인합니다.`);
    return "retry" as const;
  });
  const pollingExpiry = useEffectEvent(() => {
    setLinkError("연결 요청이 만료되었습니다. 게임에서 /passport 로 새 링크를 받아 주세요.");
  });
  const pendingLinkId = link?.status === "pending" ? link.id : null;
  const linkExpiresAt = link?.expiresAt;
  useEffect(() => {
    if (!signedIn || !pendingLinkId || !linkExpiresAt || !linkReference?.token || !csrfToken || loading || busy || linkError) return;
    const token = linkReference.token;
    return pollLink({
      expiresAt: linkExpiresAt,
      inspect: (signal) => api<LinkSession>(`/link-sessions/${pendingLinkId}/inspect`, {
        method: "POST", body: { token }, csrfToken, signal,
      }),
      onResult: pollingResult,
      onError: pollingError,
      onExpire: pollingExpiry,
    });
  }, [signedIn, pendingLinkId, linkExpiresAt, csrfToken, loading, busy, linkError]);

  const discordPendingId = discordLink?.status === "pending" ? discordLink.id : null;
  const discordExpiresAt = discordLink?.expiresAt;
  const discordPollResult = useEffectEvent((current: DiscordLinkSession) => {
    setDiscordLink((previous) => previous?.status === "linked" ? previous : current);
    if (current.status === "linked") setCallbackDiscordError("");
    return current.status === "linked" ? "stop" as const : "continue" as const;
  });
  const discordPollError = useEffectEvent((failure: unknown) => {
    if (failure instanceof ApiError && failure.status === 401) {
      void perform("session-recovery", async () => { throw failure; });
      return "stop" as const;
    }
    if (failure instanceof ApiError && [403, 404, 409, 410].includes(failure.status)) {
      setDiscordLinkError(discordFailureMessage(failure.code));
      return "stop" as const;
    }
    return "retry" as const;
  });
  const discordPollExpiry = useEffectEvent(() => setDiscordLinkError(discordFailureMessage("link_expired")));
  useEffect(() => {
    if (!discordPendingId || !discordExpiresAt || discordLinkError) return;
    const timer = setTimeout(() => discordPollExpiry(), Math.max(0, Date.parse(discordExpiresAt) - Date.now()));
    return () => clearTimeout(timer);
  }, [discordPendingId, discordExpiresAt, discordLinkError]);
  useEffect(() => {
    if (!signedIn || !discordPendingId || !discordExpiresAt || !discordLinkReference?.token || !csrfToken || disabled || discordLinkError) return;
    const token = discordLinkReference.token;
    return pollLink({
      expiresAt: discordExpiresAt,
      inspect: (signal) => api<DiscordLinkSession>(`/discord/link-sessions/${discordPendingId}/inspect`, { method: "POST", body: { token }, csrfToken, signal }),
      onResult: discordPollResult, onError: discordPollError, onExpire: discordPollExpiry,
    });
  }, [signedIn, discordPendingId, discordExpiresAt, csrfToken, disabled, discordLinkError]);

  // Link inspections never repeatedly refetch the profile.
  // Fetch the account once when completion is observed, with logout/unmount cancellation.
  const completedLinkId = link?.status === "linked" ? link.id : discordLink?.status === "linked" ? discordLink.id : null;
  const completionError = useEffectEvent((failure: unknown) => {
    if (failure instanceof ApiError && failure.status === 401)
      void perform("session-recovery", async () => { throw failure; });
    else setError(errorMessage(failure));
  });
  useEffect(() => {
    if (!signedIn || !completedLinkId) return;
    const controller = new AbortController();
    void fetchAccount(controller.signal).catch((failure) => {
      if (!controller.signal.aborted) completionError(failure);
    });
    return () => controller.abort();
  }, [signedIn, completedLinkId, fetchAccount]);

  const pendingDiscordRole = profile?.discordConnection && discordSynchronizationPending(profile.discordConnection) && (view === "dashboard" || view === "discord")
    ? profile.discordConnection.discordId : null;
  const rolePollResult = useEffectEvent((me: Profile | null) => {
    return discordSynchronizationPending(me?.discordConnection) ? "continue" as const : "stop" as const;
  });
  const rolePollError = useEffectEvent((failure: unknown) => {
    if (failure instanceof ApiError && failure.status === 401) { completionError(failure); return "stop" as const; }
    return "retry" as const;
  });
  useEffect(() => {
    if (!pendingDiscordRole || disabled) return;
    return pollLink({
      expiresAt: new Date(Date.now() + 120_000).toISOString(), intervalMs: 5000,
      inspect: (signal) => fetchAccount(signal),
      onResult: rolePollResult, onError: rolePollError, onExpire: () => {},
    });
  }, [pendingDiscordRole, disabled, fetchAccount]);

  const development = session?.authMode === "development";
  const universityEnabled = session?.authMode === "university";
  const schoolLogin = () =>
    void perform("university", async () => {
      if (!consentReady || !privacy) throw new ApiError(400, "consent_required");
      setAuthError("");
      const result = await api<UniversityStart>("/auth/university/start", {
        method: "POST",
        body: {
          consent: { accepted: true, version: privacy.version },
          ...(targetLinkId && linkReference?.token ? { link: { id: targetLinkId, token: linkReference.token } } : {}),
          ...(targetDiscordId && discordLinkReference?.token ? { discordLink: { id: targetDiscordId, token: discordLinkReference.token } } : {}),
        },
        csrfToken,
      });
      window.location.assign(schoolLoginDestination(result.url));
    });
  const alerts = (
    <>
      {callbackDiscordError && !discordLinkError ? (
        <div className="notice notice-error" role="alert">
          <div><strong>Discord 연결을 확인해 주세요</strong><p>{callbackDiscordError}</p></div>
          <button className="text-button" onClick={() => setCallbackDiscordError("")}>닫기</button>
        </div>
      ) : null}
      {callbackLinkError && !linkError ? (
        <div className="notice notice-error" role="alert">
          <div><strong>Minecraft 연결을 확인해 주세요</strong><p>{callbackLinkError}</p></div>
          <button className="text-button" onClick={() => setCallbackLinkError("")}>닫기</button>
        </div>
      ) : null}
      {authError ? (
        <div className="notice notice-error" role="alert">
          <div>
            <strong>학교 로그인을 확인해 주세요</strong>
            <p>{authError}</p>
          </div>
          <button className="text-button" onClick={() => setAuthError("")}>닫기</button>
        </div>
      ) : null}
      {error ? (
        <div className="notice notice-error" role="alert">
          <div>
            <strong>요청을 처리하지 못했어요</strong>
            <p>{error}</p>
          </div>
          <button
            className="text-button"
            disabled={disabled}
            onClick={() => void perform("refresh", refresh)}
          >
            다시 확인
          </button>
        </div>
      ) : null}
      {notice ? (
        <div className="notice notice-success" role="status">
          {notice}
        </div>
      ) : null}
    </>
  );
  const login = (identity: "member" | "outsider") =>
    void perform(identity === "member" ? "login" : "outsider", async () => {
      await api("/auth/development", {
        method: "POST",
        body: { identity },
        csrfToken,
      });
      await refresh();
    });
  const logout = () =>
    void perform("logout", async () => {
      await api("/auth/logout", { method: "POST", csrfToken });
      clearAuthenticatedState();
      await refresh();
      setView("dashboard");
      setNotice("로그아웃했습니다.");
    });

  if (!signedIn)
    return (
      <>
        <DevelopmentStrip development={development} />
        <main className="login-shell">
          <section className="login-card" aria-busy={loading}>
            <Brand large />
            <h1>{targetDiscordId ? "내 Discord 계정 연결" : targetLinkId ? "내 Minecraft 계정 연결" : "Overworld에 오신 것을 환영해요"}</h1>
            <p className="login-description">
              {targetLinkId || targetDiscordId ? "아래 계정이 본인 계정인지 확인해 주세요." : "학교 계정으로 로그인하고"}
              <br />{targetDiscordId ? "학교 인증 후 디스코드 역할과 닉네임을 반영합니다." : targetLinkId ? "학교 인증을 마치면 게임에 자동으로 연결됩니다." : "Minecraft와 Discord 계정을 관리하세요."}
            </p>
            {loading ? (
              <div className="login-loading" role="status">
                <span className="spinner" />
                로그인 상태를 확인하고 있어요.
              </div>
            ) : (
              <>
                {hasDiscordLink ? <div className="login-link-context">
                  {missingDiscordToken || discordLinkError ? <>
                    <strong>새 Discord 연동 링크가 필요해요</strong>
                    <p>{discordLinkError || "디스코드 서버에서 봇의 ‘연동하기’ 버튼을 다시 눌러 주세요."}</p>
                    <a className="recovery-link" href="/">내 계정 페이지로 이동</a>
                  </> : discordLink ? <>
                    <small>연결할 Discord 계정</small><DiscordTarget account={discordLink} />
                    <p className="target-reminder">본인 계정이 아니라면 진행하지 마세요. 계정 변경·해제는 관리자에게 문의해야 합니다.</p>
                  </> : <p>Discord 연동 요청을 확인하고 있습니다.</p>}
                </div> : null}
                {hasLink ? (
                  <div className="login-link-context">
                    {missingToken || linkError ? (
                      <>
                        <strong>새 연결 링크가 필요해요</strong>
                        <p>
                          {linkError ||
                            "게임 채팅에서 원래 연결 링크를 다시 열어 주세요."}
                        </p>
                        <a className="recovery-link" href="/">내 계정 페이지로 이동</a>
                      </>
                    ) : link ? (
                      <>
                        <div className="minecraft-identity">
                          <MinecraftPortrait skin={skin} name={link.minecraftName} loading={skinLoading} />
                          <div><small>연결할 Minecraft 계정</small><strong>{link.minecraftName}</strong><p>정품 Java 계정</p></div>
                        </div>
                        <p className="target-reminder">본인 계정이 아니라면 진행하지 마세요. 게임 접속을 유지해 주세요.</p>
                      </>
                    ) : (
                      <p>연결 요청을 확인하고 있습니다.</p>
                    )}
                  </div>
                ) : null}
                <div className="login-actions">
                  {development ? (
                    <>
                      <button
                        className="primary full"
                        disabled={disabled}
                        onClick={() => login("member")}
                      >
                        {busy === "login"
                          ? "로그인 중…"
                          : "개발용 회원으로 로그인"}
                        <Icon name="arrow" />
                      </button>
                      <button
                        className="text-button preview-entry"
                        disabled={disabled}
                        onClick={() => login("outsider")}
                      >
                        미등록 회원으로 테스트
                      </button>
                    </>
                  ) : universityEnabled ? (
                    <>
                      <PrivacyConsent notice={privacy} accepted={consentAccepted} onChange={setConsentAccepted} loading={privacyLoading} error={privacyError} onRetry={() => void loadPrivacy()} disabled={disabled} />
                      <button className="primary full" disabled={disabled || !consentReady || (hasLink && !targetLinkId) || (hasDiscordLink && !targetDiscordId)} onClick={schoolLogin}>
                        {busy === "university" ? "학교 로그인으로 이동 중…" : targetLinkId || targetDiscordId ? "동의하고 학교 계정으로 연결" : "동의하고 학교 계정으로 로그인"}
                        <Icon name="arrow" />
                      </button>
                      <p className="helper login-helper">
                        숭실대학교 공식 로그인 화면으로 이동합니다.
                      </p>
                    </>
                  ) : (
                    <>
                      <button className="primary full" disabled>
                        학교 로그인 일시 중단
                      </button>
                      <p className="helper login-helper">
                        잠시 후 다시 시도해 주세요.
                      </p>
                    </>
                  )}
                </div>
              </>
            )}
            {alerts}
            <div className="login-footer">OVERWORLD · PASSPORT</div>
          </section>
        </main>
      </>
    );

  const identityCard = (
    <section className="panel" aria-labelledby="identity-heading">
      <div className="panel-head">
        <h2 id="identity-heading">학교 계정 정보</h2>
      </div>
      <div className="identity-summary">
        <span className="avatar avatar-large">
          {profile.displayName.slice(0, 1)}
        </span>
        <div>
          <h3>{profile.displayName}</h3>
          <p>{profile.department || "학교 계정"}</p>
        </div>
      </div>
      <dl className="detail-list">
        <div>
          <dt>학교 인증</dt>
          <dd>{development ? "개발용 가상 신원" : access?.schoolExpired ? "유효기간 만료" : access?.schoolVerified ? "u-SAINT 확인 완료" : "확인 필요"}</dd>
        </div>
        {profile.department ? <div><dt>소속</dt><dd>{profile.department}</dd></div> : null}
        {!development && profile.universityVerifiedUntil ? (
          <div><dt>학교 인증 유효기간</dt><dd>{formatDate(profile.universityVerifiedUntil)}</dd></div>
        ) : null}
        <div>
          <dt>Minecraft</dt>
          <dd>{profile.minecraft?.name ?? "연결되지 않음"}</dd>
        </div>
      </dl>
      <p className="helper">
        {development
          ? "가상 회원 데이터이며 실제 학교 인증이나 운영 서버 권한을 의미하지 않습니다."
          : "학교 인증은 신원 확인에 사용하며, 소모임 회원 자격은 별도로 확인합니다."}
      </p>
      {universityEnabled && access?.schoolExpired ? (
        <div className="identity-reauth">
          <PrivacyConsent notice={privacy} accepted={consentAccepted} onChange={setConsentAccepted} loading={privacyLoading} error={privacyError} onRetry={() => void loadPrivacy()} disabled={disabled} />
          <button className="primary" disabled={disabled || !consentReady} onClick={schoolLogin}>
            {busy === "university" ? "학교 로그인으로 이동 중…" : "동의하고 학교 인증 갱신"}
          </button>
        </div>
      ) : null}
    </section>
  );

  const minecraftCard = (
    <section className="panel" aria-labelledby="minecraft-heading">
      <div className="panel-head">
        <h2 id="minecraft-heading">Minecraft 계정 연결</h2>
        <span className="status-label">
          {profile.minecraft || link?.status === "linked"
            ? "연결됨"
            : link?.webConfirmed
              ? "게임 접속 확인 중"
              : "연결 대기"}
        </span>
      </div>
      {missingToken || linkError ? (
        <div className="empty-state">
          <h3>연결 상태를 확인해 주세요</h3>
          <p>
            {linkError ||
              "확인 정보가 없습니다. 게임 채팅에서 원래 링크를 다시 열어 주세요."}
          </p>
        </div>
      ) : link ? (
        <>
          <div className="minecraft-account-preview">
            <MinecraftPortrait skin={skin} name={link.minecraftName} loading={skinLoading} body />
            <div className="minecraft-account-copy">
              <span className="account-eyebrow">{link.status === "linked" ? "연결된 계정" : "연결할 계정"}</span>
              <h3>{link.minecraftName}</h3>
              <p>정품 Java Edition</p>
              <div className="account-check"><Icon name="check" /><span>{link.status === "linked" ? "Overworld 계정에 연결됨" : "학교 계정과 연결할 대상을 확인해 주세요"}</span></div>
              {link.status === "pending" ? <small>요청 유효기간 · {formatDate(link.expiresAt)}</small> : null}
            </div>
          </div>
          {link.status === "linked" ? (
            <p className="helper success-text" role="status">
              {automaticMoveNotice}
            </p>
          ) : linkExpired ? (
            <p className="helper warning">
              연결 요청이 만료되었습니다. 게임에서 /passport 로 새 링크를 받아 주세요.
            </p>
          ) : !minecraftAccess?.allowed ? (
            <div>
              <p className="helper warning">{serversState === "loading" ? "서버 접속 권한을 확인하고 있습니다." : serversState === "error" ? "서버 접속 권한을 확인하지 못했습니다. 새로고침 후 다시 시도해 주세요." : minecraftAccess?.message}</p>
              {access?.schoolExpired && view !== "dashboard" ? <button className="text-button" onClick={() => setView("dashboard")}>학교 계정 정보에서 인증 갱신</button> : null}
            </div>
          ) : link.webConfirmed ? (
            <div className="command-block" role="status">
              <p>웹 확인을 완료했습니다. 게임 접속을 확인하고 있어요.</p>
              <small>게임 접속을 유지해 주세요. 연결이 완료되면 허용된 로비로 자동 이동합니다.</small>
            </div>
          ) : (
            <div className="connection-confirm">
              <PrivacyConsent notice={privacy} accepted={consentAccepted} onChange={setConsentAccepted} loading={privacyLoading} error={privacyError} onRetry={() => void loadPrivacy()} disabled={disabled} />
              <button
                className="primary"
                disabled={disabled || !consentReady}
                onClick={() =>
                  void perform("confirm", async () => {
                    if (!privacy || !consentReady) throw new ApiError(400, "consent_required");
                    const result = await api<LinkSummary>(`/link-sessions/${link.id}/web-confirm`, {
                      method: "POST",
                      body: { token: linkReference?.token, consent: { accepted: true, version: privacy.version } },
                      csrfToken,
                    });
                    setLink((current) => current?.id === result.id ? {
                      ...current, ...result, webConfirmed: true,
                      gameConfirmed: result.status === "linked" || current.gameConfirmed,
                    } : current);
                    setLinkPollError("");
                    setCallbackLinkError("");
                  })
                }
              >
                동의하고 이 Minecraft 계정 연결
                <Icon name="arrow" />
              </button>
            </div>
          )}
          {linkPollError ? <p className="helper warning" role="status">{linkPollError}</p> : null}
          {link.status === "pending" && !linkExpired ? <p className="helper">연결 상태를 자동으로 확인합니다.</p> : null}
          <button
            className="text-button refresh-link"
            disabled={disabled}
            onClick={() => void perform("refresh", refresh)}
          >
            연결 상태 새로고침
          </button>
        </>
      ) : profile.minecraft ? (
        <div className="minecraft-account-preview">
          <MinecraftPortrait skin={skin} name={profile.minecraft.name} loading={skinLoading} body />
          <div className="minecraft-account-copy">
            <span className="account-eyebrow">연결된 계정</span>
            <h3>{profile.minecraft.name}</h3>
            <p>정품 Java Edition</p>
            <div className="account-check"><Icon name="check" /><span>Overworld 계정에 연결됨</span></div>
            <small>게임에 접속하면 접속 권한에 따라 서버로 이동합니다.</small>
          </div>
        </div>
      ) : (
        <>
          <div className="empty-state">
            <h3>게임에서 연결을 시작해 주세요</h3>
            <p>
              대기 서버에 접속한 뒤 채팅의 <strong>u-SAINT 인증하기</strong>{" "}
              링크를 열어 주세요.
            </p>
          </div>
          <ol className="connection-steps">
            <li>
              <span>1</span>
              <div>
                <strong>게임 접속</strong>
                <small>채팅의 인증 링크 열기</small>
              </div>
            </li>
            <li>
              <span>2</span>
              <div>
                <strong>학교 인증</strong>
                <small>동의 후 학교 계정 로그인</small>
              </div>
            </li>
            <li>
              <span>3</span>
              <div>
                <strong>자동 연결</strong>
                <small>접속 확인 후 로비로 이동</small>
              </div>
            </li>
          </ol>
        </>
      )}
    </section>
  );

  const discordCard = <DiscordCard
    connection={profile.discordConnection} link={discordLink} linkError={discordLinkError}
    missingToken={missingDiscordToken} enabled={discordEnabled} active={canLinkDiscord} schoolExpired={Boolean(access?.schoolExpired)} disabled={disabled}
    consent={<PrivacyConsent notice={privacy} accepted={consentAccepted} onChange={setConsentAccepted} loading={privacyLoading} error={privacyError} onRetry={() => void loadPrivacy()} disabled={disabled} />}
    consentReady={consentReady}
    onConfirm={() => void perform("discord-confirm", async () => {
      if (!privacy || !consentReady || !discordLink || !discordLinkReference?.token) throw new ApiError(400, "consent_required");
      const result = await api<LinkSummary>(`/discord/link-sessions/${discordLink.id}/web-confirm`, {
        method: "POST", body: { token: discordLinkReference.token, consent: { accepted: true, version: privacy.version } }, csrfToken,
      });
      setDiscordLink((current) => current?.id === result.id ? { ...current, ...result } : current);
      setCallbackDiscordError("");
    })}
    onManagementConsent={() => void perform("discord-consent", async () => {
      if (!privacy || !consentReady) throw new ApiError(400, "consent_required");
      await api("/me/discord/consent", { method: "POST", body: { consent: { accepted: true, version: privacy.version } }, csrfToken });
      setConsentAccepted(false);
      await refresh();
      setNotice("Discord 관리에 동의했습니다. 역할과 닉네임의 실제 처리 상태를 확인해 주세요.");
    })}
    onAccount={() => setView("dashboard")}
  />;

  const serversCard = (
    <section className="panel" aria-labelledby="servers-heading">
      <div className="panel-head">
        <h2 id="servers-heading">접속 가능한 서버</h2>
        <small>{serversState === "ready" ? `${servers.length}개` : serversState === "loading" ? "확인 중" : "확인 필요"}</small>
      </div>
      {serversState !== "ready" ? (
        <div className="empty-state" role="status"><h3>{serversState === "loading" ? "접속 권한을 확인하고 있습니다" : "접속 권한을 확인하지 못했습니다"}</h3>{serversState === "error" ? <p>새로고침하여 현재 접속할 수 있는 서버를 다시 확인해 주세요.</p> : null}</div>
      ) : servers.length ? (
        <ul className="server-list">
          {servers.map((server) => (
            <li key={server.id}>
              <div>
                <h3>{server.label}</h3>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <div className="empty-state">
          <h3>접속 가능한 서버가 없습니다</h3>
          <p>{access?.suspended ? "서버 이용이 정지되어 있습니다. 운영자에게 문의해 주세요." : access?.schoolExpired ? "학교 인증이 만료되었습니다. 학교 계정 정보에서 인증을 갱신해 주세요." : "서버별 접근 설정에 따라 목록이 표시됩니다. 권한 확인이 필요하면 운영자에게 문의해 주세요."}</p>
        </div>
      )}
      <p className="helper card-footnote">
        {profile.minecraft
          ? "회원 상태와 서버별 접근 설정에 따라 접속 권한이 결정됩니다."
          : "서버에 입장하려면 Minecraft 계정 연결을 완료해야 합니다."}
      </p>
    </section>
  );

  const currentNavigation = navigation.find((item) => item.id === view)!;
  return (
    <AppShell
      title={currentNavigation.label}
      navItems={navigation}
      activeView={view}
      onNavigate={(id) => setView(id as View)}
      displayName={profile.displayName}
      description={access?.label ?? "회원 확인 대기"}
      development={development}
      onLogout={logout}
      busy={disabled}
    >
      <div className="page-head">
        <div>
          <h1>{currentNavigation.label}</h1>
          <p>
            {view === "dashboard"
              ? `${profile.displayName}님의 계정과 접속 권한을 확인하세요.`
              : view === "minecraft"
                ? "본인 계정을 확인하면 게임 접속을 확인해 자동으로 연결합니다."
                : view === "discord"
                  ? "연결된 Discord 계정과 역할·닉네임 반영 상태를 확인합니다."
                  : "현재 접속할 수 있는 서버를 확인합니다."}
          </p>
        </div>
        <button
          disabled={disabled}
          onClick={() => void perform("refresh", refresh)}
        >
          {busy === "refresh" ? "확인 중…" : "새로고침"}
        </button>
      </div>
      {alerts}
      {view === "dashboard" ? (
        <>
        <MembershipCard profile={profile} development={development} />
        <div className="dashboard-grid">
          <div className="stack">
            {minecraftCard}
            {serversCard}
            {discordCard}
          </div>
          <div className="stack">
            {identityCard}
            <section className="panel support-panel">
              <div className="panel-head">
                <h2>연결이 잘되지 않나요?</h2>
              </div>
              <p className="helper">
                게임 닉네임과 화면에 표시된 오류를 소모임 운영자에게 알려
                주세요.
              </p>
              <div className="support-row">
                <span>학교 인증</span>
                <small>{development ? "개발용 신원" : access?.schoolExpired ? "갱신 필요" : "u-SAINT 연동"}</small>
              </div>
              <div className="support-row">
                <span>Discord 연결</span>
                <small>디스코드 봇에서 시작</small>
              </div>
            </section>
          </div>
        </div>
        </>
      ) : (
        <div className="single-content">
          {view === "minecraft"
            ? minecraftCard
            : view === "discord"
              ? discordCard
              : serversCard}
        </div>
      )}
    </AppShell>
  );
}
