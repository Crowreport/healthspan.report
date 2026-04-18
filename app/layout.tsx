import type { Metadata, Viewport } from "next";
import { Roboto } from "next/font/google";
import Script from "next/script";
import "./globals.css";

const THEME_INIT_SCRIPT = `(() => {
  try {
    const key = "healthspan-theme";
    const stored = localStorage.getItem(key);
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    const theme = stored === "dark" || stored === "light" ? stored : "dark";
    document.documentElement.setAttribute("data-theme", theme);
    document.documentElement.style.colorScheme = theme;
  } catch (_) {}
})();`;

const roboto = Roboto({
  variable: "--font-roboto",
  subsets: ["latin"],
  weight: ["400", "500", "700"],
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
      <body className={`${roboto.variable} antialiased`}>
        {children}
      </body>
    </html>
  );
}
