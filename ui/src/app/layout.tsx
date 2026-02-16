import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { QueryProvider } from "@/components/providers/QueryProvider";
import { MobileNav } from "@/components/nav/MobileNav";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "API Gateway Admin",
  description: "High-Performance API Security Gateway Administration",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Gateway Admin",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={inter.className}>
        <QueryProvider>
          <div className="min-h-screen pb-16 md:pb-0">
            {children}
          </div>
          <MobileNav />
        </QueryProvider>
      </body>
    </html>
  );
}
