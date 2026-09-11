import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import Script from "next/script";
import ChatWidget from "@/components/chat/ChatWidget";
import "./globals.css";

const THEME_INIT_SCRIPT = `(() => {
  try {
    const key = "healthspan-theme";
    const migratedKey = "healthspan-theme-v2";
    let stored = localStorage.getItem(migratedKey);
    if (!stored) {
      stored = "light";
      localStorage.setItem(migratedKey, "light");
      localStorage.setItem(key, "light");
    }
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    const resolved = stored === "system" ? (prefersDark ? "dark" : "light") : stored;
    document.documentElement.setAttribute("data-theme", resolved);
    document.documentElement.style.colorScheme = resolved;
  } catch (_) {}
})();`;

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Healthspan | Longevity & Wellness Research",
  description:
    "Your trusted source for evidence-based longevity research, anti-aging science, and wellness insights. Discover the latest in healthspan optimization.",
  keywords: [
    "longevity",
    "healthspan",
    "anti-aging",
    "wellness",
    "lifespan",
    "cellular health",
    "longevity research",
  ],
  authors: [{ name: "Healthspan" }],
  openGraph: {
    title: "Healthspan | Longevity & Wellness Research",
    description:
      "Your trusted source for evidence-based longevity research, anti-aging science, and wellness insights.",
    type: "website",
    locale: "en_US",
    siteName: "Healthspan",
  },
  twitter: {
    card: "summary_large_image",
    title: "Healthspan | Longevity & Wellness Research",
    description:
      "Your trusted source for evidence-based longevity research, anti-aging science, and wellness insights.",
  },
  robots: {
    index: true,
    follow: true,
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <Script id="theme-init" strategy="beforeInteractive">
          {THEME_INIT_SCRIPT}
        </Script>
      </head>
      <body className={`${inter.variable} antialiased`}>
        {children}
        <ChatWidget />
      </body>
    </html>
  );
}
