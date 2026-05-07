/**
 * Storage Buckets feature-detect tests.
 *
 * Verifies graceful behaviour across three states:
 *   - API absent (most browsers in 2026)         → "—"
 *   - API present, zero buckets                  → "0 דליים"
 *   - API present, multiple named buckets        → "N דליים"
 *   - API present but `keys()` rejects           → "—"
 */
import { describe, it, expect, afterEach } from "vitest";
import { getStorageBuckets } from "../../../src/cards/system-info/system-info";

type Buckets = { keys: () => Promise<string[]> };

function setBuckets(buckets: Buckets | undefined): void {
  if (buckets === undefined) {
    delete (navigator as Navigator & { storageBuckets?: Buckets }).storageBuckets;
  } else {
    (navigator as Navigator & { storageBuckets?: Buckets }).storageBuckets = buckets;
  }
}

describe("getStorageBuckets ", () => {
  afterEach(() => setBuckets(undefined));

  it("returns '—' when navigator.storageBuckets is absent", async () => {
    setBuckets(undefined);
    expect(await getStorageBuckets()).toBe("—");
  });

  it("returns '0 דליים' when no buckets exist", async () => {
    setBuckets({ keys: () => Promise.resolve([]) });
    expect(await getStorageBuckets()).toBe("0 דליים");
  });

  it("returns the count of named buckets", async () => {
    setBuckets({ keys: () => Promise.resolve(["weather", "news", "stocks"]) });
    expect(await getStorageBuckets()).toBe("3 דליים");
  });

  it("returns '—' when keys() rejects", async () => {
    setBuckets({ keys: () => Promise.reject(new Error("denied")) });
    expect(await getStorageBuckets()).toBe("—");
  });
});
