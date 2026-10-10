import type { FieldErrors } from "@/lib/onboarding/validation";
import type { OnboardingDraft } from "@/types/profile";

export interface StepProps {
  draft: OnboardingDraft;
  update: (patch: Partial<OnboardingDraft>) => void;
  /** Only populated after the user tries to continue. */
  errors: FieldErrors;
  /** The user's local calendar day. */
  today: string;
}
