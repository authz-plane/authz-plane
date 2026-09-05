import type { Metadata } from "next";
import { IBM_Plex_Mono, IBM_Plex_Sans } from "next/font/google";
import { currentTheme } from "@/server/theme";
import "./globals.css";

// Self-hosted by next/font at build time; the browser never calls Google.
const plexSans = IBM_Plex_Sans({
  variable: "--font-plex-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

const plexMono = IBM_Plex_Mono({
  variable: "--font-plex-mono",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  display: "swap",
});

export const metadata: Metadata = {
  title: { default: "authz-plane", template: "%s · authz-plane" },
  description:
    "Declarative identity and authorization, continuously reconciled.",
};

/**
 * html[data-theme] comes from the `theme` cookie (system | light | dark) and
 * drives `color-scheme` in globals.css, so the first paint is already in the
 * operator's theme. ThemeSwitcher updates the attribute client-side after that.
 */
export default async function RootLayout({ children }: LayoutProps<"/">) {
  const theme = await currentTheme();
  return (
    <html
      lang="en"
      data-theme={theme}
      className={`${plexSans.variable} ${plexMono.variable}`}
    >
      <body className="min-h-full">{children}</body>
    </html>
  );
}
