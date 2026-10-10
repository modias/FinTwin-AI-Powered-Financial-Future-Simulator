"use client";

import { CalendarOff } from "lucide-react";

import { useActiveWorkspace } from "@/components/providers/workspace-provider";
import { EmptyState } from "@/components/shared/empty-state";
import { TimelineSkeleton } from "@/components/shared/loading-skeleton";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useUpcomingEvents } from "@/hooks/use-financial-data";
import { categoryIcons } from "@/lib/category-visuals";
import { formatRelativeDay, formatShortDate, formatWeekday } from "@/lib/dates";
import { formatCurrency } from "@/lib/formatters";
import { cn } from "@/lib/utils";

const EVENTS_WINDOW_DAYS = 30;

/**
 * A dated timeline of what is about to move, in and out.
 *
 * Shares its data with the forecast chart, so a bill shown here always appears
 * as the same dip on the same day in the projection.
 */
export function UpcomingEvents() {
  const { referenceDate } = useActiveWorkspace();
  const { data: events, isPending } = useUpcomingEvents(EVENTS_WINDOW_DAYS);

  return (
    <Card className="[--card-spacing:--spacing(5)]">
      <CardHeader>
        <CardTitle className="text-base">Upcoming financial events</CardTitle>
        <CardDescription>
          Scheduled and estimated activity for the next {EVENTS_WINDOW_DAYS}{" "}
          days.
        </CardDescription>
        {events && events.length > 0 ? (
          <CardAction>
            <Badge variant="secondary">{events.length} events</Badge>
          </CardAction>
        ) : null}
      </CardHeader>

      <CardContent>
        {isPending ? (
          <TimelineSkeleton rows={5} />
        ) : !events || events.length === 0 ? (
          <EmptyState
            icon={CalendarOff}
            title="No upcoming events"
            description={`This account has nothing scheduled or estimated in the next ${EVENTS_WINDOW_DAYS} days.`}
          />
        ) : (
          <ol className="relative space-y-1">
            {/* The rail is decorative; the list itself carries the order. */}
            <span
              aria-hidden
              className="absolute top-2 bottom-2 left-[19px] w-px bg-border"
            />

            {events.map((event) => {
              const Icon = categoryIcons[event.category];
              const isIncome = event.direction === "income";

              return (
                <li
                  key={event.id}
                  className="relative flex items-center gap-3.5 rounded-lg px-1 py-2 transition-colors hover:bg-muted/40"
                >
                  <span
                    className={cn(
                      "z-10 flex size-10 shrink-0 items-center justify-center rounded-xl ring-4 ring-card",
                      isIncome
                        ? "bg-success/12 text-success"
                        : event.confidence === "estimated"
                          ? "bg-muted text-muted-foreground"
                          : "bg-warning/12 text-warning",
                    )}
                  >
                    <Icon aria-hidden className="size-4" />
                  </span>

                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-2 text-sm font-medium">
                      <span className="truncate">{event.name}</span>
                      <Badge
                        variant="outline"
                        className={cn(
                          "shrink-0 text-[10px]",
                          event.confidence === "estimated"
                            ? "border-border text-muted-foreground"
                            : "border-success/30 text-success",
                        )}
                      >
                        {event.confidence === "estimated"
                          ? "Estimated"
                          : "Scheduled"}
                      </Badge>
                    </p>
                    <p className="mt-0.5 truncate text-xs text-muted-foreground">
                      {event.category} · {formatWeekday(event.date)}{" "}
                      {formatShortDate(event.date)} ·{" "}
                      {formatRelativeDay(event.date, referenceDate)}
                    </p>
                  </div>

                  <div className="shrink-0 text-right">
                    <p
                      className={cn(
                        "tabular-figures text-sm font-medium",
                        isIncome ? "text-success" : "text-foreground",
                      )}
                    >
                      {isIncome ? "+" : "\u2212"}
                      {formatCurrency(event.amount)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {isIncome ? "Income" : "Expense"}
                    </p>
                  </div>
                </li>
              );
            })}
          </ol>
        )}
      </CardContent>
    </Card>
  );
}
