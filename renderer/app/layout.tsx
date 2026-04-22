import type { Metadata } from "next";
import { Press_Start_2P, VT323, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { WindowChrome } from "@/components/WindowChrome";

const pressStart = Press_Start_2P({
  subsets: ["latin"],
  weight: "400",
  display: "swap",
  variable: "--font-pixel-src",
});

const vt323 = VT323({
  subsets: ["latin"],
  weight: "400",
  display: "swap",
  variable: "--font-vt323",
});

const jetbrains = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "700"],
  display: "swap",
  variable: "--font-mono-src",
});

export const metadata: Metadata = {
  title: "ULTRONOS · AI Agent Command Station",
  description: "Retro cyberpunk dashboard for your autonomous AI crew",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={`${pressStart.variable} ${vt323.variable} ${jetbrains.variable}`}
    >
      <body className="min-h-screen bg-bg-base antialiased">
        <WindowChrome>{children}</WindowChrome>
      </body>
    </html>
  );
}
