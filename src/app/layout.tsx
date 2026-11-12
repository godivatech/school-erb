import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { AppShell } from "@/components/layout/app-shell";
import { getActiveContext } from "@/lib/context";

export const dynamic = "force-dynamic";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Crescent School ERP — Command Center",
  description:
    "Unified Enterprise School Management & Information System for Crescent Matriculation School.",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const activeContext = await getActiveContext();

  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${inter.variable} ${jetbrainsMono.variable}`}
    >
      <body
        suppressHydrationWarning
        className="font-sans antialiased bg-slate-50 text-slate-900 selection:bg-blue-100 selection:text-blue-900"
      >
        <AppShell initialContext={activeContext}>{children}</AppShell>
      </body>
    </html>
  );
}
