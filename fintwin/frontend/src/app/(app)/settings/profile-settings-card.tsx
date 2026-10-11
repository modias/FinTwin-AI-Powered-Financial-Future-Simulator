"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { PencilLine, RotateCcw, Sparkles, UserRound } from "lucide-react";
import { toast } from "sonner";

import { useActiveWorkspace } from "@/components/providers/workspace-provider";
import { DataSourceBadge } from "@/components/shared/data-source-badge";
import { EditProfileButton } from "@/components/shared/edit-profile-button";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from "@/components/ui/popover";
import { formatMediumDate } from "@/lib/dates";

/**
 * Everything about the profile behind the dashboard: which one is active,
 * editing its answers, and starting over.
 */
export function ProfileSettingsCard() {
  const router = useRouter();
  const {
    activeProfile,
    profiles,
    draft,
    startOnboarding,
    activatePersonal,
    resetOnboarding,
  } = useActiveWorkspace();
  const [isConfirmingReset, setIsConfirmingReset] = useState(false);

  const isDemo = activeProfile.source === "demo";
  const updatedOn = formatMediumDate(activeProfile.updatedAt.slice(0, 10));

  const openOnboarding = (from: "blank" | "active") => {
    startOnboarding(from);
    router.push("/onboarding");
  };

  return (
    <Card className="[--card-spacing:--spacing(5)]">
      <CardHeader>
        <CardTitle className="flex flex-wrap items-center gap-2 text-base">
          Financial profile
          <DataSourceBadge />
        </CardTitle>
        <CardDescription>
          {isDemo
            ? "The dashboard is showing the demo data for Alex Morgan."
            : `The dashboard is built from the answers you entered, last updated ${updatedOn}.`}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        {draft ? (
          <div className="flex flex-col gap-3 rounded-lg border border-primary/25 bg-primary/6 p-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs leading-relaxed text-muted-foreground">
              You have unfinished answers saved. They won&rsquo;t change the
              dashboard until you review and save them.
            </p>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="shrink-0"
              onClick={() => router.push("/onboarding")}
            >
              <PencilLine aria-hidden />
              Resume answers
            </Button>
          </div>
        ) : null}

        <div className="flex flex-wrap gap-2">
          <EditProfileButton size="sm">
            {isDemo ? "Start from the demo answers" : "Edit financial profile"}
          </EditProfileButton>

          {isDemo ? (
            profiles.personal ? (
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => {
                  activatePersonal();
                  toast.success("Switched to your financial twin");
                }}
              >
                <UserRound aria-hidden />
                Switch to my profile
              </Button>
            ) : (
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => openOnboarding("blank")}
              >
                <Sparkles aria-hidden />
                Build My Financial Twin
              </Button>
            )
          ) : null}
        </div>

        <div className="space-y-2 border-t border-border/60 pt-4">
          <p className="text-[13px] font-medium">Start over</p>
          <p className="text-xs leading-relaxed text-muted-foreground">
            Deletes your answers and any unfinished setup from this browser,
            then returns to the welcome screen. Your theme is kept.
          </p>
          <Popover open={isConfirmingReset} onOpenChange={setIsConfirmingReset}>
            <PopoverTrigger asChild>
              <Button type="button" size="sm" variant="destructive">
                <RotateCcw aria-hidden />
                Reset onboarding
              </Button>
            </PopoverTrigger>
            <PopoverContent align="start" className="w-80 p-4">
              <PopoverHeader>
                <PopoverTitle>Delete your financial profile?</PopoverTitle>
                <PopoverDescription className="text-xs leading-relaxed">
                  This can&rsquo;t be undone. You&rsquo;ll answer the setup
                  questions again.
                </PopoverDescription>
              </PopoverHeader>
              <div className="flex justify-end gap-2 pt-1">
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => setIsConfirmingReset(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="destructive"
                  onClick={() => {
                    // Leave first: the profile gate would otherwise redirect
                    // the moment the profile disappears.
                    router.replace("/");
                    resetOnboarding();
                  }}
                >
                  Delete and start over
                </Button>
              </div>
            </PopoverContent>
          </Popover>
        </div>
      </CardContent>
    </Card>
  );
}
