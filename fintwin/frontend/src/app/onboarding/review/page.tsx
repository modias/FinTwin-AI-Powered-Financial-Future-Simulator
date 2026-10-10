import type { Metadata } from "next";

import { OnboardingReview } from "@/components/onboarding/onboarding-review";

export const metadata: Metadata = {
  title: "Review your financial twin",
  description: "Check your answers before FinTwin builds your forecast.",
};

export default function OnboardingReviewPage() {
  return <OnboardingReview />;
}
