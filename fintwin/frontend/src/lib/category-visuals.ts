import {
  ArrowLeftRight,
  Car,
  CircleEllipsis,
  Clapperboard,
  HeartPulse,
  Home,
  Landmark,
  Repeat,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
  UtensilsCrossed,
  Wallet,
  Zap,
  type LucideIcon,
} from "lucide-react";

import type { TransactionCategory } from "@/types/financial";

export const categoryIcons: Record<TransactionCategory, LucideIcon> = {
  Housing: Home,
  Food: UtensilsCrossed,
  Transportation: Car,
  Shopping: ShoppingBag,
  Entertainment: Clapperboard,
  Utilities: Zap,
  Subscriptions: Repeat,
  Healthcare: HeartPulse,
  Insurance: ShieldCheck,
  Debt: Wallet,
  "Personal Care": Sparkles,
  Other: CircleEllipsis,
  Income: Landmark,
  Transfer: ArrowLeftRight,
};

/**
 * Chart colours are CSS custom properties rather than literals so the charts
 * follow the active theme instead of hardcoding one palette.
 */
export const categoryColors: Record<TransactionCategory, string> = {
  Housing: "var(--chart-1)",
  Food: "var(--chart-2)",
  Transportation: "var(--chart-5)",
  Shopping: "var(--chart-6)",
  Entertainment: "var(--chart-3)",
  Utilities: "var(--chart-7)",
  Subscriptions: "var(--chart-4)",
  Healthcare: "var(--chart-8)",
  Insurance: "var(--chart-9)",
  Debt: "var(--chart-10)",
  "Personal Care": "var(--chart-11)",
  Other: "var(--muted-foreground)",
  Income: "var(--chart-2)",
  Transfer: "var(--muted-foreground)",
};

export function categoryColor(category: TransactionCategory): string {
  return categoryColors[category];
}
