import type { Metadata } from "next";
import { Roboto } from "next/font/google";
import "./globals.css";

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

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${roboto.variable} antialiased`}>
        {children}
      </body>
    </html>
  );
}
