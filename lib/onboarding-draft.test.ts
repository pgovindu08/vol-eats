import { beforeEach, describe, expect, it } from "vitest";
import { clearDraft, DRAFT_MAX_AGE_MS, draftKey, emptyDraft, hasProgress, LEGACY_DRAFT_KEY, loadDraft, saveDraft } from "./onboarding-draft";
import { inferLivingSituation, normalizeProfile } from "./profile";
import { DEMO_PROFILE } from "@/mock/demo-profile";

const map = new Map<string, string>();
const storage = {
  getItem: (k: string) => map.get(k) ?? null,
  setItem: (k: string, v: string) => void map.set(k, v),
  removeItem: (k: string) => void map.delete(k),
};
const NOW = Date.parse("2026-11-14T12:00:00Z");
const DAY = 24 * 60 * 60 * 1000;

beforeEach(() => map.clear());

describe("per-user onboarding drafts", () => {
  it("keeps each user's draft separate (shared phone)", () => {
    saveDraft("alex@vols.utk.edu", { ...emptyDraft(NOW), furthest: 2, goal_type: "lose_fat", weight: 150 }, storage, NOW);
    expect(loadDraft("sam@vols.utk.edu", storage, NOW)).toEqual(emptyDraft(NOW));
    const alex = loadDraft("alex@vols.utk.edu", storage, NOW);
    expect(alex.furthest).toBe(2);
    expect(alex.weight).toBe(150);
  });

  it("ignores email case and spacing", () => {
    expect(draftKey(" Alex@Vols.UTK.edu ")).toBe(draftKey("alex@vols.utk.edu"));
  });

  it("drops drafts older than 14 days", () => {
    saveDraft("alex@vols.utk.edu", { ...emptyDraft(NOW), furthest: 1 }, storage, NOW - DRAFT_MAX_AGE_MS - DAY);
    expect(loadDraft("alex@vols.utk.edu", storage, NOW).furthest).toBe(0);
    expect(map.has(draftKey("alex@vols.utk.edu"))).toBe(false);
  });

  it("keeps drafts that are under 14 days old", () => {
    saveDraft("alex@vols.utk.edu", { ...emptyDraft(NOW), furthest: 3 }, storage, NOW - 13 * DAY);
    expect(loadDraft("alex@vols.utk.edu", storage, NOW).furthest).toBe(3);
  });

  it("deletes the v1 shared draft instead of giving it to whoever signs in", () => {
    map.set(LEGACY_DRAFT_KEY, JSON.stringify({ step: 2, goal_type: "build_muscle", weight: 200 }));
    const draft = loadDraft("sam@vols.utk.edu", storage, NOW);
    expect(draft.goal_type).toBeUndefined();
    expect(map.has(LEGACY_DRAFT_KEY)).toBe(false);
  });

  it("survives corrupt JSON and clears on finish", () => {
    map.set(draftKey("alex@vols.utk.edu"), "{not json");
    expect(loadDraft("alex@vols.utk.edu", storage, NOW)).toEqual(emptyDraft(NOW));
    saveDraft("alex@vols.utk.edu", emptyDraft(NOW), storage, NOW);
    clearDraft("alex@vols.utk.edu", storage);
    expect(map.size).toBe(0);
  });

  it("detects whether a draft is worth resuming", () => {
    expect(hasProgress(emptyDraft(NOW))).toBe(false);
    expect(hasProgress({ ...emptyDraft(NOW), goal_type: "maintain" })).toBe(true);
    expect(hasProgress({ ...emptyDraft(NOW), furthest: 1 })).toBe(true);
  });
});

describe("normalizeProfile (v1 → v2)", () => {
  it("fills v2 fields on a profile saved before they existed", () => {
    const { living_situation, favorite_location_ids, kitchen_access, onboarding_status, ...v1 } = DEMO_PROFILE;
    void [living_situation, favorite_location_ids, kitchen_access, onboarding_status];
    const p = normalizeProfile(v1);
    expect(p.living_situation).toBe("on_campus"); // Vol Block 100 = swipes + dining dollars
    expect(p.favorite_location_ids).toEqual([]);
    expect(p.kitchen_access).toBeNull();
    expect(p.onboarding_status).toBe("complete");
  });

  it("keeps values that are already set", () => {
    expect(normalizeProfile({ ...DEMO_PROFILE, onboarding_status: "partial" }).onboarding_status).toBe("partial");
  });

  it("infers living situation from the meal plan", () => {
    expect(inferLivingSituation("swipes")).toBe("on_campus");
    expect(inferLivingSituation("dining_dollars")).toBe("off_campus_plan");
    expect(inferLivingSituation("none")).toBe("off_campus_cooking");
  });
});
