"use client";

import { usePathname } from "next/navigation";

import { AccountSelector } from "@/components/layout/account-selector";
import { MobileNavigation } from "@/components/layout/mobile-navigation";
import { findNavItem } from "@/components/layout/navigation";
import { NotificationsMenu } from "@/components/layout/notifications-menu";
import { UserMenu } from "@/components/layout/user-menu";
import { Separator } from "@/components/ui/separator";

export function AppHeader() {
  const pathname = usePathname();
  const current = findNavItem(pathname);

  return (
    <header className="sticky top-0 z-30 border-b border-border bg-background/95 backdrop-blur-sm">
      <div className="flex h-14 items-center gap-3 px-4 sm:px-6 lg:px-8">
        <MobileNavigation />

        <p className="truncate font-heading text-sm font-medium">
          {current?.label ?? "FinTwin"}
        </p>

        <div className="ml-auto flex items-center gap-1.5 sm:gap-2">
          <AccountSelector />
          <Separator
            orientation="vertical"
            className="hidden h-5 sm:block"
            aria-hidden
          />
          <NotificationsMenu />
          <UserMenu />
        </div>
      </div>
    </header>
  );
}
