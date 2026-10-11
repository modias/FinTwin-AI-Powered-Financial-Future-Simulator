import type { Metadata } from "next";

import { CategoryHighlightProvider } from "@/components/dashboard/category-highlight";
import { FinancialSummaryCards } from "@/components/dashboard/financial-summary";
import { ForecastChart } from "@/components/dashboard/forecast-chart";
import { RecentTransactions } from "@/components/dashboard/recent-transactions";
import { SafeToSpendCard } from "@/components/dashboard/safe-to-spend-card";
import { SpendingChart } from "@/components/dashboard/spending-chart";
import { UpcomingEvents } from "@/components/dashboard/upcoming-events";
import { WelcomeHeader } from "@/components/dashboard/welcome-header";

// Rendered from the profile in this browser; see `(app)/layout.tsx`.
export const instant = false;

export const metadata: Metadata = {
  title: "Overview",
};

export default function OverviewPage() {
  return (
    <div className="space-y-6">
      <WelcomeHeader />

      <SafeToSpendCard />

      <FinancialSummaryCards />

      <ForecastChart />

      <CategoryHighlightProvider>
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <UpcomingEvents />
          <SpendingChart />
        </div>
      </CategoryHighlightProvider>

      <RecentTransactions />
    </div>
  );
}
