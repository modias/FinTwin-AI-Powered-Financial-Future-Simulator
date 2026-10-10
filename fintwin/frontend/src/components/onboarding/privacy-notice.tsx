import { LockKeyhole } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * Says exactly where onboarding answers go. Shown on the welcome screen, in
 * the questionnaire and in Settings.
 */
export function PrivacyNotice({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "flex items-start gap-2.5 rounded-lg border border-border bg-muted/40 p-3 text-left",
        className,
      )}
    >
      <LockKeyhole aria-hidden className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
      <p className="text-xs leading-relaxed text-muted-foreground">
        <span className="font-medium text-foreground">
          This hackathon version isn&rsquo;t connected to a bank.
        </span>{" "}
        Your answers are saved only in this browser&rsquo;s{" "}
        <code className="rounded bg-muted px-1 py-0.5 font-mono text-[11px]">
          localStorage
        </code>{" "}
        so you can come back to them, and nothing is sent to a server.
        localStorage is fine for a demo but is not a secure place for real
        financial data. FinTwin never asks for bank logins, account numbers or
        passwords.
      </p>
    </div>
  );
}
