"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Activity, Shield, Database, Settings, Gauge, FileText, LayoutDashboard } from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/", icon: LayoutDashboard, label: "Dashboard" },
  { href: "/routes", icon: Activity, label: "Routes" },
  { href: "/security", icon: Shield, label: "Security" },
  { href: "/cache", icon: Database, label: "Cache" },
  { href: "/ratelimit", icon: Gauge, label: "Limits" },
  { href: "/logs", icon: FileText, label: "Logs" },
  { href: "/settings", icon: Settings, label: "Settings" },
];

export function MobileNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 md:hidden pb-safe">
      <div className="flex items-stretch overflow-x-auto touch-scroll no-scrollbar">
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex flex-col items-center justify-center flex-1 min-w-[4rem] py-2 px-1 touch-target transition-colors active:bg-accent",
                isActive
                  ? "text-primary"
                  : "text-muted-foreground"
              )}
            >
              <item.icon className="h-5 w-5" />
              <span className="text-[10px] mt-0.5 leading-tight truncate max-w-full">
                {item.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
