"use client";

import { FlaskConical, PencilLine } from "lucide-react";

import { useWorkspace } from "@/components/providers/workspace-provider";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

/**
 * Says where the figures on screen come from: the seeded demo dataset, or the
 * estimates the user entered during onboarding.
 */
export function DataSourceBadge({ className }: { className?: string }) {
  const { dataset } = useWorkspace();

  if (!dataset) return null;

  const isDemo = dataset.source === "demo";
  const Icon = isDemo ? FlaskConical : PencilLine;

  return (
    <Badge variant="secondary" className={cn("gap-1", className)}>
      <Icon aria-hidden />
      {isDemo ? "Demo data" : "Your estimates"}
    </Badge>
  );
}
