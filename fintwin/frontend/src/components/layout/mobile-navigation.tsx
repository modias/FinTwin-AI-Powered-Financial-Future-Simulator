"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu } from "lucide-react";

import { isNavItemActive, navItems } from "@/components/layout/navigation";
import { FinTwinWordmark } from "@/components/shared/fintwin-logo";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

/**
 * The sidebar as a drawer below the `lg` breakpoint.
 *
 * Radix's Dialog gives it a focus trap, Escape-to-close and the right ARIA
 * roles; tapping a link closes the drawer so it does not hang open over the
 * page that was just navigated to.
 */
export function MobileNavigation() {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);

  return (
    <Sheet open={isOpen} onOpenChange={setIsOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="lg:hidden">
          <Menu aria-hidden />
          <span className="sr-only">Open navigation menu</span>
        </Button>
      </SheetTrigger>
      <SheetContent
        side="left"
        className="w-[300px] gap-0 overflow-y-auto bg-sidebar p-0 sm:max-w-[300px]"
      >
        <SheetHeader className="px-5 py-5 text-left">
          <SheetTitle asChild>
            <Link
              href="/"
              onClick={() => setIsOpen(false)}
              className="inline-flex rounded-lg outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              <FinTwinWordmark />
              <span className="sr-only">
                Back to the FinTwin welcome screen
              </span>
            </Link>
          </SheetTitle>
          <SheetDescription className="sr-only">
            FinTwin navigation
          </SheetDescription>
        </SheetHeader>

        <nav aria-label="Main" className="px-3 pb-6">
          <ul className="space-y-1">
            {navItems.map((item) => {
              const isActive = isNavItemActive(item, pathname);

              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={() => setIsOpen(false)}
                    aria-current={isActive ? "page" : undefined}
                    className={cn(
                      "flex items-start gap-3 rounded-lg px-3 py-2.5 outline-none transition-colors",
                      "focus-visible:ring-3 focus-visible:ring-ring/50",
                      isActive
                        ? "bg-sidebar-accent"
                        : "hover:bg-sidebar-accent/60",
                    )}
                  >
                    <item.icon
                      aria-hidden
                      className={cn(
                        "mt-0.5 size-4 shrink-0",
                        isActive ? "text-primary" : "text-muted-foreground",
                      )}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-2 text-sm font-medium">
                        {item.label}
                        {item.isPreview ? (
                          <span className="rounded-full bg-primary/12 px-1.5 py-0.5 text-[10px] font-medium text-primary">
                            Soon
                          </span>
                        ) : null}
                      </span>
                      <span className="mt-0.5 block text-xs leading-relaxed text-muted-foreground">
                        {item.description}
                      </span>
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      </SheetContent>
    </Sheet>
  );
}
