/**
 * `localStorage`-backed store for everything FinTwin remembers in the browser:
 * the saved profiles, which one is active, an onboarding questionnaire in
 * progress, the selected account and the theme.
 *
 * It is an external store rather than React state so the provider can read it
 * through `useSyncExternalStore`: the server snapshot is fixed (deterministic
 * markup, clean hydration), saved values are read without a mount effect, and
 * a change in one tab reaches the others through the `storage` event.
 *
 * Every key is versioned and every value is parsed with Zod on the way in, so
 * data from an older build, a hand edit or a half-written value is discarded
 * instead of reaching the forecast. Only questionnaire answers are stored —
 * never credentials or API keys — and `localStorage` is not a secure store,
 * which the UI states wherever it mentions storage.
 *
 * `createWorkspaceStore` takes the storage to use, so tests can run it against
 * an in-memory implementation.
 */

import { z } from "zod";

import { createDemoProfile } from "@/data/demo-profile";
import {
  DEFAULT_THEME,
  LEGACY_PREFERENCES_STORAGE_KEY,
  STORAGE_KEYS,
} from "@/lib/constants";
import { localIsoDate } from "@/lib/dates";
import {
  createEmptyDraft,
  draftFromProfile,
  draftToProfile,
  type DraftCompletion,
} from "@/lib/onboarding/draft";
import {
  financialProfileSchema,
  onboardingDraftSchema,
} from "@/lib/profile/schemas";
import { themePreferenceSchema } from "@/lib/schemas";
import type { ThemePreference } from "@/types/financial";
import type {
  FinancialProfile,
  OnboardingDraft,
  ProfilePreferences,
  ProfileSource,
} from "@/types/profile";

export interface StoredProfiles {
  /** Which profile drives the dashboard; `null` before onboarding. */
  activeSource: ProfileSource | null;
  personal: FinancialProfile | null;
  demo: FinancialProfile | null;
}

export interface WorkspaceSnapshot {
  theme: ThemePreference;
  /** `null` means "the active dataset's primary account". */
  selectedAccountId: string | null;
  profiles: StoredProfiles;
  draft: OnboardingDraft | null;
}

export type StorageLike = Pick<Storage, "getItem" | "setItem" | "removeItem">;

const EMPTY_PROFILES: StoredProfiles = {
  activeSource: null,
  personal: null,
  demo: null,
};

export const SERVER_SNAPSHOT: WorkspaceSnapshot = {
  theme: DEFAULT_THEME,
  selectedAccountId: null,
  profiles: EMPTY_PROFILES,
  draft: null,
};

const storedProfilesSchema = z.object({
  activeSource: z.enum(["user_entered", "demo"]).nullable(),
  personal: z.unknown(),
  demo: z.unknown(),
});

const storedWorkspaceSchema = z.object({
  selectedAccountId: z.string().min(1).nullable(),
});

const legacyPreferencesSchema = z.object({ theme: themePreferenceSchema });

export function activeProfileOf(profiles: StoredProfiles): FinancialProfile | null {
  if (profiles.activeSource === "demo") return profiles.demo;
  if (profiles.activeSource === "user_entered") return profiles.personal;

  return null;
}

export function createWorkspaceStore(getStorage: () => StorageLike | null) {
  const listeners = new Set<() => void>();
  let snapshot: WorkspaceSnapshot | null = null;

  function readJson(key: string): unknown {
    try {
      const raw = getStorage()?.getItem(key);

      return raw ? (JSON.parse(raw) as unknown) : null;
    } catch {
      // Unreadable or corrupt storage is treated as empty rather than taking
      // the app down.
      return null;
    }
  }

  function writeJson(key: string, value: unknown) {
    try {
      const storage = getStorage();

      if (value === null) {
        storage?.removeItem(key);
      } else {
        storage?.setItem(key, JSON.stringify(value));
      }
    } catch {
      // Private browsing can reject writes. The in-memory value still applies
      // for this session.
    }
  }

  function readTheme(): ThemePreference {
    const stored = themePreferenceSchema.safeParse(readJson(STORAGE_KEYS.theme));

    if (stored.success) return stored.data;

    const legacy = legacyPreferencesSchema.safeParse(
      readJson(LEGACY_PREFERENCES_STORAGE_KEY),
    );

    return legacy.success ? legacy.data.theme : DEFAULT_THEME;
  }

  function readProfile(value: unknown, source: ProfileSource): FinancialProfile | null {
    const parsed = financialProfileSchema.safeParse(value);

    return parsed.success && parsed.data.source === source ? parsed.data : null;
  }

  function readProfiles(): StoredProfiles {
    const stored = storedProfilesSchema.safeParse(readJson(STORAGE_KEYS.profiles));

    if (!stored.success) return EMPTY_PROFILES;

    const personal = readProfile(stored.data.personal, "user_entered");
    const demo = readProfile(stored.data.demo, "demo");
    const profiles = { activeSource: stored.data.activeSource, personal, demo };

    // An active source whose profile failed to parse falls back to onboarding.
    return activeProfileOf(profiles) ? profiles : { ...profiles, activeSource: null };
  }

  function readDraft(): OnboardingDraft | null {
    const parsed = onboardingDraftSchema.safeParse(readJson(STORAGE_KEYS.onboardingDraft));

    return parsed.success ? parsed.data : null;
  }

  function readSelectedAccountId(): string | null {
    const parsed = storedWorkspaceSchema.safeParse(readJson(STORAGE_KEYS.workspace));

    return parsed.success ? parsed.data.selectedAccountId : null;
  }

  function emit() {
    for (const listener of listeners) listener();
  }

  function getSnapshot(): WorkspaceSnapshot {
    snapshot ??= {
      theme: readTheme(),
      selectedAccountId: readSelectedAccountId(),
      profiles: readProfiles(),
      draft: readDraft(),
    };

    return snapshot;
  }

  function update(patch: Partial<WorkspaceSnapshot>) {
    const next = { ...getSnapshot(), ...patch };

    if ("theme" in patch) writeJson(STORAGE_KEYS.theme, next.theme);
    if ("selectedAccountId" in patch) {
      writeJson(STORAGE_KEYS.workspace, { selectedAccountId: next.selectedAccountId });
    }
    if ("profiles" in patch) writeJson(STORAGE_KEYS.profiles, next.profiles);
    if ("draft" in patch) writeJson(STORAGE_KEYS.onboardingDraft, next.draft);

    snapshot = next;
    emit();
  }

  const watchedKeys = new Set<string>(Object.values(STORAGE_KEYS));

  function handleStorageEvent(event: StorageEvent) {
    if (event.key !== null && !watchedKeys.has(event.key)) return;

    snapshot = null;
    emit();
  }

  function subscribe(listener: () => void): () => void {
    if (listeners.size === 0 && typeof window !== "undefined") {
      window.addEventListener("storage", handleStorageEvent);
    }

    listeners.add(listener);

    return () => {
      listeners.delete(listener);

      if (listeners.size === 0 && typeof window !== "undefined") {
        window.removeEventListener("storage", handleStorageEvent);
      }
    };
  }

  return {
    subscribe,
    getSnapshot,
    getServerSnapshot: (): WorkspaceSnapshot => SERVER_SNAPSHOT,

    setTheme(theme: ThemePreference) {
      update({ theme });
    },

    setSelectedAccountId(accountId: string | null) {
      update({ selectedAccountId: accountId });
    },

    /** Updates the active profile's preferences. Does nothing without one. */
    updateActivePreferences(patch: Partial<ProfilePreferences>) {
      const { profiles } = getSnapshot();
      const active = activeProfileOf(profiles);

      if (!active) return;

      const updated: FinancialProfile = {
        ...active,
        preferences: { ...active.preferences, ...patch },
      };

      update({
        profiles:
          active.source === "demo"
            ? { ...profiles, demo: updated }
            : { ...profiles, personal: updated },
      });
    },

    /**
     * Opens the questionnaire.
     *
     * `blank` resumes whatever draft is saved, or starts empty. `active` loads
     * the active profile's answers, resuming a saved draft only when it was
     * made from that same profile.
     */
    startOnboarding(from: "blank" | "active"): OnboardingDraft {
      const { draft, profiles } = getSnapshot();
      const active = from === "active" ? activeProfileOf(profiles) : null;
      const activeBasis = active?.source === "demo" ? "demo" : "personal";

      if (draft && (from === "blank" || draft.basedOn === activeBasis)) {
        return draft;
      }

      const next = active ? draftFromProfile(active) : createEmptyDraft();

      update({ draft: next });

      return next;
    },

    saveDraft(draft: OnboardingDraft) {
      update({ draft });
    },

    /**
     * Applies `patch` to the latest saved draft, so two changes made in the
     * same tick both survive.
     */
    patchDraft(patch: Partial<OnboardingDraft>) {
      update({ draft: { ...(getSnapshot().draft ?? createEmptyDraft()), ...patch } });
    },

    discardDraft() {
      update({ draft: null });
    },

    /**
     * Turns the draft into the personal profile and makes it active. Editing
     * the demo answers creates a personal profile; the demo is left as it was.
     */
    completeOnboarding(now: Date): DraftCompletion {
      const { draft, profiles } = getSnapshot();

      if (!draft) return { ok: false, step: 0 };

      const result = draftToProfile(draft, {
        today: localIsoDate(now),
        now: now.toISOString(),
        existing: profiles.personal,
      });

      if (!result.ok) {
        update({ draft: { ...draft, step: result.step } });

        return result;
      }

      update({
        profiles: { ...profiles, activeSource: "user_entered", personal: result.profile },
        draft: null,
        selectedAccountId: null,
      });

      return result;
    },

    /** "Try with Demo Data": activates the seeded demo profile. */
    activateDemo(now: Date) {
      const { profiles } = getSnapshot();

      update({
        profiles: {
          ...profiles,
          activeSource: "demo",
          demo: profiles.demo ?? createDemoProfile(now.toISOString()),
        },
        selectedAccountId: null,
      });
    },

    /** Switches back to the personal profile. Does nothing if there is none. */
    activatePersonal() {
      const { profiles } = getSnapshot();

      if (!profiles.personal) return;

      update({
        profiles: { ...profiles, activeSource: "user_entered" },
        selectedAccountId: null,
      });
    },

    /** Forgets every profile and any draft. The theme is kept. */
    resetOnboarding() {
      update({ profiles: EMPTY_PROFILES, draft: null, selectedAccountId: null });
    },
  };
}

export type WorkspaceStore = ReturnType<typeof createWorkspaceStore>;

export const workspaceStore = createWorkspaceStore(() =>
  typeof window === "undefined" ? null : window.localStorage,
);
