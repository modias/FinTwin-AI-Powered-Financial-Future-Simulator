"use client";

import { useRouter } from "next/navigation";
import { PencilLine } from "lucide-react";
import type { ComponentProps } from "react";

import { useWorkspace } from "@/components/providers/workspace-provider";
import { Button } from "@/components/ui/button";

/**
 * Opens the questionnaire with the active profile's answers filled in. Saving
 * an edited demo profile creates a personal one; the demo stays as it was.
 */
export function EditProfileButton({
  children = "Edit financial profile",
  ...props
}: Omit<ComponentProps<typeof Button>, "onClick" | "asChild">) {
  const router = useRouter();
  const { startOnboarding } = useWorkspace();

  return (
    <Button
      {...props}
      onClick={() => {
        startOnboarding("active");
        router.push("/onboarding");
      }}
    >
      <PencilLine aria-hidden />
      {children}
    </Button>
  );
}
