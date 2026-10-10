import type { LucideIcon } from "lucide-react";

import { Label } from "@/components/ui/label";
import { RadioGroupItem } from "@/components/ui/radio-group";
import { cn } from "@/lib/utils";

/** A selectable card for use inside a `RadioGroup`. The whole tile is the label. */
export function OptionTile({
  value,
  title,
  description,
  icon: Icon,
  isSelected,
  className,
}: {
  value: string;
  title: string;
  description?: string;
  icon?: LucideIcon;
  isSelected: boolean;
  className?: string;
}) {
  return (
    <Label
      className={cn(
        "flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors",
        isSelected
          ? "border-primary/40 bg-primary/8"
          : "border-border hover:bg-muted/40",
        className,
      )}
    >
      <RadioGroupItem value={value} className="mt-0.5" />
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5 text-[13px] font-medium">
          {Icon ? <Icon aria-hidden className="size-3.5" /> : null}
          {title}
        </span>
        {description ? (
          <span className="mt-0.5 block text-xs leading-relaxed font-normal text-muted-foreground">
            {description}
          </span>
        ) : null}
      </span>
    </Label>
  );
}
