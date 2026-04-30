"use client";

import Link from "next/link";
import { useSession } from "next-auth/react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { SignOutButton } from "@/components/SignOutButton";
import { DEFAULT_DATASPACE_COLOR } from "@/lib/dataspaceColor";

export function AppHeader() {
  const { data: session, status } = useSession();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();
  const [showNewMenu, setShowNewMenu] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const [showMeetingMenu, setShowMeetingMenu] = useState(false);
  const [creatingMeeting, setCreatingMeeting] = useState(false);
  const [createMeetingError, setCreateMeetingError] = useState<string | null>(null);
  const [showDataspaceMenu, setShowDataspaceMenu] = useState(false);
  const [recentDataspaces, setRecentDataspaces] = useState<
    Array<{ id: string; name: string; color: string | null }>
  >([]);
  const [recentError, setRecentError] = useState<string | null>(null);
  const [loadingRecent, setLoadingRecent] = useState(false);
  const userMenuCloseTimeout = useRef<number | null>(null);
  const dataspaceMenuCloseTimeout = useRef<number | null>(null);
  const templatesMenuCloseTimeout = useRef<number | null>(null);
  const meetingMenuCloseTimeout = useRef<number | null>(null);
  const MENU_CLOSE_DELAY = 140;

  const dataspaceIdFromPath = useMemo(() => {
    const match = pathname?.match(/^\/dataspace\/([^/]+)$/);
    return match?.[1] ?? "";
  }, [pathname]);

  const dataspaceMeetingLink = useMemo(() => {
    if (!dataspaceIdFromPath) return "/meetings/new";
    return `/meetings/new?dataspaceId=${encodeURIComponent(dataspaceIdFromPath)}`;
  }, [dataspaceIdFromPath]);

  async function handleInstantMeeting() {
    if (creatingMeeting) return;
    setCreateMeetingError(null);
    setCreatingMeeting(true);
    try {
      const response = await fetch("/api/meetings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          dataspaceId: dataspaceIdFromPath || null,
          transcriptionProvider: "DEEPGRAMLIVE"
        })
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        const message = payload?.error?.formErrors?.[0] ?? payload?.error ?? "Unable to create meeting";
        setCreateMeetingError(message);
        return;
      }
      if (payload?.id) {
        router.push(`/meetings/${payload.id}`);
        return;
      }
      setCreateMeetingError("Meeting created, but no ID returned.");
    } catch {
      setCreateMeetingError("Unable to create meeting.");
    } finally {
      setCreatingMeeting(false);
      setShowMeetingMenu(false);
    }
  }

  async function loadRecentDataspaces() {
    if (loadingRecent || recentDataspaces.length > 0) return;
    setLoadingRecent(true);
    setRecentError(null);
    try {
      const response = await fetch("/api/dataspaces/recent");
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        setRecentError(payload?.error ?? "Unable to load dataspaces");
      } else {
        const items = Array.isArray(payload?.dataspaces) ? payload.dataspaces : [];
        setRecentDataspaces(items);
      }
    } catch {
      setRecentError("Unable to load dataspaces");
    } finally {
      setLoadingRecent(false);
    }
  }

  function clearMenuTimer(timerRef: React.MutableRefObject<number | null>) {
    if (timerRef.current) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }

  function scheduleMenuClose(
    timerRef: React.MutableRefObject<number | null>,
    close: () => void
  ) {
    clearMenuTimer(timerRef);
    timerRef.current = window.setTimeout(() => {
      close();
    }, MENU_CLOSE_DELAY);
  }

  function openUserMenu() {
    clearMenuTimer(userMenuCloseTimeout);
    setShowUserMenu(true);
  }

  function scheduleCloseUserMenu() {
    scheduleMenuClose(userMenuCloseTimeout, () => setShowUserMenu(false));
  }

  function openDataspaceMenu() {
    clearMenuTimer(dataspaceMenuCloseTimeout);
    setShowDataspaceMenu(true);
    loadRecentDataspaces();
  }

  function scheduleCloseDataspaceMenu() {
    scheduleMenuClose(dataspaceMenuCloseTimeout, () => setShowDataspaceMenu(false));
  }

  function openTemplatesMenu() {
    clearMenuTimer(templatesMenuCloseTimeout);
    setShowNewMenu(true);
  }

  function scheduleCloseTemplatesMenu() {
    scheduleMenuClose(templatesMenuCloseTimeout, () => setShowNewMenu(false));
  }

  function openMeetingMenu() {
    clearMenuTimer(meetingMenuCloseTimeout);
    setShowMeetingMenu(true);
  }

  function scheduleCloseMeetingMenu() {
    scheduleMenuClose(meetingMenuCloseTimeout, () => setShowMeetingMenu(false));
  }

  useEffect(() => {
    if (!session?.user || recentDataspaces.length > 0 || loadingRecent) return;
    void loadRecentDataspaces();
  }, [session?.user, recentDataspaces.length, loadingRecent]);

  if (status === "loading") {
    return null;
  }

  if (!session?.user) {
    return (
      <header className="sticky top-3 z-20">
        <div className="dr-shell dr-shell-pad relative w-full rounded-[28px] border border-[color:var(--stroke)] bg-[color:var(--card)] py-3 shadow-[0_18px_45px_rgba(15,23,42,0.12)] backdrop-blur">
          <div className="flex items-center justify-between gap-3">
          <a
            href="https://democracyroutes.com"
            className="flex items-center gap-3"
            aria-label="Democracy Routes home"
          >
            <span className="relative flex h-9 w-9 items-center justify-center overflow-hidden rounded-2xl border border-emerald-200/80 bg-white/80 shadow-[0_8px_20px_rgba(16,185,129,0.2)]">
              <img
                src="/logo-120.png"
                alt="Democracy Routes logo"
                className="h-full w-full object-contain"
              />
            </span>
            <div className="leading-tight">
              <div
                className="text-base font-semibold text-slate-900 sm:text-lg"
                style={{ fontFamily: "var(--font-serif)" }}
              >
                Democracy Routes
              </div>
              <div className="text-[11px] uppercase tracking-[0.2em] text-slate-500">
                Civic collaboration
              </div>
            </div>
          </a>
            <div className="hidden items-center gap-2 text-xs text-slate-600 sm:flex">
              <Link href="/presentation" className="rounded-full px-3 py-1 hover:bg-white/70">
                Presentation
              </Link>
              <Link href="/about" className="rounded-full px-3 py-1 hover:bg-white/70">
                About
              </Link>
              <Link href="/login" className="dr-button px-4 py-2 text-xs sm:text-sm">
                Log in
              </Link>
              <Link href="/register" className="dr-button-outline px-4 py-2 text-xs sm:text-sm">
                Create account
              </Link>
            </div>
            <button
              type="button"
              onClick={() => setShowMobileMenu((prev) => !prev)}
              className="sm:hidden rounded-full border border-slate-200/80 bg-white/80 px-3 py-2 text-[11px] font-semibold text-slate-700"
              aria-label="Toggle menu"
              aria-expanded={showMobileMenu}
            >
              Menu
            </button>
          </div>
          {showMobileMenu ? (
            <div className="absolute left-0 right-0 top-full z-40 mt-3 flex flex-col gap-2 rounded-2xl border border-slate-300 bg-white p-3 text-sm text-slate-700 shadow-[0_22px_54px_rgba(15,23,42,0.16)] sm:hidden">
              <Link href="/presentation" onClick={() => setShowMobileMenu(false)}>
                Presentation
              </Link>
              <Link href="/about" onClick={() => setShowMobileMenu(false)}>
                About
              </Link>
              <Link href="/login" onClick={() => setShowMobileMenu(false)}>
                Log in
              </Link>
              <Link href="/register" onClick={() => setShowMobileMenu(false)}>
                Create account
              </Link>
            </div>
          ) : null}
        </div>
      </header>
    );
  }

  const isTemplateWorkspace =
    pathname?.startsWith("/modular") ||
    pathname === "/templates/workspace" ||
    (pathname === "/flows/new" && searchParams?.get("mode") === "template") ||
    (pathname?.startsWith("/flows/") && pathname?.endsWith("/edit")) ||
    (pathname === "/templates/ai" && searchParams?.get("embedded") === "workspace");
  const isMeetingWorkspace =
    pathname?.startsWith("/meetings/") &&
    pathname !== "/meetings/new" &&
    !pathname?.endsWith("/edit");

  if (isMeetingWorkspace) {
    const isTemplateShell = false;
    return (
      <header className="pointer-events-none fixed inset-x-0 top-0 z-[120]">
        <div className="dr-shell dr-shell-pad flex w-full items-center justify-end py-2 sm:py-3">
          <button
            type="button"
            onClick={() => setShowMobileMenu((prev) => !prev)}
            className="pointer-events-auto inline-flex h-11 items-center gap-2 rounded-full border border-emerald-200/80 bg-white/90 px-3 text-[13px] font-semibold text-slate-700 shadow-[0_12px_28px_rgba(15,23,42,0.14)] backdrop-blur hover:bg-white hover:text-slate-900"
            aria-label={isTemplateShell ? "Toggle template workspace navigation" : "Toggle meeting navigation"}
            aria-expanded={showMobileMenu}
          >
            <span className="relative flex h-6 w-6 items-center justify-center overflow-hidden rounded-full border border-emerald-200/80 bg-white shadow-[0_4px_12px_rgba(16,185,129,0.18)]">
              <img
                src="/logo-120.png"
                alt="Democracy Routes logo"
                className="h-full w-full object-contain"
              />
            </span>
            <span className="leading-none text-slate-500">{showMobileMenu ? "×" : "☰"}</span>
          </button>
        </div>

        {showMobileMenu ? (
          <>
            <button
              type="button"
              aria-label="Close template workspace menu"
              onClick={() => setShowMobileMenu(false)}
              className="pointer-events-auto absolute inset-0 top-0 z-[125] h-dvh w-full bg-slate-950/22 backdrop-blur-[1px]"
            />
            <div className="pointer-events-auto absolute right-0 top-full z-[130] mt-1 w-full px-2 sm:px-3">
              <div className="ml-auto grid max-h-[calc(100dvh-5rem)] w-full max-w-[920px] gap-3 overflow-y-auto rounded-[24px] border border-slate-300 bg-white p-4 shadow-[0_34px_110px_rgba(15,23,42,0.34)] md:grid-cols-[1.2fr,1fr,1fr]">
                <div className="space-y-2">
                  <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-500">
                    {isTemplateShell ? "Workspace" : "Meetings"}
                  </div>
                  <Link
                    href={isTemplateShell ? "/flows" : "/dashboard"}
                    onClick={() => setShowMobileMenu(false)}
                    className="block rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-900 hover:bg-white"
                  >
                    {isTemplateShell ? "All templates" : "Dashboard"}
                  </Link>
                  <Link
                    href={isTemplateShell ? "/templates/workspace?mode=modular" : "/meetings/new"}
                    onClick={() => setShowMobileMenu(false)}
                    className="block rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-900 hover:bg-white"
                  >
                    {isTemplateShell ? "Template Builder" : "New meeting"}
                  </Link>
                  {isTemplateShell ? (
                    <Link
                      href={dataspaceMeetingLink}
                      onClick={() => setShowMobileMenu(false)}
                      className="block rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-900 hover:bg-white"
                    >
                      New meeting
                    </Link>
                  ) : null}
                  {isTemplateShell && session.user.role === "ADMIN" ? (
                    <Link
                      href="/templates/workspace/modules"
                      onClick={() => setShowMobileMenu(false)}
                      className="block rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-900 hover:bg-white"
                    >
                      Module descriptions
                    </Link>
                  ) : null}
                </div>

                <div className="space-y-2">
                  <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-500">
                    Navigation
                  </div>
                  <Link
                    href="/dashboard"
                    onClick={() => setShowMobileMenu(false)}
                    className="block rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 hover:bg-slate-50"
                  >
                    Dashboard
                  </Link>
                  <Link
                    href="/dataspace"
                    onClick={() => setShowMobileMenu(false)}
                    className="block rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 hover:bg-slate-50"
                  >
                    Dataspaces
                  </Link>
                  <Link
                    href="/presentation"
                    onClick={() => setShowMobileMenu(false)}
                    className="block rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 hover:bg-slate-50"
                  >
                    Presentation
                  </Link>
                  <Link
                    href="/open-problems"
                    onClick={() => setShowMobileMenu(false)}
                    className="block rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 hover:bg-slate-50"
                  >
                    Open Problems
                  </Link>
                  <Link
                    href="/box"
                    onClick={() => setShowMobileMenu(false)}
                    className="block rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 hover:bg-slate-50"
                  >
                    Box
                  </Link>
                </div>

                <div className="space-y-2">
                  <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-500">
                    Account
                  </div>
                  <Link
                    href="/account"
                    onClick={() => setShowMobileMenu(false)}
                    className="block rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 hover:bg-slate-50"
                  >
                    Profile settings
                  </Link>
                  <Link
                    href="/remote-worker"
                    onClick={() => setShowMobileMenu(false)}
                    className="block rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 hover:bg-slate-50"
                  >
                    Remote worker
                  </Link>
                  <Link
                    href="/presentation"
                    onClick={() => setShowMobileMenu(false)}
                    className="block rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 hover:bg-slate-50"
                  >
                    Presentation
                  </Link>
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                    <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500">
                      Policies
                    </div>
                    <div className="mt-2 flex flex-col gap-2">
                      <Link
                        href="/privacy"
                        onClick={() => setShowMobileMenu(false)}
                        className="text-sm text-slate-700 hover:text-slate-900"
                      >
                        Privacy Policy
                      </Link>
                      <Link
                        href="/cookies"
                        onClick={() => setShowMobileMenu(false)}
                        className="text-sm text-slate-700 hover:text-slate-900"
                      >
                        Cookie Policy
                      </Link>
                    </div>
                  </div>
                  {session.user.role === "ADMIN" ? (
                    <Link
                      href="/admin"
                      onClick={() => setShowMobileMenu(false)}
                      className="block rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 hover:bg-slate-50"
                    >
                      Admin
                    </Link>
                  ) : null}
                  <div className="rounded-2xl border border-slate-200 bg-white px-4 py-2">
                    <SignOutButton onBeforeSignOut={() => setShowMobileMenu(false)} />
                  </div>
                </div>
              </div>
            </div>
          </>
        ) : null}
      </header>
    );
  }

  return (
    <header className="sticky top-3 z-20">
      <div className="dr-shell dr-shell-pad relative w-full rounded-[28px] border border-[color:var(--stroke)] bg-[color:var(--card)] py-3 shadow-[0_18px_45px_rgba(15,23,42,0.12)] backdrop-blur">
        <div className="flex items-center justify-between gap-3">
          <a
            href="https://democracyroutes.com"
            className="flex items-center gap-3"
            aria-label="Democracy Routes home"
          >
            <span className="relative flex h-9 w-9 items-center justify-center overflow-hidden rounded-2xl border border-emerald-200/80 bg-white/80 shadow-[0_8px_20px_rgba(16,185,129,0.2)]">
              <img
                src="/logo-120.png"
                alt="Democracy Routes logo"
                className="h-full w-full object-contain"
              />
            </span>
            <div className="leading-tight">
              <div
                className="text-base font-semibold text-slate-900 sm:text-lg"
                style={{ fontFamily: "var(--font-serif)" }}
              >
                Democracy Routes
              </div>
              <div className="text-[11px] uppercase tracking-[0.2em] text-slate-500">
                Civic operations
              </div>
            </div>
          </a>

          <nav className="hidden items-center gap-2 text-sm text-slate-600 lg:flex">
            <Link href="/dashboard" className="rounded-full px-3 py-1 hover:bg-white/70">
              Dashboard
            </Link>
            <Link href="/open-problems" className="rounded-full px-3 py-1 hover:bg-white/70">
              Open Problems
            </Link>
            <Link href="/box" className="rounded-full px-3 py-1 hover:bg-white/70">
              Box
            </Link>
            <div
              className="relative"
              onMouseEnter={openDataspaceMenu}
              onMouseLeave={scheduleCloseDataspaceMenu}
            >
              <button
                type="button"
                aria-label="Open dataspace menu"
                aria-expanded={showDataspaceMenu}
                onClick={() => {
                  setShowDataspaceMenu((prev) => !prev);
                  loadRecentDataspaces();
                }}
                className="rounded-full px-3 py-1 hover:bg-white/70"
              >
                Dataspace
              </button>
              {showDataspaceMenu ? (
                <div
                  className="absolute left-0 mt-2 w-60 rounded-xl border border-slate-300 bg-white p-2 text-xs shadow-[0_18px_40px_rgba(15,23,42,0.16)]"
                  onMouseEnter={openDataspaceMenu}
                  onMouseLeave={scheduleCloseDataspaceMenu}
                >
                  <Link
                    href="/dataspace"
                    onClick={() => setShowDataspaceMenu(false)}
                    className="block rounded px-2 py-2 text-slate-700 hover:bg-slate-100"
                  >
                    All dataspaces
                  </Link>
                  <div className="px-2 pt-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-400">
                    Recent
                  </div>
                  {loadingRecent ? (
                    <div className="px-2 py-2 text-[11px] text-slate-500">Loading…</div>
                  ) : recentError ? (
                    <div className="px-2 py-2 text-[11px] text-red-600">{recentError}</div>
                  ) : recentDataspaces.length === 0 ? (
                    <div className="px-2 py-2 text-[11px] text-slate-500">No recent dataspaces.</div>
                  ) : (
                    recentDataspaces.map((space) => (
                      <Link
                        key={space.id}
                        href={`/dataspace/${space.id}`}
                        onClick={() => setShowDataspaceMenu(false)}
                        className="flex items-center gap-2 rounded px-2 py-2 text-slate-700 hover:bg-slate-100"
                      >
                        <span
                          className="h-2.5 w-2.5 rounded-full border border-white/70"
                          style={{ backgroundColor: space.color ?? DEFAULT_DATASPACE_COLOR }}
                        />
                        <span className="truncate">{space.name}</span>
                      </Link>
                    ))
                  )}
                </div>
              ) : null}
            </div>
            <div
              className="relative"
              onMouseEnter={openTemplatesMenu}
              onMouseLeave={scheduleCloseTemplatesMenu}
            >
              <button
                type="button"
                aria-label="Open templates menu"
                aria-expanded={showNewMenu}
                onClick={() => setShowNewMenu((prev) => !prev)}
                className="rounded-full px-3 py-1 hover:bg-white/70"
              >
                Templates
              </button>
              {showNewMenu ? (
                <div
                  className="absolute left-0 mt-2 w-48 rounded-xl border border-slate-300 bg-white p-2 text-xs shadow-[0_18px_40px_rgba(15,23,42,0.16)]"
                  onMouseEnter={openTemplatesMenu}
                  onMouseLeave={scheduleCloseTemplatesMenu}
                >
                  <Link
                    href="/flows"
                    onClick={() => setShowNewMenu(false)}
                    className="block rounded px-2 py-2 text-slate-700 hover:bg-slate-100"
                  >
                    All templates
                  </Link>
                  <Link
                    href="/templates/workspace?mode=modular"
                    onClick={() => setShowNewMenu(false)}
                    className="block rounded px-2 py-2 text-slate-700 hover:bg-slate-100"
                  >
                    Template Builder
                  </Link>
                </div>
              ) : null}
            </div>
            <div
              className="relative"
              onMouseEnter={openMeetingMenu}
              onMouseLeave={scheduleCloseMeetingMenu}
            >
              <button
                type="button"
                aria-label="Open meeting menu"
                aria-expanded={showMeetingMenu}
                onClick={() => setShowMeetingMenu((prev) => !prev)}
                className="rounded-full bg-[color:var(--accent)] px-4 py-1 text-white hover:bg-[color:var(--accent-deep)]"
              >
                New meeting
              </button>
              {showMeetingMenu ? (
                <div
                  className="absolute right-0 mt-2 w-52 rounded-xl border border-slate-300 bg-white p-2 text-xs shadow-[0_18px_40px_rgba(15,23,42,0.16)]"
                  onMouseEnter={openMeetingMenu}
                  onMouseLeave={scheduleCloseMeetingMenu}
                >
                  <button
                    type="button"
                    onClick={handleInstantMeeting}
                    disabled={creatingMeeting}
                    className="block w-full rounded px-2 py-2 text-left text-slate-700 hover:bg-slate-100"
                  >
                    {creatingMeeting ? "Starting instant meeting..." : "Start instant meeting"}
                  </button>
                  <Link
                    href={dataspaceMeetingLink}
                    onClick={() => setShowMeetingMenu(false)}
                    className="block rounded px-2 py-2 text-slate-700 hover:bg-slate-100"
                  >
                    Plan a meeting
                  </Link>
                  {createMeetingError ? (
                    <div className="px-2 pt-1 text-[11px] text-red-600">
                      {createMeetingError}
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>
          </nav>

          <div className="hidden items-center gap-3 lg:flex">
            <div className="relative" />
            {session.user.role === "ADMIN" ? null : null}
            <div
              className="relative"
              onMouseEnter={openUserMenu}
              onMouseLeave={scheduleCloseUserMenu}
            >
              <button
                type="button"
                aria-label="Open user menu"
                aria-expanded={showUserMenu}
                onClick={() => setShowUserMenu((prev) => !prev)}
                className="inline-flex items-center gap-2 rounded-full border border-slate-200/80 bg-white/80 px-3 py-1 text-xs font-semibold text-slate-700 shadow-[0_10px_20px_rgba(15,23,42,0.08)]"
              >
                <span className="flex h-6 w-6 items-center justify-center overflow-hidden rounded-full border border-white/70 bg-white text-[10px] font-semibold text-slate-600">
                  {session.user.avatarUrl ? (
                    <img
                      src={session.user.avatarUrl}
                      alt="Profile"
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    session.user.email.slice(0, 2).toUpperCase()
                  )}
                </span>
                <span className="max-w-[140px] truncate">{session.user.email}</span>
                <span className="text-[10px]">v</span>
              </button>
              {showUserMenu ? (
                <div
                  className="absolute right-0 top-full mt-2 w-48 rounded-xl border border-slate-300 bg-white p-2 text-xs shadow-[0_18px_40px_rgba(15,23,42,0.16)]"
                  onMouseEnter={openUserMenu}
                  onMouseLeave={scheduleCloseUserMenu}
                >
                  <Link
                    href="/remote-worker"
                    onClick={() => setShowUserMenu(false)}
                    className="block rounded px-2 py-2 text-slate-700 hover:bg-slate-100"
                  >
                    Remote worker
                  </Link>
                  <Link
                    href="/presentation"
                    onClick={() => setShowUserMenu(false)}
                    className="block rounded px-2 py-2 text-slate-700 hover:bg-slate-100"
                  >
                    Presentation
                  </Link>
                  <Link
                    href="/open-problems"
                    onClick={() => setShowUserMenu(false)}
                    className="block rounded px-2 py-2 text-slate-700 hover:bg-slate-100"
                  >
                    Open Problems
                  </Link>
                  <Link
                    href="/box"
                    onClick={() => setShowUserMenu(false)}
                    className="block rounded px-2 py-2 text-slate-700 hover:bg-slate-100"
                  >
                    Box
                  </Link>
                  <Link
                    href="/account"
                    onClick={() => setShowUserMenu(false)}
                    className="block rounded px-2 py-2 text-slate-700 hover:bg-slate-100"
                  >
                    Profile settings
                  </Link>
                  <Link
                    href="/privacy"
                    onClick={() => setShowUserMenu(false)}
                    className="block rounded px-2 py-2 text-slate-700 hover:bg-slate-100"
                  >
                    Privacy Policy
                  </Link>
                  <Link
                    href="/cookies"
                    onClick={() => setShowUserMenu(false)}
                    className="block rounded px-2 py-2 text-slate-700 hover:bg-slate-100"
                  >
                    Cookie Policy
                  </Link>
                  {session.user.role === "ADMIN" ? (
                    <>
                      <Link
                        href="/admin"
                        onClick={() => setShowUserMenu(false)}
                        className="block rounded px-2 py-2 text-slate-700 hover:bg-slate-100"
                      >
                        Admin overview
                      </Link>
                      <Link
                        href="/admin/users"
                        onClick={() => setShowUserMenu(false)}
                        className="block rounded px-2 py-2 text-slate-700 hover:bg-slate-100"
                      >
                        Users
                      </Link>
                      <Link
                        href="/admin/global-dashboard"
                        onClick={() => setShowUserMenu(false)}
                        className="block rounded px-2 py-2 text-slate-700 hover:bg-slate-100"
                      >
                        Global dashboard
                      </Link>
                    </>
                  ) : null}
                  <div className="mt-1 border-t border-slate-200 pt-1">
                    <SignOutButton />
                  </div>
                </div>
              ) : null}
            </div>
          </div>

          <button
            type="button"
            onClick={() => setShowMobileMenu((prev) => !prev)}
            className="lg:hidden rounded-full border border-slate-200/80 bg-white/80 px-3 py-2 text-[11px] font-semibold text-slate-700"
            aria-label="Toggle menu"
            aria-expanded={showMobileMenu}
          >
            Menu
          </button>
        </div>

        {showMobileMenu ? (
          <div className="absolute left-0 right-0 top-full z-40 mt-3 flex max-h-[calc(100dvh-6rem)] flex-col gap-4 overflow-y-auto rounded-2xl border border-slate-300 bg-white p-4 text-sm text-slate-700 shadow-[0_22px_56px_rgba(15,23,42,0.2)] lg:hidden">
            <div className="space-y-2">
              <div className="text-[10px] font-semibold uppercase tracking-[0.24em] text-slate-500">
                Primary
              </div>
              <button
                type="button"
                onClick={handleInstantMeeting}
                disabled={creatingMeeting}
                className="dr-button w-full px-4 py-2 text-left text-sm"
              >
                {creatingMeeting ? "Starting instant meeting..." : "Start instant meeting"}
              </button>
              <Link
                href={dataspaceMeetingLink}
                onClick={() => setShowMobileMenu(false)}
                className="block w-full rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm text-slate-700"
              >
                Plan a meeting
              </Link>
            </div>

            <div className="space-y-2">
              <div className="text-[10px] font-semibold uppercase tracking-[0.24em] text-slate-500">
                Explore
              </div>
              <div className="flex flex-col gap-2">
                <Link href="/dashboard" onClick={() => setShowMobileMenu(false)} className="font-medium">
                  Dashboard
                </Link>
                <Link href="/open-problems" onClick={() => setShowMobileMenu(false)} className="font-medium">
                  Open Problems
                </Link>
                <Link href="/box" onClick={() => setShowMobileMenu(false)} className="font-medium">
                  Box
                </Link>
                <Link href="/dataspace" onClick={() => setShowMobileMenu(false)} className="font-medium">
                  Dataspaces
                </Link>
                <div className="rounded-xl border border-slate-200/70 bg-white/70 px-3 py-2">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">
                    Templates
                  </div>
                  <div className="mt-2 flex flex-col gap-2 text-sm text-slate-700">
                    <Link href="/flows" onClick={() => setShowMobileMenu(false)}>
                      All templates
                    </Link>
                    <Link href="/templates/workspace?mode=modular" onClick={() => setShowMobileMenu(false)}>
                      Template Builder
                    </Link>
                    <Link href={dataspaceMeetingLink} onClick={() => setShowMobileMenu(false)}>
                      New meeting
                    </Link>
                  </div>
                </div>
              </div>
            </div>

            <div className="border-t border-slate-200/80 pt-3 text-xs text-slate-600">
              <div className="mb-2 uppercase tracking-[0.2em]">Account</div>
              <div className="flex flex-col gap-2 text-sm text-slate-700">
                <Link href="/account" onClick={() => setShowMobileMenu(false)}>
                  Profile settings
                </Link>
                <Link href="/remote-worker" onClick={() => setShowMobileMenu(false)}>
                  Remote worker
                </Link>
                <Link href="/presentation" onClick={() => setShowMobileMenu(false)}>
                  Presentation
                </Link>
                <div className="rounded-xl border border-slate-200/70 bg-slate-50 px-3 py-2">
                  <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500">
                    Policies
                  </div>
                  <div className="mt-2 flex flex-col gap-2">
                    <Link href="/privacy" onClick={() => setShowMobileMenu(false)}>
                      Privacy Policy
                    </Link>
                    <Link href="/cookies" onClick={() => setShowMobileMenu(false)}>
                      Cookie Policy
                    </Link>
                  </div>
                </div>
                {session.user.role === "ADMIN" ? (
                  <>
                    <Link href="/admin" onClick={() => setShowMobileMenu(false)}>
                      Admin overview
                    </Link>
                    <Link href="/admin/users" onClick={() => setShowMobileMenu(false)}>
                      Users
                    </Link>
                    <Link href="/admin/global-dashboard" onClick={() => setShowMobileMenu(false)}>
                      Global dashboard
                    </Link>
                  </>
                ) : null}
                <SignOutButton />
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </header>
  );
}
