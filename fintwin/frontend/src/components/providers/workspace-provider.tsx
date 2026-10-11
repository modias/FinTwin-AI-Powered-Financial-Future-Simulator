"use client";

/**
 * Exposes the `localStorage`-backed workspace store (see
 * `@/lib/workspace-store`) to the component tree, together with what derives
 * from it: the active profile, the dataset it resolves to, the selected
 * account and the dashboard preferences.
 *
 * Server rendering always sees the empty server snapshot, which keeps the
 * markup deterministic and hydration clean; `isHydrated` lets callers tell
 * "nothing saved" apart from "not read yet".
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { useTheme } from "next-themes";

import { DEFAULT_THEME } from "@/lib/constants";
import type { DraftCompletion } from "@/lib/onboarding/draft";
import { datasetForProfile } from "@/lib/profile/dataset";
import {
  DEFAULT_PROFILE_PREFERENCES,
  toProfilePreferencesPatch,
  toUserPreferences,
} from "@/lib/profile/preferences";
import {
  activeProfileOf,
  workspaceStore,
  type StoredProfiles,
} from "@/lib/workspace-store";
import type { FinancialDataset, UserPreferences } from "@/types/financial";
import type { FinancialProfile, OnboardingDraft } from "@/types/profile";

interface WorkspaceContextValue {
  /** False until saved values have been read from `localStorage`. */
  isHydrated: boolean;

  preferences: UserPreferences;
  updatePreferences: (patch: Partial<UserPreferences>) => void;
  resetPreferences: () => void;
  /** Includes or leaves out simulated unexpected expenses for the active profile. */
  setEmergenciesEnabled: (enabled: boolean) => void;

  profiles: StoredProfiles;
  /** The profile driving the dashboard; `null` before onboarding. */
  activeProfile: FinancialProfile | null;
  /** What every figure is computed from; `null` without an active profile. */
  dataset: FinancialDataset | null;
  /** The dataset's reference date, or `null` without an active profile. */
  referenceDate: string | null;
  selectedAccountId: string | null;
  setSelectedAccountId: (accountId: string) => void;

  draft: OnboardingDraft | null;
  /** Changes when a questionnaire ends or is replaced; see `WorkspaceSnapshot`. */
  draftSession: number;
  startOnboarding: (from: "blank" | "active") => OnboardingDraft;
  saveDraft: (draft: OnboardingDraft) => void;
  /** Merges `patch` into the latest saved draft, or into a new one. */
  patchDraft: (patch: Partial<OnboardingDraft>) => void;
  discardDraft: () => void;
  completeOnboarding: () => DraftCompletion;
  activateDemo: () => void;
  activatePersonal: () => void;
  resetOnboarding: () => void;
}

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);

const subscribe = workspaceStore.subscribe;

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const snapshot = useSyncExternalStore(
    subscribe,
    workspaceStore.getSnapshot,
    workspaceStore.getServerSnapshot,
  );

  const isHydrated = useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );

  const {
    theme,
    profiles,
    draft,
    draftSession,
    selectedAccountId: storedAccountId,
  } = snapshot;
  const activeProfile = activeProfileOf(profiles);

  const dataset = useMemo(
    () => (activeProfile ? datasetForProfile(activeProfile) : null),
    [activeProfile],
  );

  const selectedAccountId = useMemo(() => {
    if (!dataset) return null;

    return dataset.accounts.some((account) => account.id === storedAccountId)
      ? storedAccountId
      : dataset.user.primaryAccountId;
  }, [dataset, storedAccountId]);

  const preferences = useMemo(
    () => toUserPreferences(activeProfile?.preferences ?? null, theme),
    [activeProfile, theme],
  );

  const { setTheme } = useTheme();

  // `next-themes` owns applying the theme class; the store owns the choice.
  useEffect(() => {
    if (!isHydrated) return;

    setTheme(theme);
  }, [isHydrated, theme, setTheme]);

  const updatePreferences = useCallback((patch: Partial<UserPreferences>) => {
    if (patch.theme !== undefined) workspaceStore.setTheme(patch.theme);

    const profilePatch = toProfilePreferencesPatch(patch);

    if (Object.keys(profilePatch).length > 0) {
      workspaceStore.updateActivePreferences(profilePatch);
    }
  }, []);

  const resetPreferences = useCallback(() => {
    workspaceStore.setTheme(DEFAULT_THEME);
    workspaceStore.updateActivePreferences(DEFAULT_PROFILE_PREFERENCES);
  }, []);

  const setEmergenciesEnabled = useCallback((enabled: boolean) => {
    workspaceStore.setActiveEmergenciesEnabled(enabled, new Date());
  }, []);

  const setSelectedAccountId = useCallback((accountId: string) => {
    workspaceStore.setSelectedAccountId(accountId);
  }, []);

  const completeOnboarding = useCallback(
    () => workspaceStore.completeOnboarding(new Date()),
    [],
  );

  const activateDemo = useCallback(() => workspaceStore.activateDemo(new Date()), []);

  const value = useMemo<WorkspaceContextValue>(
    () => ({
      isHydrated,
      preferences,
      updatePreferences,
      resetPreferences,
      setEmergenciesEnabled,
      profiles,
      activeProfile,
      dataset,
      referenceDate: dataset?.referenceDate ?? null,
      selectedAccountId,
      setSelectedAccountId,
      draft,
      draftSession,
      startOnboarding: workspaceStore.startOnboarding,
      saveDraft: workspaceStore.saveDraft,
      patchDraft: workspaceStore.patchDraft,
      discardDraft: workspaceStore.discardDraft,
      completeOnboarding,
      activateDemo,
      activatePersonal: workspaceStore.activatePersonal,
      resetOnboarding: workspaceStore.resetOnboarding,
    }),
    [
      isHydrated,
      preferences,
      updatePreferences,
      resetPreferences,
      setEmergenciesEnabled,
      profiles,
      activeProfile,
      dataset,
      selectedAccountId,
      setSelectedAccountId,
      draft,
      draftSession,
      completeOnboarding,
      activateDemo,
    ],
  );

  return (
    <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>
  );
}

export function useWorkspace(): WorkspaceContextValue {
  const context = useContext(WorkspaceContext);

  if (!context) {
    throw new Error("useWorkspace must be used inside a WorkspaceProvider");
  }

  return context;
}

type ActiveWorkspace = WorkspaceContextValue & {
  activeProfile: FinancialProfile;
  dataset: FinancialDataset;
  referenceDate: string;
  selectedAccountId: string;
};

/**
 * The workspace with an active profile guaranteed. For components under
 * `ProfileGate`, which only renders its children once a profile is active.
 */
export function useActiveWorkspace(): ActiveWorkspace {
  const workspace = useWorkspace();
  const { activeProfile, dataset, referenceDate, selectedAccountId } = workspace;

  if (!activeProfile || !dataset || !referenceDate || !selectedAccountId) {
    throw new Error("useActiveWorkspace must be used inside a ProfileGate");
  }

  return { ...workspace, activeProfile, dataset, referenceDate, selectedAccountId };
}
