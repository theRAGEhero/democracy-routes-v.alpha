import type { Metadata } from "next";
import { Fraunces, Space_Grotesk } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";
import { AppHeader } from "@/components/AppHeader";
import { FeedbackButton } from "@/components/FeedbackButton";
import { AppFooter } from "@/components/AppFooter";
import { Suspense } from "react";
import { FirstTimeTutorial } from "@/components/FirstTimeTutorial";
import { getSiteSetting } from "@/lib/siteSettings";
import { AnalyticsConsent } from "@/components/AnalyticsConsent";

const sans = Space_Grotesk({ subsets: ["latin"], variable: "--font-sans" });
const serif = Fraunces({ subsets: ["latin"], variable: "--font-serif" });

export const metadata: Metadata = {
  title: "Democracy Routes",
  description: "Manage Democracy Routes meeting links",
  icons: {
    icon: "/albero-logo-dr-120.png",
    apple: "/albero-logo-dr-120.png"
  }
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  let shouldInject = false;
  let analyticsSnippet = "";
  if (process.env.DATABASE_URL) {
    const [snippet, enabled] = await Promise.all([
      getSiteSetting("analyticsSnippet"),
      getSiteSetting("analyticsEnabled")
    ]);
    analyticsSnippet = snippet ?? "";
    shouldInject = enabled === "true" && Boolean(analyticsSnippet.trim());
  }

  return (
    <html lang="en">
      <body className={`${sans.variable} ${serif.variable}`}>
        <Providers>
          <AppHeader />
          <main className="mx-auto w-full max-w-[1400px] px-3 py-6 md:px-4">{children}</main>
          <AppFooter />
          <FirstTimeTutorial />
          <AnalyticsConsent enabled={shouldInject} snippet={analyticsSnippet} />
          <Suspense>
            <FeedbackButton />
          </Suspense>
        </Providers>
      </body>
    </html>
  );
}
