import { History } from "lucide-react";

import { EditProfileButton } from "@/components/shared/edit-profile-button";
import { EmptyState } from "@/components/shared/empty-state";

/**
 * Shown wherever the demo would show transaction history, for a personal
 * profile that has none. FinTwin never borrows the demo's transactions to fill
 * the gap.
 */
export function NoHistoryNotice({ compact = false }: { compact?: boolean }) {
  return (
    <EmptyState
      icon={History}
      title="No transaction history"
      className={compact ? "py-8" : undefined}
      description={
        <>
          FinTwin isn&rsquo;t connected to a bank, so there&rsquo;s no history
          for your profile. Your dashboard uses the balance, schedule and
          estimates you entered instead.
        </>
      }
      action={<EditProfileButton variant="outline" size="sm" />}
    />
  );
}
