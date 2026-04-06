"use client";

import { Suspense } from "react";
import { usePathname } from "next/navigation";
import { AppHeader } from "@/components/AppHeader";
import { AppFooter } from "@/components/AppFooter";
import { FeedbackButton } from "@/components/FeedbackButton";
import { FirstTimeTutorial } from "@/components/FirstTimeTutorial";

export function AppFrame({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isPresentation = pathname === "/presentation";

  if (isPresentation) {
    return (
      <>
        <main className="w-full">{children}</main>
      </>
    );
  }

  return (
    <>
      <Suspense>
        <AppHeader />
      </Suspense>
      <main className="dr-shell dr-shell-pad w-full py-6 lg:py-8">{children}</main>
      <AppFooter />
      <FirstTimeTutorial />
      <Suspense>
        <FeedbackButton />
      </Suspense>
    </>
  );
}
