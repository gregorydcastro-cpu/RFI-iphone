import type { Metadata, Viewport } from "next";
import { SITE_THEME_COLOR } from "@/lib/siteInfo";
import { Geist, Geist_Mono, Oswald } from "next/font/google";
import { AppleComingSoonBanner } from "@/components/AppleComingSoonBanner";
import { OfflinePackServiceWorker } from "@/components/OfflinePackServiceWorker";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const oswald = Oswald({
  variable: "--font-oswald",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "GC Field Log",
  description:
    "Crew dashboard for gcfieldlog.com — job selection, room packs, zoomable sheets, and RFIs.",
};

export const viewport: Viewport = {
  themeColor: SITE_THEME_COLOR,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} ${oswald.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col font-sans">
        <AppleComingSoonBanner />
        <OfflinePackServiceWorker />
        {children}
      </body>
    </html>
  );
}
