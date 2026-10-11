"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ShieldCheck } from "lucide-react";

import { isNavItemActive, navItems } from "@/components/layout/navigation";
import { useActiveWorkspace } from "@/components/providers/workspace-provider";
import { FinTwinWordmark } from "@/components/shared/fintwin-logo";
import { cn } from "@/lib/utils";

export function AppSidebar() {
  const pathname = usePathname();

  return (
    <aside className="sticky top-0 hidden h-dvh w-[264px] shrink-0 flex-col border-r border-sidebar-border bg-sidebar lg:flex">
      <div className="px-5 py-5">
        <Link
          href="/"
          className="inline-flex rounded-lg outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          <FinTwinWordmark />
          <span className="sr-only">Back to the FinTwin welcome screen</span>
        </Link>
      </div>

      <SidebarNav pathname={pathname} />

      <div className="mt-auto p-4">
        <DataSourceNote />
      </div>
    </aside>
  );
}

function DataSourceNote() {
  const { dataset } = useActiveWorkspace();
  const isDemo = dataset.source === "demo";

  return (
    <div className="rounded-lg bg-sidebar-accent/60 p-3.5">
      <p className="flex items-center gap-1.5 text-[13px] font-medium">
        <ShieldCheck aria-hidden className="size-3.5 text-success" />
        {isDemo ? "Demonstration mode" : "Your financial profile"}
      </p>
      <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
        {isDemo
          ? "All balances, transactions and forecasts here are mock data. No bank is connected."
          : "Figures come from the answers you entered, saved only in this browser. No bank is connected."}
      </p>
    </div>
  );
}

export function SidebarNav({
  pathname,
  onNavigate,
}: {
  pathname: string;
  onNavigate?: () => void;
}) {
  return (
    <nav aria-label="Main" className="px-3">
      <ul className="space-y-0.5">
        {navItems.map((item) => {
          const isActive = isNavItemActive(item, pathname);

          return (
            <li key={item.href}>
              <Link
                href={item.href}
                onClick={onNavigate}
                aria-current={isActive ? "page" : undefined}
                className={cn(
                  "group flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm font-medium outline-none transition-colors duration-150",
                  "focus-visible:ring-3 focus-visible:ring-ring/50",
                  isActive
                    ? "bg-sidebar-accent text-sidebar-accent-foreground"
                    : "text-muted-foreground hover:bg-sidebar-accent/60 hover:text-foreground",
                )}
              >
                <item.icon
                  aria-hidden
                  className={cn(
                    "size-4 shrink-0 transition-colors",
                    isActive ? "text-primary" : "text-muted-foreground",
                  )}
                />
                <span className="flex-1 truncate">{item.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
