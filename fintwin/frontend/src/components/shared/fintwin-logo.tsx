import { cn } from "@/lib/utils";

/**
 * The FinTwin mark: a single path that forks into two, for the present balance
 * and the projected future that FinTwin puts beside it.
 */
export function FinTwinLogo({ className }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        "flex size-8 shrink-0 items-center justify-center rounded-[10px] bg-primary text-primary-foreground",
        className,
      )}
    >
      <svg
        viewBox="0 0 24 24"
        fill="none"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        // Sized as a share of the container so the mark scales with it.
        className="size-[56%]"
      >
        <path d="M4 17c3.2 0 4.6-5 7.4-5" stroke="currentColor" />
        <path d="M11.4 12c2.8 0 4.2 -5 8.6 -5" stroke="currentColor" />
        <path
          d="M11.4 12c2.8 0 4.2 5 8.6 5"
          stroke="currentColor"
          strokeOpacity={0.45}
        />
      </svg>
    </span>
  );
}

export function FinTwinWordmark({ className }: { className?: string }) {
  return (
    <span className={cn("flex items-center gap-2.5", className)}>
      <FinTwinLogo />
      <span className="flex flex-col leading-none">
        <span className="font-heading text-[15px] font-semibold tracking-tight">
          FinTwin
        </span>
        <span className="mt-1 text-[11px] text-muted-foreground">
          Financial future simulator
        </span>
      </span>
    </span>
  );
}
