"use client";

import Link from "next/link";
import { useSession } from "next-auth/react";
import { useState } from "react";
import { SignOutButton } from "@/components/SignOutButton";

export function AppHeader() {
  const { data: session, status } = useSession();
  const [showNewMenu, setShowNewMenu] = useState(false);
  const [showAdminMenu, setShowAdminMenu] = useState(false);

  if (status === "loading") {
    return null;
  }

  if (!session?.user) {
    return (
      <header className="sticky top-3 z-20">
        <div className="mx-auto flex w-full max-w-5xl flex-wrap items-center justify-between gap-2 rounded-2xl border border-[color:var(--stroke)] bg-[color:var(--card)] px-3 py-2 shadow-[0_12px_32px_rgba(0,0,0,0.08)] backdrop-blur sm:top-4 sm:px-4 sm:py-3 lg:rounded-full">
          <div className="flex flex-wrap items-center gap-2 sm:gap-4">
            <Link href="/" className="flex items-center gap-2">
              <span className="h-6 w-6 overflow-hidden rounded-full border border-emerald-200/80 bg-white/80 sm:h-8 sm:w-8">
                <img
                  src="/logo-120.png"
                  alt="Democracy Routes logo"
                  className="h-full w-full object-contain"
                />
              </span>
              <span
                className="text-base font-semibold text-slate-900 sm:text-lg"
                style={{ fontFamily: "var(--font-serif)" }}
              >
                Democracy Routes
              </span>
            </Link>
            <nav className="flex items-center gap-2 text-xs text-slate-600 sm:text-sm">
              <Link href="/" className="hover:text-slate-900">
                Home
              </Link>
              <Link href="/about" className="hover:text-slate-900">
                About
              </Link>
            </nav>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-500 sm:text-xs">
            <Link href="/login" className="dr-button px-3 py-1.5 text-xs sm:px-4 sm:py-2 sm:text-sm">
              Log in
            </Link>
            <Link href="/register" className="dr-button-outline px-3 py-1.5 text-xs sm:px-4 sm:py-2 sm:text-sm">
              Create account
            </Link>
          </div>
        </div>
      </header>
    );
  }

  return (
    <header className="sticky top-3 z-20">
      <div className="mx-auto flex w-full max-w-5xl flex-wrap items-center justify-between gap-2 rounded-2xl border border-[color:var(--stroke)] bg-[color:var(--card)] px-3 py-2 shadow-[0_12px_32px_rgba(0,0,0,0.08)] backdrop-blur sm:top-4 sm:px-4 sm:py-3 lg:rounded-full">
        <div className="flex flex-wrap items-center gap-2 sm:gap-4">
            <Link href="/dashboard" className="flex items-center gap-2">
              <span className="h-6 w-6 overflow-hidden rounded-full border border-emerald-200/80 bg-white/80 sm:h-8 sm:w-8">
                <img
                  src="/logo-120.png"
                  alt="Democracy Routes logo"
                  className="h-full w-full object-contain"
                />
              </span>
              <span
                className="text-base font-semibold text-slate-900 sm:text-lg"
                style={{ fontFamily: "var(--font-serif)" }}
              >
                Democracy Routes
              </span>
            </Link>
          <nav className="flex flex-wrap items-center gap-2 text-xs text-slate-600 sm:text-sm">
            <Link href="/dashboard" className="hover:text-slate-900">
              Dashboard
            </Link>
            <Link href="/flows" className="hover:text-slate-900">
              Templates
            </Link>
            <Link href="/dataspace" className="hover:text-slate-900">
              Dataspace
            </Link>
            <div
              className="relative pb-2"
              onMouseEnter={() => setShowNewMenu(true)}
              onMouseLeave={() => setShowNewMenu(false)}
            >
              <div className="inline-flex items-center gap-1 rounded-full border border-slate-200/80 bg-gradient-to-r from-white/80 via-white/60 to-white/80 px-2 py-1 text-xs font-semibold text-slate-700 shadow-[0_10px_20px_rgba(15,23,42,0.08)] transition hover:border-slate-300 hover:text-slate-900">
                <Link href="/meetings/new" className="px-1">
                  New meeting
                </Link>
                <button
                  type="button"
                  aria-label="Open new menu"
                  aria-expanded={showNewMenu}
                  onClick={() => setShowNewMenu((prev) => !prev)}
                  className="px-1 text-[10px] font-semibold text-slate-600 hover:text-slate-900"
                >
                  v
                </button>
              </div>
              {showNewMenu ? (
                <div className="absolute left-0 mt-2 w-44 rounded-xl border border-slate-200 bg-white/95 p-2 text-xs shadow-[0_16px_40px_rgba(15,23,42,0.12)]">
                  <Link
                    href="/flows/new"
                    onClick={() => setShowNewMenu(false)}
                    className="block rounded px-2 py-2 text-slate-700 hover:bg-slate-100"
                  >
                    New template
                  </Link>
                </div>
              ) : null}
            </div>
            {session.user.role === "ADMIN" ? (
              <div
                className="relative pb-2"
                onMouseEnter={() => setShowAdminMenu(true)}
                onMouseLeave={() => setShowAdminMenu(false)}
              >
                <button
                  type="button"
                  onClick={() => setShowAdminMenu((prev) => !prev)}
                  aria-expanded={showAdminMenu}
                  className="inline-flex items-center gap-2 rounded-full border border-slate-200/80 bg-gradient-to-r from-slate-900/10 via-white/70 to-white/80 px-3 py-1 text-xs font-semibold text-slate-700 shadow-[0_10px_20px_rgba(15,23,42,0.08)] transition hover:border-slate-300 hover:text-slate-900"
                >
                  Admin
                </button>
                {showAdminMenu ? (
                  <div className="absolute left-0 mt-2 w-44 rounded-xl border border-slate-200 bg-white/95 p-2 text-xs shadow-lg">
                    <Link
                      href="/admin/users"
                      onClick={() => setShowAdminMenu(false)}
                      className="block rounded px-2 py-2 text-slate-700 hover:bg-slate-100"
                    >
                      Users
                    </Link>
                    <Link
                      href="/admin/global-dashboard"
                      onClick={() => setShowAdminMenu(false)}
                      className="block rounded px-2 py-2 text-slate-700 hover:bg-slate-100"
                    >
                      Global dashboard
                    </Link>
                    <Link
                      href="/admin"
                      onClick={() => setShowAdminMenu(false)}
                      className="block rounded px-2 py-2 text-slate-700 hover:bg-slate-100"
                    >
                      Admin overview
                    </Link>
                  </div>
                ) : null}
              </div>
            ) : null}
          </nav>
        </div>
        <div className="flex items-center gap-2 text-[11px] text-slate-500 sm:text-xs">
          <span className="hidden break-all sm:inline">{session.user.email}</span>
          <div className="flex items-center gap-2">
            <Link href="/account" className="text-[11px] font-semibold text-slate-600 hover:text-slate-900 sm:text-xs">
              Profile settings
            </Link>
            <SignOutButton />
          </div>
        </div>
      </div>
    </header>
  );
}
