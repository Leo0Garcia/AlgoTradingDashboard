import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import "./globals.css";
import { TopBar } from "@/components/layout/TopBar";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "TradingAgent Dashboard",
  description: "Multi-algorithm trading command center",
};

const NAV = [
  { href: "/", label: "Live" },
  { href: "/journal", label: "Journal" },
  { href: "/analytics", label: "Analytics" },
  { href: "/algos", label: "Algorithms" },
];

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-zinc-950 text-zinc-100">
        <header className="border-b border-zinc-800 bg-zinc-950/80 backdrop-blur sticky top-0 z-30">
          <div className="flex items-center gap-6 px-5 h-12">
            <Link href="/" className="flex items-center gap-2 text-sm font-semibold tracking-tight">
              <span className="h-2 w-2 rounded-sm bg-green-500" />
              TradingAgent
              <span className="text-zinc-500 font-normal">/ Command Center</span>
            </Link>
            <nav className="flex items-center gap-1 text-sm">
              {NAV.map((n) => (
                <Link
                  key={n.href}
                  href={n.href}
                  className="px-2.5 py-1 rounded-md text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800/60 transition-colors"
                >
                  {n.label}
                </Link>
              ))}
            </nav>
            <div className="ml-auto">
              <TopBar />
            </div>
          </div>
        </header>
        <main className="flex-1">{children}</main>
      </body>
    </html>
  );
}
