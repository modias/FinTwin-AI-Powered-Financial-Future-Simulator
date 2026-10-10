import { Check, Lock } from "lucide-react";
import type { ReactNode } from "react";

import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";

/**
 * Building blocks for the pages whose functionality belongs to a later phase.
 *
 * The rule these enforce: show the shape of what is coming, never a result.
 * Inputs here are inert and marked as such, and there are no action buttons
 * that would imply something happens on click.
 */

export function PreviewNotice({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex items-start gap-3 rounded-xl bg-primary/8 p-4 ring-1 ring-primary/20",
        className,
      )}
    >
      <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-primary">
        <Lock aria-hidden className="size-3.5" />
      </span>
      <p className="text-sm leading-relaxed text-muted-foreground">{children}</p>
    </div>
  );
}

/** A card that frames inert controls, with the reason they are inert. */
export function PreviewPanel({
  title,
  description,
  footnote,
  children,
  className,
}: {
  title: string;
  description?: string;
  footnote?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <Card className={cn("[--card-spacing:--spacing(5)]", className)}>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
        {description ? (
          <CardDescription>{description}</CardDescription>
        ) : null}
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Inert by construction: a fieldset with `disabled` removes every
            descendant control from the tab order and from form submission. */}
        <fieldset disabled className="space-y-4">
          {children}
        </fieldset>
        {footnote ? (
          <p className="text-xs leading-relaxed text-muted-foreground">
            {footnote}
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}

export function PlannedCapabilities({
  items,
  title = "What this page will do",
}: {
  items: { title: string; description: string }[];
  title?: string;
}) {
  return (
    <Card className="[--card-spacing:--spacing(5)]">
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <ul className="space-y-3.5">
          {items.map((item) => (
            <li key={item.title} className="flex items-start gap-3">
              <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-success/12 text-success">
                <Check aria-hidden className="size-3" />
              </span>
              <span>
                <span className="block text-[13px] font-medium">
                  {item.title}
                </span>
                <span className="mt-0.5 block text-xs leading-relaxed text-muted-foreground">
                  {item.description}
                </span>
              </span>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

export function PreviewField({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[13px] font-medium">{label}</span>
        <Badge variant="secondary" className="text-[10px]">
          Preview
        </Badge>
      </div>
      <div className="tabular-figures rounded-lg border border-input bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
        {value}
      </div>
      {hint ? (
        <p className="text-xs leading-relaxed text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  );
}
