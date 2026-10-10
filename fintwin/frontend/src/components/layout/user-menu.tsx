"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { PencilLine, Settings, SlidersHorizontal, UserRound } from "lucide-react";

import { useActiveWorkspace } from "@/components/providers/workspace-provider";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { useUserProfile } from "@/hooks/use-financial-data";

/**
 * The account menu.
 *
 * It deliberately has no "Sign out": there is no authentication in Phase 1, and
 * a control that looks like it signs you out but does nothing would be worse
 * than not having one.
 */
export function UserMenu() {
  const router = useRouter();
  const { dataset, startOnboarding } = useActiveWorkspace();
  const { data: profile } = useUserProfile();

  if (!profile) {
    return <Skeleton className="size-8 rounded-full" />;
  }

  const isDemo = dataset.source === "demo";
  const displayName = profile.name ?? "Your profile";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          className="h-8 gap-2 px-1 sm:pr-2.5"
          aria-label={`Account menu for ${displayName}`}
        >
          <Avatar className="size-7">
            <AvatarFallback className="bg-primary/15 text-[11px] font-semibold text-primary">
              {profile.initials ?? <UserRound aria-hidden className="size-3.5" />}
            </AvatarFallback>
          </Avatar>
          <span className="hidden text-[13px] font-medium sm:inline">
            {displayName}
          </span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60">
        <DropdownMenuLabel className="font-normal">
          <span className="block text-[13px] font-medium">{displayName}</span>
          <span className="block truncate text-xs text-muted-foreground">
            {profile.email ?? "Answers saved in this browser"}
          </span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onSelect={() => {
            startOnboarding("active");
            router.push("/onboarding");
          }}
        >
          <PencilLine aria-hidden />
          Edit financial profile
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/settings">
            <SlidersHorizontal aria-hidden />
            Forecast preferences
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/settings">
            <Settings aria-hidden />
            Settings
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <p className="px-2 py-1.5 text-xs leading-relaxed text-muted-foreground">
          {isDemo
            ? "Demonstration profile. Accounts and authentication arrive with the backend."
            : "Your answers stay in this browser. Accounts and authentication arrive with the backend."}
        </p>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
