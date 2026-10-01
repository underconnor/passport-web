import type { ReactNode } from "react";

export type IconName =
  | "brand"
  | "dashboard"
  | "book"
  | "check"
  | "settings"
  | "logout"
  | "arrow";
export function Icon({ name }: { name: IconName }) {
  return (
    <img
      className="ds-icon"
      src={`/assets/${name}.svg`}
      alt=""
      aria-hidden="true"
    />
  );
}
export function Brand({ large = false }: { large?: boolean }) {
  return (
    <a
      className={`brand${large ? " brand-large" : ""}`}
      href="/"
      aria-label="Passport 홈"
    >
      <span className="brand-mark">
        <Icon name="brand" />
      </span>
      <span>Passport</span>
    </a>
  );
}
export function DevelopmentStrip({
  development,
}: {
  development: boolean;
}) {
  if (!development) return null;
  return (
    <div className="development-strip">
      <span>
        Passport 개발 환경 · 가상 회원 데이터
      </span>
      <span className="strip-detail">
        실제 학교 인증 아님
      </span>
    </div>
  );
}
interface NavigationItem {
  id: string;
  label: string;
  icon: IconName;
}
export function AppShell({
  title,
  navItems,
  activeView,
  onNavigate,
  displayName,
  description,
  development,
  onLogout,
  busy,
  children,
}: {
  title: string;
  navItems: NavigationItem[];
  activeView: string;
  onNavigate: (id: string) => void;
  displayName: string;
  description: string;
  development: boolean;
  onLogout?: () => void;
  busy?: boolean;
  children: ReactNode;
}) {
  return (
    <>
      <DevelopmentStrip development={development} />
      <div className="app-shell">
        <aside className="app-sidebar">
          <div className="sidebar-brand">
            <Brand />
            <p>Overworld {onLogout ? "회원 공간" : "운영 공간"}</p>
          </div>
          <nav aria-label="주 메뉴">
            {navItems.map((item) => (
              <button
                key={item.id}
                type="button"
                aria-current={activeView === item.id ? "page" : undefined}
                onClick={() => onNavigate(item.id)}
              >
                <Icon name={item.icon} />
                <span>{item.label}</span>
              </button>
            ))}
          </nav>
          <div className="sidebar-profile">
            <span className="avatar">{displayName.slice(0, 1)}</span>
            <div className="profile-label">
              <strong>{displayName}</strong>
              <small>{description}</small>
            </div>
          </div>
        </aside>
        <div className="app-body">
          <header className="topbar">
            <span>{title}</span>
            <div className="topbar-right">
              <span className="topbar-context">
                {onLogout ? "Overworld 회원 포털" : "관리자 전용"}
              </span>
              <span className="avatar">{displayName.slice(0, 1)}</span>
              <strong>{displayName}</strong>
              {onLogout ? (
                <button
                  className="header-logout text-button"
                  disabled={busy}
                  onClick={onLogout}
                >
                  로그아웃
                </button>
              ) : null}
            </div>
          </header>
          <main id="main-content">{children}</main>
        </div>
      </div>
    </>
  );
}
