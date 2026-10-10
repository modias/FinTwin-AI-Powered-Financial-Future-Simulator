import { demoDataset } from "@/data/demo-profile";
import { profileToDataset } from "@/lib/profile/timeline";
import type { FinancialDataset } from "@/types/financial";
import type { FinancialProfile } from "@/types/profile";

/**
 * The dataset the dashboard computes from for a profile.
 *
 * The demo profile keeps the seeded mock dataset with its transaction history.
 * A personal profile gets only what the user entered: Alex's demo
 * transactions are never mixed into it.
 */
export function datasetForProfile(profile: FinancialProfile): FinancialDataset {
  return profile.source === "demo" ? demoDataset : profileToDataset(profile);
}
