"use client";

import { usePathname } from "next/navigation";

export function AppFooter() {
  const pathname = usePathname() || "";
  if (pathname !== "/") {
    return null;
  }

  return (
    <footer className="dr-shell dr-shell-pad w-full pb-8 text-xs text-slate-500">
      <div className="flex flex-wrap items-center gap-4">
        <a href="/privacy" className="hover:text-slate-700">
          Privacy Policy
        </a>
        <a href="/cookies" className="hover:text-slate-700">
          Cookie Policy
        </a>
      </div>
    </footer>
  );
}
