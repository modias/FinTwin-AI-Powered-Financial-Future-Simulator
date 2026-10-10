import { describe, expect, it } from "vitest";

import { DEMO_DATASET_KEY, DEMO_PROFILE_ID } from "@/data/demo-profile";
import { STORAGE_KEYS } from "@/lib/constants";
import { makeValidDraft } from "@/lib/profile/__tests__/fixtures";
import { datasetForProfile } from "@/lib/profile/dataset";
import {
  activeProfileOf,
  createWorkspaceStore,
  type StorageLike,
} from "@/lib/workspace-store";

/** 2026-10-12 at noon local time, so the local calendar day is unambiguous. */
const NOW = new Date(2026, 9, 12, 12);

class MemoryStorage implements StorageLike {
  readonly values = new Map<string, string>();
  failWrites = false;

  getItem(key: string) {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string) {
    if (this.failWrites) throw new Error("QuotaExceededError");
    this.values.set(key, value);
  }

  removeItem(key: string) {
    this.values.delete(key);
  }
}

function setup(storage = new MemoryStorage()) {
  return { storage, store: createWorkspaceStore(() => storage) };
}

/** A new store over the same storage: what a page refresh sees. */
const reload = (storage: MemoryStorage) => createWorkspaceStore(() => storage);

const active = (store: ReturnType<typeof createWorkspaceStore>) =>
  activeProfileOf(store.getSnapshot().profiles);

describe("first visit", () => {
  it("starts with no profile and no draft", () => {
    const { store } = setup();

    expect(store.getSnapshot()).toMatchObject({
      theme: "light",
      draft: null,
      profiles: { activeSource: null, personal: null, demo: null },
    });
  });
});

describe("onboarding navigation and completion", () => {
  it("saves progress at every step and resumes it after a refresh", () => {
    const { storage, store } = setup();
    const draft = store.startOnboarding("blank");

    store.saveDraft({ ...draft, balanceCents: 123_456, step: 1 });

    const resumed = reload(storage);

    expect(resumed.getSnapshot().draft).toMatchObject({ balanceCents: 123_456, step: 1 });
    expect(resumed.startOnboarding("blank")).toMatchObject({ balanceCents: 123_456, step: 1 });
  });

  it("keeps both answers when two are saved in the same tick", () => {
    const { store } = setup();

    store.patchDraft({ paycheckAmountCents: 180_000 });
    store.patchDraft({ payFrequency: "biweekly" });

    expect(store.getSnapshot().draft).toMatchObject({
      paycheckAmountCents: 180_000,
      payFrequency: "biweekly",
    });
  });

  it("creates the personal profile, activates it and clears the draft", () => {
    const { storage, store } = setup();

    store.saveDraft(makeValidDraft({ step: 3, reviewed: true }));
    const result = store.completeOnboarding(NOW);

    expect(result.ok).toBe(true);
    expect(store.getSnapshot().draft).toBeNull();
    expect(active(store)).toMatchObject({
      source: "user_entered",
      account: { balanceCents: 200_000, balanceAsOf: "2026-10-12" },
    });

    // And it survives a refresh.
    expect(active(reload(storage))).toEqual(active(store));
  });

  it("sends the user back to the step that needs attention", () => {
    const { store } = setup();

    store.saveDraft(makeValidDraft({ step: 3, housingAmountCents: null }));

    expect(store.completeOnboarding(NOW)).toEqual({ ok: false, step: 1 });
    expect(store.getSnapshot().draft?.step).toBe(1);
    expect(active(store)).toBeNull();
  });

  it("edits the personal profile in place", () => {
    const { store } = setup();

    store.saveDraft(makeValidDraft());
    store.completeOnboarding(NOW);
    const original = active(store)!;

    const draft = store.startOnboarding("active");

    expect(draft).toMatchObject({ basedOn: "personal", balanceCents: 200_000 });

    store.saveDraft({ ...draft, balanceCents: 90_000 });
    store.completeOnboarding(NOW);

    expect(active(store)).toMatchObject({ id: original.id, account: { balanceCents: 90_000 } });
    expect(datasetForProfile(active(store)!).key).not.toBe(datasetForProfile(original).key);
  });

  it("does not change the dashboard until the edit is saved", () => {
    const { store } = setup();

    store.saveDraft(makeValidDraft());
    store.completeOnboarding(NOW);
    const before = active(store);

    store.saveDraft({ ...store.startOnboarding("active"), balanceCents: 1 });

    expect(active(store)).toBe(before);
  });
});

describe("demo switching", () => {
  it("activates the seeded demo dataset", () => {
    const { store } = setup();

    store.activateDemo(NOW);

    const profile = active(store)!;

    expect(profile.id).toBe(DEMO_PROFILE_ID);
    expect(datasetForProfile(profile).key).toBe(DEMO_DATASET_KEY);
    expect(datasetForProfile(profile).transactions.length).toBeGreaterThan(0);
  });

  it("switches between the demo and the personal profile without losing either", () => {
    const { storage, store } = setup();

    store.saveDraft(makeValidDraft());
    store.completeOnboarding(NOW);
    const personal = active(store)!;

    store.activateDemo(NOW);
    expect(active(store)?.source).toBe("demo");
    expect(store.getSnapshot().profiles.personal).toEqual(personal);

    store.activatePersonal();
    expect(active(store)).toEqual(personal);
    expect(active(reload(storage))).toEqual(personal);
  });

  it("keeps each profile's preferences separate", () => {
    const { store } = setup();

    store.saveDraft(makeValidDraft());
    store.completeOnboarding(NOW);
    store.updateActivePreferences({ protectedMinimumCents: 0 });

    store.activateDemo(NOW);
    expect(active(store)?.preferences.protectedMinimumCents).toBe(30_000);

    store.activatePersonal();
    expect(active(store)?.preferences.protectedMinimumCents).toBe(0);
  });

  it("turns edited demo answers into a personal profile and leaves the demo alone", () => {
    const { store } = setup();

    store.activateDemo(NOW);
    const demo = active(store);
    const draft = store.startOnboarding("active");

    expect(draft.basedOn).toBe("demo");

    store.saveDraft({ ...draft, balanceCents: 100_000 });
    expect(store.completeOnboarding(NOW).ok).toBe(true);

    expect(active(store)?.source).toBe("user_entered");
    expect(store.getSnapshot().profiles.demo).toEqual(demo);
  });

  it("does not resume a draft made from a different profile", () => {
    const { store } = setup();

    store.activateDemo(NOW);
    store.saveDraft({ ...store.startOnboarding("blank"), balanceCents: 5 });

    expect(store.startOnboarding("active")).toMatchObject({ basedOn: "demo", balanceCents: 214_300 });
  });
});

describe("reset", () => {
  it("forgets every profile and draft but keeps the theme", () => {
    const { storage, store } = setup();

    store.setTheme("dark");
    store.saveDraft(makeValidDraft());
    store.completeOnboarding(NOW);
    store.activateDemo(NOW);
    store.startOnboarding("blank");

    store.resetOnboarding();

    const after = reload(storage).getSnapshot();

    expect(after.profiles).toEqual({ activeSource: null, personal: null, demo: null });
    expect(after.draft).toBeNull();
    expect(after.theme).toBe("dark");
  });
});

describe("safe parsing", () => {
  it("ignores corrupt or hand-edited storage", () => {
    const storage = new MemoryStorage();

    storage.values.set(STORAGE_KEYS.profiles, "{not json");
    storage.values.set(STORAGE_KEYS.onboardingDraft, JSON.stringify({ step: 9 }));
    storage.values.set(STORAGE_KEYS.theme, JSON.stringify("neon"));

    const snapshot = reload(storage).getSnapshot();

    expect(snapshot.profiles.activeSource).toBeNull();
    expect(snapshot.draft).toBeNull();
    expect(snapshot.theme).toBe("light");
  });

  it("falls back to onboarding when the active profile fails validation", () => {
    const { storage, store } = setup();

    store.saveDraft(makeValidDraft());
    store.completeOnboarding(NOW);

    const saved = JSON.parse(storage.values.get(STORAGE_KEYS.profiles)!);

    saved.personal.account.balanceCents = 12.5;
    storage.values.set(STORAGE_KEYS.profiles, JSON.stringify(saved));

    const snapshot = reload(storage).getSnapshot();

    expect(snapshot.profiles.personal).toBeNull();
    expect(snapshot.profiles.activeSource).toBeNull();
  });

  it("keeps working in memory when storage rejects writes", () => {
    const { storage, store } = setup();

    storage.failWrites = true;
    store.activateDemo(NOW);

    expect(active(store)?.source).toBe("demo");
  });

  it("stores only questionnaire answers: no credentials or keys", () => {
    const { storage, store } = setup();

    store.saveDraft(makeValidDraft());
    store.completeOnboarding(NOW);

    const everything = [...storage.values.values()].join("\n").toLowerCase();

    for (const word of ["password", "credential", "api_key", "apikey", "token", "routing"]) {
      expect(everything).not.toContain(word);
    }
  });
});
