"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  Home,
  Compass,
  GraduationCap,
  BriefcaseBusiness,
  CalendarDays,
  Users,
  MessageSquare,
  UserRoundPlus,
  Heart,
  Search,
  Bell,
  Menu,
  X,
  Settings,
  LifeBuoy,
  LogOut,
  ShieldCheck,
  ChartNoAxesCombined,
  Mail,
  ClipboardCheck,
  Sparkles,
} from "lucide-react";
import { Brand, Avatar, Badge, Loading, ErrorBox, Empty, Button } from "./ui";
import { Provider, useApp, useData } from "./app-context";
import {
  HomeView,
  DirectoryView,
  ProfileView,
  ResourcesView,
  ResourceView,
  SearchView,
} from "./network-views";
import {
  ApplicationsView,
  ApplyView,
  EventRegistrationView,
  CommunityView,
  ManageView,
  GivingView,
  CreateResourceView,
} from "./resource-views";
import {
  MentorshipView,
  MentorshipDetail,
  ConnectionsView,
  MessagesView,
  NotificationsView,
  SettingsView,
  SupportView,
} from "./member-views";
import { AdminView } from "./admin-views";
const menu = [
  ["Home", "/app", Home],
  ["Discover", "/app/discover", Compass],
  ["Mentorship", "/app/mentorship", GraduationCap],
  ["Opportunities", "/app/opportunities", BriefcaseBusiness],
  ["Events", "/app/events", CalendarDays],
  ["Communities", "/app/communities", Users],
  ["Messages", "/app/messages", MessageSquare],
  ["Connections", "/app/connections", UserRoundPlus],
  ["Giving Back", "/app/giving", Heart],
] as const;
function Shell() {
  const { user, api, demo } = useApp(),
    router = useRouter(),
    path = usePathname(),
    params = useSearchParams();
  const [open, setOpen] = useState(false),
    [search, setSearch] = useState(params.get("q") || ""),
    [logoutError, setLogoutError] = useState("");
  const notifications = useData("notifications");
  useEffect(() => {
    setOpen(false);
  }, [path]);
  useEffect(() => {
    const t = setInterval(() => notifications.reload(), 30000);
    return () => clearInterval(t);
  }, [notifications.reload]);
  const unread =
    notifications.data?.items?.filter((n: any) => !n.read_at).length || 0;
  const segments = path
    .replace(/^\/app\/?/, "")
    .split("/")
    .filter(Boolean);
  const [section, identifier, subpage] = segments;
  const active = (href: string) =>
    href === "/app" ? path === "/app" : path.startsWith(href);
  async function logout() {
    try {
      await api("auth/logout", "POST", {});
      router.replace("/login");
      router.refresh();
    } catch (e) {
      setLogoutError((e as Error).message);
    }
  }
  let view: React.ReactNode;
  if (!section) view = <HomeView />;
  else if (section === "discover" || section === "mentors")
    view = identifier ? (
      <ProfileView id={identifier} />
    ) : (
      <DirectoryView mentors={section === "mentors"} />
    );
  else if (section === "mentorship")
    view = identifier ? (
      <MentorshipDetail id={identifier} tab={subpage} />
    ) : (
      <MentorshipView />
    );
  else if (section === "opportunities")
    view = identifier ? (
      subpage === "apply" ? (
        <ApplyView id={identifier} />
      ) : (
        <ResourceView id={identifier} kind="opportunity" tab={subpage} />
      )
    ) : (
      <ResourcesView kind="opportunity" />
    );
  else if (section === "events")
    view = identifier ? (
      subpage === "register" ? (
        <EventRegistrationView id={identifier} />
      ) : (
        <ResourceView id={identifier} kind="event" tab={subpage} />
      )
    ) : (
      <ResourcesView kind="event" />
    );
  else if (section === "communities")
    view = identifier ? (
      <CommunityView id={identifier} tab={subpage} />
    ) : (
      <ResourcesView kind="community" />
    );
  else if (section === "giving")
    view =
      identifier === "history" || identifier === "confirm" ? (
        <GivingView confirm={identifier === "confirm"} />
      ) : identifier ? (
        <ResourceView id={identifier} kind="campaign" tab={subpage} />
      ) : (
        <ResourcesView kind="campaign" />
      );
  else if (section === "applications" || section === "applicants")
    view = <ApplicationsView managed={section === "applicants"} />;
  else if (section === "saved")
    view = <ResourcesView kind="opportunity" saved />;
  else if (section === "registrations")
    view = <ResourcesView kind="event" registered />;
  else if (section === "connections") view = <ConnectionsView />;
  else if (section === "messages") view = <MessagesView peer={identifier} />;
  else if (section === "notifications") view = <NotificationsView />;
  else if (section === "settings" || section === "privacy")
    view = <SettingsView privacy={section === "privacy"} />;
  else if (section === "support") view = <SupportView />;
  else if (section === "manage")
    view = identifier ? (
      <CreateResourceView kind="opportunity" editId={identifier} />
    ) : (
      <ManageView />
    );
  else if (section === "create")
    view = <CreateResourceView kind={identifier || "opportunity"} />;
  else if (section === "search")
    view = <SearchView query={params.get("q") || ""} />;
  else if (section === "university")
    view = (
      <>
        <div className="page-title">
          <span className="eyebrow">
            ONE UNIVERSITY. A LIFETIME OF CONNECTIONS.
          </span>
          <h1>Afe Babalola University, Ado-Ekiti</h1>
          <p>ABUAD · Our shared beginning. Our connected future.</p>
        </div>
        <ResourcesView kind="announcement" />
      </>
    );
  else if (section === "admin")
    view =
      user?.role === "admin" ? (
        <AdminView tab={identifier || "overview"} />
      ) : (
        <ErrorBox message="Administrator access is required. Your account cannot access this area." />
      );
  else
    view = (
      <Empty
        title="Page not found"
        body="Return to your ABUAD network to continue."
        href="/app"
        label="Back home"
      />
    );
  return (
    <div className="app-layout">
      <a href="#main-content" className="skip-link">
        Skip to content
      </a>
      {open ? (
        <div className="sidebar-shade" onClick={() => setOpen(false)} />
      ) : null}
      <aside className={"sidebar " + (open ? "open" : "")}>
        <Brand />
        <div className="institution">
          Afe Babalola University
          <br />
          Ado-Ekiti
        </div>
        <Badge>ABUAD ALUMNI NETWORK</Badge>
        <nav aria-label="Main navigation">
          {menu.map(([label, href, Icon]) => (
            <Link
              key={href}
              href={href}
              className={active(href) ? "active" : ""}
            >
              <Icon size={19} />
              <span>{label}</span>
              {label === "Messages" && unread > 0 ? (
                <i className="red-dot" />
              ) : null}
            </Link>
          ))}
        </nav>
        {["alumni", "employer", "admin"].includes(user?.role) ? (
          <div className="sidebar-group">
            <span>YOUR WORKSPACE</span>
            <Link href="/app/manage">
              <ClipboardCheck size={18} />
              Manage content
            </Link>
            <Link href="/app/applicants">
              <Users size={18} />
              Applications received
            </Link>
          </div>
        ) : null}
        {user?.role === "admin" ? (
          <div className="sidebar-group">
            <span>ADMINISTRATION</span>
            {[
              ["Intelligence", "overview", ChartNoAxesCombined],
              ["Alumni management", "users", Users],
              ["Moderation", "moderation", ClipboardCheck],
              ["Communications", "communications", Mail],
              ["Audit & security", "audit", ShieldCheck],
            ].map(([label, slug, Icon]) => {
              const I = Icon as typeof Home;
              return (
                <Link href={"/app/admin/" + slug} key={String(slug)}>
                  <I size={18} />
                  {String(label)}
                </Link>
              );
            })}
          </div>
        ) : null}
        <div className="sidebar-bottom">
          <Link href="/app/support">
            <LifeBuoy size={18} />
            Help & Support
          </Link>
          <Link href="/app/settings">
            <Settings size={18} />
            Settings
          </Link>
          <Link href="/app/settings" className="sidebar-profile">
            <Avatar name={user!.name} index={user!.profile.avatar} size={36} />
            <span>
              <strong>{user!.name}</strong>
              <small>{user!.role} · ABUAD</small>
            </span>
          </Link>
          <button onClick={logout}>
            <LogOut size={17} />
            Sign out
          </button>
        </div>
      </aside>
      <div className="workspace">
        <header className="topbar">
          <button
            className="icon-button menu-toggle"
            aria-label="Open navigation"
            onClick={() => setOpen(!open)}
          >
            {open ? <X /> : <Menu />}
          </button>
          <form
            className="global-search"
            onSubmit={(e) => {
              e.preventDefault();
              router.push("/app/search?q=" + encodeURIComponent(search));
            }}
          >
            <Search size={18} />
            <input
              aria-label="Search the ABUAD network"
              placeholder="Search alumni, opportunities, events and communities…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </form>
          <Link
            href="/app/notifications"
            className="notification-button"
            aria-label={`${unread} unread notifications`}
          >
            <Bell size={21} />
            {unread ? <span>{unread > 9 ? "9+" : unread}</span> : null}
          </Link>
          <Link href="/app/settings" className="top-profile">
            <Avatar name={user!.name} index={user!.profile.avatar} size={36} />
            <span>
              <strong>{user!.name}</strong>
              <small>{user!.profile.title || user!.role} · ABUAD</small>
            </span>
          </Link>
        </header>
        <main id="main-content" className="app-main">
          {demo ? (
            <div className="demo-banner">
              Demonstration content is enabled. Example alumni and opportunities
              are fictional.
            </div>
          ) : null}
          {logoutError ? <ErrorBox message={logoutError} /> : null}
          {!user!.verified ? (
            <div className="verification-banner">
              <ShieldCheck size={19} />
              <span>
                Your profile is awaiting ABUAD verification. You can explore and
                connect; publishing and mentorship availability require
                verification.
              </span>
              <Link href="/app/support">Get help</Link>
            </div>
          ) : null}
          {view}
        </main>
        <footer className="app-footer">
          <span>Afe Babalola University, Ado-Ekiti · ALUMNEX</span>
          <Link href="/security">Security & privacy</Link>
        </footer>
      </div>
      <nav className="mobile-nav" aria-label="Mobile navigation">
        {menu
          .filter((_, i) => [0, 1, 2, 3, 6].includes(i))
          .map(([label, href, Icon]) => (
            <Link
              href={href}
              key={href}
              className={active(href) ? "active" : ""}
            >
              <Icon size={20} />
              <small>{label === "Opportunities" ? "Careers" : label}</small>
            </Link>
          ))}
        <Link href="/app/settings">
          <Avatar name={user!.name} index={user!.profile.avatar} size={22} />
          <small>Profile</small>
        </Link>
      </nav>
    </div>
  );
}
export default function AppShell() {
  return (
    <Provider>
      <Shell />
    </Provider>
  );
}
