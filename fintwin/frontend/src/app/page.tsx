import { LineChart, Shield, Wallet } from "lucide-react";

import { PrivacyNotice } from "@/components/onboarding/privacy-notice";
import { WelcomeActions } from "@/components/onboarding/welcome-actions";
import { SIMULATION_DISCLAIMER } from "@/components/shared/disclosure-badges";
import { FinTwinLogo } from "@/components/shared/fintwin-logo";
import { APP_NAME } from "@/lib/constants";

/**
 * The welcome screen.
 *
 * It renders outside the `(app)` route group, so there is no sidebar or header
 * here. Visitors either build their own financial twin through the
 * questionnaire or explore the seeded demo data. It never redirects, so the
 * dashboard's "no profile yet" redirect back here cannot loop.
 */
export default function WelcomePage() {
  return (
    <main
      id="main-content"
      className="flex min-h-dvh flex-col items-center justify-center px-6 py-16"
    >
      <div className="flex w-full max-w-xl flex-col items-center text-center">
        <div className="animate-in fade-in zoom-in-95 flex items-center justify-center duration-500">
          <FinTwinLogo className="size-16 rounded-2xl ring-6 ring-primary/12" />
        </div>

        <p className="animate-in fade-in mt-6 font-heading text-sm font-medium tracking-wide text-primary duration-500">
          {APP_NAME}
        </p>

        <h1 className="animate-in fade-in slide-in-from-bottom-2 mt-2 font-heading text-4xl font-semibold tracking-tight duration-500 sm:text-5xl">
          Meet your financial future.
        </h1>

        <p className="animate-in fade-in slide-in-from-bottom-2 mt-4 max-w-md text-base leading-relaxed text-muted-foreground delay-75 duration-500 sm:text-lg">
          Tell us a little about your finances, and FinTwin will help you
          understand what&rsquo;s possible before you spend.
        </p>

        <div className="animate-in fade-in slide-in-from-bottom-2 mt-9 delay-150 duration-500">
          <WelcomeActions />
        </div>

        <p className="animate-in fade-in mt-4 text-xs text-muted-foreground delay-150 duration-500">
          Setup takes about 2&ndash;3 minutes. You can update your answers anytime.
        </p>

        <ul className="animate-in fade-in mt-12 grid w-full gap-3 text-left delay-200 duration-700 sm:grid-cols-3">
          <HighlightCard
            icon={Wallet}
            title="Safe to spend"
            description="The most you can spend today while staying above your floor in most simulated futures."
          />
          <HighlightCard
            icon={LineChart}
            title="What-if decisions"
            description="See how a purchase changes your chance of staying safe, before you make it."
          />
          <HighlightCard
            icon={Shield}
            title="Protected floor"
            description="The minimum balance every simulated future is tested against."
          />
        </ul>

        <PrivacyNotice className="animate-in fade-in mt-8 delay-300 duration-700" />

        <p className="animate-in fade-in mt-6 max-w-md text-xs leading-relaxed text-muted-foreground delay-300 duration-700">
          {SIMULATION_DISCLAIMER}
        </p>
      </div>
    </main>
  );
}

function HighlightCard({
  icon: Icon,
  title,
  description,
}: {
  icon: typeof Wallet;
  title: string;
  description: string;
}) {
  return (
    <li className="surface-card p-4">
      <Icon aria-hidden className="size-4 text-primary" />
      <p className="mt-2.5 text-sm font-medium">{title}</p>
      <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
        {description}
      </p>
    </li>
  );
}
