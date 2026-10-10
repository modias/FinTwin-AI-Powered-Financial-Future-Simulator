import type { Metadata } from "next";

import { OnboardingWizard } from "@/components/onboarding/onboarding-wizard";

export const metadata: Metadata = {
  title: "Build your financial twin",
  description: "Four short questions about your income, bills, spending and safety cushion.",
};

export default function OnboardingPage() {
  return <OnboardingWizard />;
}
