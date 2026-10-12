import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import { cookies } from "next/headers";
import { Providers } from "@/components/providers";
import { THEME_COOKIE } from "@/lib/auth";
import "./globals.css";

const inter = Inter({ variable: "--font-inter", subsets: ["latin", "cyrillic"] });
const mono = JetBrains_Mono({ variable: "--font-mono-face", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "InvestAI.uz — Investitsiya safarlari monitoringi",
  description: "Viloyat hokimligi xorijiy investitsiya safarlari va kelishuvlar monitoringi tizimi",
};

const THEMES = new Set(["light", "dark", "system"]);

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const saved = (await cookies()).get(THEME_COOKIE)?.value ?? "light";
  const theme = THEMES.has(saved) ? saved : "light";
  return (
    <html lang="uz" data-theme={theme} suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        {/* display=block: until the icon font arrives, icons stay blank instead of showing their names as text. */}
        {/* eslint-disable-next-line @next/next/no-page-custom-font, @next/next/google-font-display -- icon font, not text */}
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,400,0..1,0&display=block"
        />
        {/* Icons stay transparent (see globals.css) until the font is ready, even past the block period. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){var h=document.documentElement;function r(){h.classList.add("icons-ready")}if(!document.fonts){r();return}document.fonts.load('20px "Material Symbols Outlined"').then(function(f){if(f.length)r()},function(){})})()`,
          }}
        />
      </head>
      <body className={`${inter.variable} ${mono.variable} antialiased`}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
