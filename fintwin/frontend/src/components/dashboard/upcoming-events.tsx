"use client";

import { CalendarOff } from "lucide-react";
import { useEffect } from "react";

import { useCategoryHighlight } from "@/components/dashboard/category-highlight";
import { clearEventFocus, useEventFocusRequest } from "@/components/dashboard/event-focus";
import { useActiveWorkspace } from "@/components/providers/workspace-provider";
import { EmptyState } from "@/components/shared/empty-state";
import { TimelineSkeleton } from "@/components/shared/loading-skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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

const FOCUS_HIGHLIGHT_MS = 2500;

// Touch screens have no hover, so details stay visible there.
const revealOnHover =
  "transition-all duration-200 opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100 group-data-[expanded=true]:opacity-100 pointer-coarse:opacity-100";
const collapseOnHover =
  "max-h-0 overflow-hidden group-hover:max-h-5 group-focus-visible:max-h-5 group-data-[expanded=true]:max-h-5 pointer-coarse:max-h-5";

function eventDomId(eventId: string) {
  return `upcoming-event-${eventId}`;
}

/**
 * A dated timeline of what is about to move, in and out.
 *
 * Shares its data with the forecast chart, so a bill shown here always appears
 * as the same dip on the same day in the projection.
 */
export function UpcomingEvents() {
  const { referenceDate } = useActiveWorkspace();
  const { data: events, isPending } = useUpcomingEvents(EVENTS_WINDOW_DAYS);
  const { category: highlighted, setCategory: setHighlighted } = useCategoryHighlight();
  const focusRequest = useEventFocusRequest();
  const focusedId = focusRequest?.eventId ?? null;
  const visibleEvents =
    events && highlighted
      ? events.filter((event) => event.category === highlighted || event.id === focusedId)
      : events;

  useEffect(() => {
    if (!focusRequest || !events) return;
    if (!events.some((event) => event.id === focusRequest.eventId)) {
      clearEventFocus(focusRequest);
      return;
    }

    setHighlighted(null);
    const frame = requestAnimationFrame(() => {
      document
        .getElementById(eventDomId(focusRequest.eventId))
        ?.scrollIntoView({ behavior: "smooth", block: "center" });
    });
    const timer = window.setTimeout(() => clearEventFocus(focusRequest), FOCUS_HIGHLIGHT_MS);

    return () => {
      cancelAnimationFrame(frame);
      window.clearTimeout(timer);
    };
  }, [focusRequest, events, setHighlighted]);

  return (
    // `contain: size` keeps the list from setting the row height, so the card
    // matches its neighbour beside it and the list scrolls instead.
    <Card className="[--card-spacing:--spacing(5)] xl:[contain:size]">
      <CardHeader>
        <CardTitle className="text-base">Upcoming financial events</CardTitle>
        <CardDescription>
          {highlighted ? (
            <>
              Showing {highlighted} only.{" "}
              <Button
                type="button"
                variant="link"
                size="sm"
                className="h-auto px-0 text-sm"
                onClick={() => setHighlighted(null)}
              >
                Show all
              </Button>
            </>
          ) : (
            `Scheduled and estimated activity for the next ${EVENTS_WINDOW_DAYS} days.`
          )}
        </CardDescription>
        {events && visibleEvents && events.length > 0 ? (
          <CardAction>
            <Badge variant="secondary">
              {highlighted ? `${visibleEvents.length} of ${events.length}` : events.length} events
            </Badge>
          </CardAction>
        ) : null}
      </CardHeader>

      <CardContent className="max-h-[28rem] min-h-0 overflow-y-auto overscroll-contain xl:max-h-none xl:flex-1">
        {isPending ? (
          <TimelineSkeleton rows={5} />
        ) : !events || events.length === 0 ? (
          <EmptyState
            icon={CalendarOff}
            title="No upcoming events"
            description={`This account has nothing scheduled or estimated in the next ${EVENTS_WINDOW_DAYS} days.`}
          />
        ) : !visibleEvents || visibleEvents.length === 0 ? (
          <EmptyState
            icon={CalendarOff}
            title={`No ${highlighted} events`}
            description={`Nothing in ${highlighted} is scheduled or estimated in the next ${EVENTS_WINDOW_DAYS} days.`}
          />
        ) : (
          <ol className="relative space-y-1">
            {/* The rail is decorative; the list itself carries the order. */}
            <span
              aria-hidden
              className="absolute top-2 bottom-2 left-[19px] w-px bg-border"
            />

            {visibleEvents.map((event) => {
              const Icon = categoryIcons[event.category];
              const isIncome = event.direction === "income";
              const isSelected = !isIncome && highlighted === event.category;
              const isFocused = focusedId === event.id;
              const Row = isIncome ? "div" : "button";

              return (
                <li key={event.id} id={eventDomId(event.id)} className="relative scroll-mt-4">
                  <Row
                    {...(isIncome
                      ? {}
                      : {
                          type: "button" as const,
                          "aria-pressed": isSelected,
                          title: `Show ${event.category} in the spending chart`,
                          onClick: () => setHighlighted(isSelected ? null : event.category),
                        })}
                    data-expanded={isSelected || isFocused}
                    className={cn(
                      "group flex w-full items-center gap-3.5 rounded-lg px-1 py-2 text-left transition-colors duration-500 hover:bg-muted/40",
                      !isIncome &&
                        "cursor-pointer outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                      isSelected && "bg-muted/60 hover:bg-muted/60",
                      isFocused && "bg-primary/10 ring-1 ring-primary/30 hover:bg-primary/10",
                    )}
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
                            revealOnHover,
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
                      <p
                        className={cn(
                          "truncate text-xs text-muted-foreground",
                          revealOnHover,
                          collapseOnHover,
                        )}
                      >
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
                      <p
                        className={cn(
                          "text-xs text-muted-foreground",
                          revealOnHover,
                          collapseOnHover,
                        )}
                      >
                        {isIncome ? "Income" : "Expense"}
                      </p>
                    </div>
                  </Row>
                </li>
              );
            })}
          </ol>
        )}
      </CardContent>
    </Card>
  );
}
