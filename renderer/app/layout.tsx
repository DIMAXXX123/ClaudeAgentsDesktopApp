import type { Metadata } from "next";
import "./globals.css";
import { WindowChrome } from "@/components/WindowChrome";

export const metadata: Metadata = {
  title: "ULTRONOS · AI Agent Command Station",
  description: "Retro cyberpunk dashboard for your autonomous AI crew",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=Press+Start+2P&family=VT323&family=JetBrains+Mono:wght@400;500;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="min-h-screen bg-bg-base antialiased">
        <WindowChrome>{children}</WindowChrome>
      </body>
    </html>
  );
}
