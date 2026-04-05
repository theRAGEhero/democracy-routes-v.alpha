import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Providers } from "./providers";
import type { CSSProperties } from "react";
import { getSiteSetting } from "@/lib/siteSettings";
import { AnalyticsConsent } from "@/components/AnalyticsConsent";
import { PwaRegister } from "@/components/PwaRegister";
import { AppFrame } from "@/components/AppFrame";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getAppThemeBodyClass } from "@/lib/appTheme";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Democracy Routes",
  description: "Manage Democracy Routes meeting links",
  icons: {
    icon: [
      { url: "/dr-tree-192.png", sizes: "192x192", type: "image/png" },
      { url: "/dr-tree-512.png", sizes: "512x512", type: "image/png" }
    ],
    shortcut: "/dr-tree-192.png",
    apple: "/dr-tree-192.png"
  },
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Democracy Routes"
  }
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#f97316"
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions);
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
      <body
        className={getAppThemeBodyClass(session?.user?.appTheme)}
        style={
          {
            "--font-sans": '"Space Grotesk", "IBM Plex Sans", sans-serif',
            "--font-serif": '"Fraunces", "Iowan Old Style", "Palatino Linotype", serif'
          } as CSSProperties
        }
      >
        <Providers>
          <AppFrame>{children}</AppFrame>
          <AnalyticsConsent enabled={shouldInject} snippet={analyticsSnippet} />
          <PwaRegister />
        </Providers>
      </body>
    </html>
  );
}
