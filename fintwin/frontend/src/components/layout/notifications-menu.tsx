"use client";

import { Bell, BellOff, CalendarClock, Landmark } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { requestEventFocus } from "@/components/dashboard/event-focus";
import { useActiveWorkspace } from "@/components/providers/workspace-provider";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { TimelineSkeleton } from "@/components/shared/loading-skeleton";
import { useUpcomingEvents } from "@/hooks/use-financial-data";
import { formatRelativeDay, formatShortDate } from "@/lib/dates";
import { formatCurrency } from "@/lib/formatters";
import { cn } from "@/lib/utils";

const NOTIFICATION_WINDOW_DAYS = 7;

/**
 * Upcoming-money reminders for the next week.
 *
 * These are derived from the same cash-flow events the forecast uses, so the
 * bell is never showing something the dashboard disagrees with.
 */
export function NotificationsMenu() {
  const { referenceDate, dataset } = useActiveWorkspace();
  const { data: events, isPending } = useUpcomingEvents(
    NOTIFICATION_WINDOW_DAYS,
  );

  const [open, setOpen] = useState(false);
  const count = events?.length ?? 0;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell aria-hidden />
          {count > 0 ? (
            <span
              aria-hidden
              className="absolute top-1.5 right-1.5 size-1.5 rounded-full bg-primary ring-2 ring-background"
            />
          ) : null}
          <span className="sr-only">
            {count > 0
              ? `Notifications, ${count} upcoming in the next ${NOTIFICATION_WINDOW_DAYS} days`
              : "Notifications"}
          </span>
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[328px] p-0">
        <div className="border-b border-border px-4 py-3">
          <p className="font-heading text-sm font-medium">Upcoming money</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Next {NOTIFICATION_WINDOW_DAYS} days, from{" "}
            {dataset.source === "demo"
              ? "the demo cash-flow schedule"
              : "the schedule you entered"}
            .
          </p>
        </div>

        <div className="max-h-[320px] overflow-y-auto p-2">
          {isPending ? (
            <div className="p-2">
              <TimelineSkeleton rows={3} />
            </div>
          ) : count === 0 ? (
            <div className="flex flex-col items-center gap-2 px-4 py-8 text-center">
              <BellOff aria-hidden className="size-5 text-muted-foreground" />
              <p className="text-sm font-medium">Nothing due this week</p>
              <p className="text-xs text-muted-foreground">
                The next scheduled event falls outside the{" "}
                {NOTIFICATION_WINDOW_DAYS}-day window.
              </p>
            </div>
          ) : (
            <ul className="space-y-0.5">
              {events?.map((event) => {
                const isIncome = event.direction === "income";

                return (
                  <li key={event.id}>
                    <Link
                      href="/overview"
                      scroll={false}
                      title="Show in Upcoming financial events"
                      onClick={() => {
                        requestEventFocus(event.id);
                        setOpen(false);
                      }}
                      className="flex items-start gap-3 rounded-lg px-2 py-2 outline-none transition-colors hover:bg-muted/60 focus-visible:ring-3 focus-visible:ring-ring/50"
                    >
                      <span
                        className={cn(
                          "mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-lg",
                          isIncome
                            ? "bg-success/12 text-success"
                            : "bg-muted text-muted-foreground",
                        )}
                      >
                        {isIncome ? (
                          <Landmark aria-hidden className="size-3.5" />
                        ) : (
                          <CalendarClock aria-hidden className="size-3.5" />
                        )}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[13px] font-medium">
                          {event.name}
                        </span>
                        <span className="block text-xs text-muted-foreground">
                          {formatShortDate(event.date)} ·{" "}
                          {formatRelativeDay(event.date, referenceDate)}
                        </span>
                      </span>
                      <span
                        className={cn(
                          "tabular-figures text-[13px] font-medium",
                          isIncome ? "text-success" : "text-foreground",
                        )}
                      >
                        {isIncome ? "+" : "\u2212"}
                        {formatCurrency(event.amount)}
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
